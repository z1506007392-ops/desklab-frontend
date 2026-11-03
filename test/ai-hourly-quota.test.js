import test from 'node:test';
import assert from 'node:assert/strict';

import { createLayoutHandler } from '../server/ai/layout-handler.js';
import { createRateLimiter } from '../server/ai/rate-limit.js';

const summary = { room: { length: 4, width: 3.5, height: 2.7 }, objects: [] };

function clock(start) {
  let time = Date.parse(start);
  return {
    now: () => time,
    advance(ms) { time += ms; },
    set(iso) { time = Date.parse(iso); },
  };
}

function completion() {
  return new Response(JSON.stringify({
    model: 'deepseek-chat',
    choices: [{ message: { content: '{"suggestions":[]}' } }],
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

function askWith(handler, env, ip = '203.0.113.8') {
  return handler({
    request: new Request('https://desklab.test/api/ai/layout', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'CF-Connecting-IP': ip },
      body: JSON.stringify({ version: 1, summary, goal: '' }),
    }),
    env,
  });
}

test('an hourly refusal does not spend that email’s daily allowance', async () => {
  const limiter = createRateLimiter({ now: () => Date.parse('2026-10-30T02:10:00Z') });
  let takeUserCalls = 0;
  const rateLimiter = {
    take: (address, env) => limiter.take(address, env),
    takeUser: async (email, env) => {
      takeUserCalls += 1;
      return limiter.takeUser(email, env);
    },
    readUser: (email, env) => limiter.readUser(email, env),
  };
  const environment = { DEEPSEEK_API_KEY: 'sk-test', AI_PER_IP_HOURLY: '1', AI_DAILY_PER_USER: '20' };
  let upstream = 0;
  const handler = createLayoutHandler({
    rateLimiter,
    sessionOf: async () => ({ email: 'a@b.cn' }),
    logger: { log() {} },
    fetchImpl: async () => {
      upstream += 1;
      return completion();
    },
  });
  const first = await askWith(handler, environment);
  assert.equal(first.status, 200);
  assert.equal((await first.json()).remaining, 19);
  assert.equal(first.headers.get('X-AI-Limit-Mode'), 'memory');
  assert.equal(takeUserCalls, 1);
  const before = await limiter.readUser('a@b.cn', environment);
  const blocked = await askWith(handler, environment);
  const blockedBody = await blocked.json();
  assert.equal(blocked.status, 429);
  assert.equal(blockedBody.message, '用得太频繁了，请一小时后再试');
  assert.equal(blockedBody.remaining, before.remaining);
  assert.equal(blocked.headers.get('X-AI-Limit-Mode'), 'memory');
  assert.equal(takeUserCalls, 1);
  assert.equal(upstream, 1);
  assert.equal((await limiter.readUser('a@b.cn', environment)).remaining, 19);
});

test('the daily allowance starts again at Beijing midnight', async () => {
  const time = clock('2026-10-30T15:59:00.000Z');
  const rateLimiter = createRateLimiter({ now: time.now });
  const environment = { DEEPSEEK_API_KEY: 'sk-test', AI_DAILY_PER_USER: '1', AI_PER_IP_HOURLY: '100' };
  let upstream = 0;
  const handler = createLayoutHandler({
    rateLimiter,
    sessionOf: async () => ({ email: 'a@b.cn' }),
    logger: { log() {} },
    fetchImpl: async () => {
      upstream += 1;
      return completion();
    },
  });
  const first = await askWith(handler, environment);
  assert.equal(first.status, 200);
  assert.equal((await first.json()).remaining, 0);
  const blocked = await askWith(handler, environment);
  const blockedBody = await blocked.json();
  assert.equal(blocked.status, 429);
  assert.equal(blockedBody.message, '今天的 AI 次数用完了，明天再试');
  assert.equal(blockedBody.remaining, 0);
  assert.equal(blocked.headers.get('X-AI-Limit-Mode'), 'memory');
  assert.equal(upstream, 1);
  time.set('2026-10-30T16:00:00.000Z');
  const nextDay = await askWith(handler, environment);
  assert.equal(nextDay.status, 200);
  assert.equal((await nextDay.json()).remaining, 0);
  assert.equal(upstream, 2);
});
