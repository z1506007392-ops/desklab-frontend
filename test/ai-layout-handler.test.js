import test from 'node:test';
import assert from 'node:assert/strict';

import { createLayoutHandler } from '../server/ai/layout-handler.js';

const KEY = 'sk-test-secret-key';
const env = { DEEPSEEK_API_KEY: KEY };
const summary = { room: { length: 4, width: 3.5, height: 2.7 }, objects: [] };

const request = (body, headers = {}) => new Request('https://desklab.test/api/ai/layout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

const completion = (content, extra = {}) => new Response(JSON.stringify({
  model: 'deepseek-chat',
  choices: [{ message: { role: 'assistant', content } }],
  usage: { prompt_tokens: 900, completion_tokens: 120 },
  ...extra,
}), { status: 200, headers: { 'Content-Type': 'application/json' } });

const goodContent = JSON.stringify({
  suggestions: [{
    id: 's1', title: '显示器移到正前方', reason: '看屏幕不用歪头。', category: 'ergonomics',
    actions: [{ type: 'move', objectId: 'monitor-1', x: 0, y: 0.18, secret: 'dropped' }],
  }, {
    title: '删掉主机', reason: '不行。', actions: [{ type: 'remove', objectId: 'pc' }],
  }],
});

async function call({ body = { version: 1, summary, goal: '更整洁' }, environment = env, fetchImpl, rateLimiter, headers } = {}) {
  const logger = { lines: [], log(...args) { this.lines.push(args.join(' ')); } };
  const handler = createLayoutHandler({ fetchImpl, rateLimiter, logger });
  const response = await handler({ request: request(body, headers), env: environment });
  const text = await response.text();
  return { response, text, json: JSON.parse(text), logger };
}

test('without a key, or with AI switched off, the endpoint says AI is not open yet', async () => {
  const neverCalled = async () => assert.fail('DeepSeek must not be called');
  for (const environment of [{}, { DEEPSEEK_API_KEY: '  ' }, { ...env, AI_ENABLED: 'false' }]) {
    const { response, json } = await call({ environment, fetchImpl: neverCalled });
    assert.equal(response.status, 503);
    assert.deepEqual(json, { error: 'ai_unavailable', message: 'AI 功能暂未开放' });
  }
});

test('oversized and malformed requests are refused before DeepSeek is called', async () => {
  const neverCalled = async () => assert.fail('DeepSeek must not be called');
  const big = await call({ body: { version: 1, summary: { blob: 'x'.repeat(70 * 1024) } }, fetchImpl: neverCalled });
  assert.equal(big.response.status, 413);
  assert.equal(big.json.error, 'too_large');
  for (const body of ['not json', [], { summary }, { version: 2, summary }, { version: 1, summary: [] }, { version: 1 }]) {
    const { response, json } = await call({ body, fetchImpl: neverCalled });
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.equal(json.error, 'bad_request');
  }
});

test('a good answer is filtered to the allowed fields and actions', async () => {
  let sent;
  const { response, json, text, logger } = await call({
    fetchImpl: async (url, init) => { sent = { url, init, body: JSON.parse(init.body) }; return completion(goodContent); },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(json, {
    version: 1,
    model: 'deepseek-chat',
    suggestions: [{
      id: 's1', title: '显示器移到正前方', reason: '看屏幕不用歪头。', category: 'ergonomics',
      actions: [{ type: 'move', objectId: 'monitor-1', x: 0, y: 0.18 }],
    }],
    usage: { promptTokens: 900, completionTokens: 120 },
  });

  assert.equal(sent.url, 'https://api.deepseek.com/chat/completions');
  assert.equal(sent.init.headers.Authorization, `Bearer ${KEY}`);
  assert.equal(sent.body.model, 'deepseek-chat');
  assert.deepEqual(sent.body.response_format, { type: 'json_object' });
  assert.equal(sent.body.max_tokens, 2000);
  assert.equal(sent.body.stream, false);
  assert.ok(sent.body.messages[1].content.includes('"更整洁"'));

  assert.ok(!text.includes(KEY), 'the key never appears in a response');
  assert.ok(logger.lines.every(line => !line.includes(KEY) && !line.includes('更整洁')), 'logs hold no key and no user data');
});

test('model and address come from the environment', async () => {
  let url, model;
  await call({
    environment: { ...env, DEEPSEEK_BASE_URL: 'https://proxy.example.com/v1/', DEEPSEEK_MODEL: 'deepseek-chat-v9' },
    fetchImpl: async (u, init) => { url = u; model = JSON.parse(init.body).model; return completion(goodContent); },
  });
  assert.equal(url, 'https://proxy.example.com/v1/chat/completions');
  assert.equal(model, 'deepseek-chat-v9');
});

test('DeepSeek failures map to plain error codes', async () => {
  const cases = [
    [async () => new Response('busy', { status: 503 }), 502, 'ai_upstream_error'],
    [async () => { throw new TypeError('fetch failed'); }, 502, 'ai_upstream_error'],
    [async () => new Response('<html>', { status: 200 }), 502, 'ai_bad_output'],
    [async () => completion(''), 502, 'ai_bad_output'],
    [async () => completion('not json'), 502, 'ai_bad_output'],
    [async () => completion('{"answer": 1}'), 502, 'ai_bad_output'],
    [async () => completion(null), 502, 'ai_bad_output'],
  ];
  for (const [fetchImpl, status, error] of cases) {
    const { response, json, text } = await call({ fetchImpl });
    assert.equal(response.status, status, error);
    assert.equal(json.error, error);
    assert.ok(!text.includes(KEY));
  }
});

test('a slow DeepSeek is cut off with a timeout error', async () => {
  const hang = (url, init) => new Promise((resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
  });
  const { response, json } = await call({ environment: { ...env, AI_TIMEOUT_MS: '20' }, fetchImpl: hang });
  assert.equal(response.status, 504);
  assert.equal(json.error, 'ai_timeout');
});

test('an empty suggestion list is a valid answer', async () => {
  const { response, json } = await call({ fetchImpl: async () => completion('{"suggestions": []}') });
  assert.equal(response.status, 200);
  assert.deepEqual(json.suggestions, []);
});

test('the rate limiter is asked per client address and can refuse', async () => {
  const seen = [];
  const rateLimiter = { async take(key) { seen.push(key); return { allowed: false, mode: 'memory' }; } };
  const { response, json } = await call({
    rateLimiter, headers: { 'CF-Connecting-IP': '203.0.113.7' },
    fetchImpl: async () => assert.fail('DeepSeek must not be called'),
  });
  assert.deepEqual(seen, ['203.0.113.7']);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('X-AI-Limit-Mode'), 'memory');
  assert.deepEqual(json, { error: 'ai_rate_limited', message: '今天的 AI 次数用完了，明天再试' });
});

test('the Pages Function route uses the handler', async () => {
  const { onRequestPost } = await import('../functions/api/ai/layout.js');
  const response = await onRequestPost({ request: request({ version: 1, summary }), env: {} });
  assert.equal(response.status, 503);
});
