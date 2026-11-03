import test from 'node:test';
import assert from 'node:assert/strict';

import { requestLayoutSuggestions } from '../src/domain/ai-client.js';

const summary = { objects: [] };
const jsonResponse = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const move = { type: 'move', objectId: 'mon', x: 0, y: 0.2 };

test('posts the summary and goal and returns the clean suggestions', async () => {
  let sent;
  const result = await requestLayoutSuggestions({
    summary,
    goal: '更整洁',
    fetchImpl: async (url, init) => {
      sent = { url, init, body: JSON.parse(init.body) };
      return jsonResponse(200, {
        version: 1, model: 'deepseek-chat',
        suggestions: [
          { id: 's1', title: '显示器居中', reason: '看着更舒服。', category: 'ergonomics', actions: [move] },
          { title: '删设备', reason: '不行。', actions: [{ type: 'remove', objectId: 'desk' }] },
        ],
      });
    },
  });
  assert.equal(sent.url, '/api/ai/layout');
  assert.equal(sent.init.method, 'POST');
  assert.equal(sent.init.credentials, 'include');
  assert.deepEqual(sent.body, { version: 1, summary, goal: '更整洁' });
  assert.deepEqual(result, {
    model: 'deepseek-chat',
    suggestions: [{ id: 's1', title: '显示器居中', reason: '看着更舒服。', category: 'ergonomics', actions: [move] }],
    remaining: null,
  });
});

test('server errors keep their code and Chinese message', async () => {
  for (const [status, body, code, message] of [
    [503, { error: 'ai_unavailable', message: 'AI 功能暂未开放' }, 'ai_unavailable', 'AI 功能暂未开放'],
    [429, { error: 'ai_rate_limited', message: '用得太频繁了，请一小时后再试', remaining: 3 }, 'ai_rate_limited', '用得太频繁了，请一小时后再试'],
    [504, { error: 'ai_timeout' }, 'ai_timeout', 'AI 想得太久了，请再试一次'],
    [500, 'not json', 'ai_upstream_error', 'AI 服务暂时没有响应，请稍后再试'],
  ]) {
    await assert.rejects(
      requestLayoutSuggestions({ summary, fetchImpl: async () => (typeof body === 'string' ? new Response(body, { status }) : jsonResponse(status, body)) }),
      error => error.code === code && error.message === message && (code === 'ai_rate_limited' ? error.remaining === 3 : error.remaining === undefined),
      code,
    );
  }
});

test('a 200 without suggestions is treated as an unreadable answer', async () => {
  await assert.rejects(
    requestLayoutSuggestions({ summary, fetchImpl: async () => jsonResponse(200, { nope: true }) }),
    { code: 'ai_bad_output', message: 'AI 这次的回答看不懂，请再试一次' },
  );
});

test('network failure, timeout, and cancelling are told apart', async () => {
  await assert.rejects(
    requestLayoutSuggestions({ summary, fetchImpl: async () => { throw new TypeError('Failed to fetch'); } }),
    { code: 'network_error', message: '网络连接失败，请检查网络后再试' },
  );

  const hang = (url, init) => new Promise((resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
  });
  await assert.rejects(requestLayoutSuggestions({ summary, fetchImpl: hang, timeoutMs: 20 }), { code: 'ai_timeout' });

  const caller = new AbortController();
  const pending = requestLayoutSuggestions({ summary, fetchImpl: hang, signal: caller.signal });
  caller.abort();
  await assert.rejects(pending, { code: 'cancelled' });

  const already = new AbortController();
  already.abort();
  await assert.rejects(requestLayoutSuggestions({ summary, fetchImpl: hang, signal: already.signal }), { code: 'cancelled' });
});

test('a follow-up is sent along with the summary and goal', async () => {
  let body;
  await requestLayoutSuggestions({
    summary, goal: '更整洁', followUp: { previousSuggestions: [], feedback: '不要动主机' },
    fetchImpl: async (url, init) => { body = JSON.parse(init.body); return jsonResponse(200, { suggestions: [] }); },
  });
  assert.deepEqual(body, { version: 1, summary, goal: '更整洁', followUp: { previousSuggestions: [], feedback: '不要动主机' } });
});
