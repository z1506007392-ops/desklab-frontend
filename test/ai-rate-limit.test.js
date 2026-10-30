import test from 'node:test';
import assert from 'node:assert/strict';

import { createRateLimiter, readLimits } from '../server/ai/rate-limit.js';
import { createLayoutHandler } from '../server/ai/layout-handler.js';

class FakeKv {
  constructor() { this.values = new Map(); this.puts = []; }
  async get(key) { return this.values.get(key) ?? null; }
  async put(key, value, options) { this.values.set(key, value); this.puts.push([key, value, options]); }
}

const clock = start => {
  let time = Date.parse(start);
  return { now: () => time, advance: ms => { time += ms; } };
};

test('limits come from the environment with safe defaults', () => {
  assert.deepEqual(readLimits({}), { perAddressHourly: 20, dailyTotal: 2000 });
  assert.deepEqual(readLimits({ AI_PER_IP_HOURLY: '3', AI_DAILY_TOTAL: '10' }), { perAddressHourly: 3, dailyTotal: 10 });
  assert.deepEqual(readLimits({ AI_PER_IP_HOURLY: '-1', AI_DAILY_TOTAL: 'lots' }), { perAddressHourly: 20, dailyTotal: 2000 });
});

test('without KV, each address gets its hourly allowance in memory', async () => {
  const time = clock('2026-10-30T02:10:00Z');
  const limiter = createRateLimiter({ now: time.now });
  const env = { AI_PER_IP_HOURLY: '2' };
  assert.deepEqual(await limiter.take('1.1.1.1', env), { allowed: true, mode: 'memory', scope: null });
  assert.equal((await limiter.take('1.1.1.1', env)).allowed, true);
  assert.deepEqual(await limiter.take('1.1.1.1', env), { allowed: false, mode: 'memory', scope: 'hour' });
  assert.equal((await limiter.take('2.2.2.2', env)).allowed, true, 'another address has its own allowance');
  time.advance(60 * 60 * 1000);
  assert.equal((await limiter.take('1.1.1.1', env)).allowed, true, 'a new hour starts afresh');
});

test('the daily cap is site-wide and resets at midnight Beijing time', async () => {
  // 15:59 UTC is 23:59 in Beijing.
  const time = clock('2026-10-30T15:59:00Z');
  const limiter = createRateLimiter({ now: time.now });
  const env = { AI_DAILY_TOTAL: '2', AI_PER_IP_HOURLY: '100' };
  assert.equal((await limiter.take('a', env)).allowed, true);
  assert.equal((await limiter.take('b', env)).allowed, true);
  assert.deepEqual(await limiter.take('c', env), { allowed: false, mode: 'memory', scope: 'day' });
  time.advance(2 * 60 * 1000);
  assert.equal((await limiter.take('c', env)).allowed, true, '00:01 in Beijing is a new day');
});

test('with a KV namespace bound as AI_LIMITS, counts live in KV with expiry', async () => {
  const kv = new FakeKv();
  const time = clock('2026-10-30T02:10:00Z');
  const limiter = createRateLimiter({ now: time.now });
  const env = { AI_LIMITS: kv, AI_PER_IP_HOURLY: '1' };
  assert.deepEqual(await limiter.take('9.9.9.9', env), { allowed: true, mode: 'kv', scope: null });
  assert.deepEqual(await limiter.take('9.9.9.9', env), { allowed: false, mode: 'kv', scope: 'hour' });
  assert.ok(kv.puts.every(([, value, options]) => /^\d+$/.test(value) && options.expirationTtl >= 60));
  assert.ok(kv.puts.some(([key]) => key === 'ai:day:2026-10-30'));
  // A second server instance sees the same counts.
  assert.equal((await createRateLimiter({ now: time.now }).take('9.9.9.9', env)).allowed, false);
});

test('the endpoint explains which limit was hit', async () => {
  const env = { DEEPSEEK_API_KEY: 'sk-x', AI_PER_IP_HOURLY: '1' };
  const handler = createLayoutHandler({
    rateLimiter: createRateLimiter(),
    logger: { log() {} },
    fetchImpl: async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"suggestions":[]}' } }] })),
  });
  const ask = () => handler({
    request: new Request('https://desklab.test/api/ai/layout', {
      method: 'POST', headers: { 'CF-Connecting-IP': '5.5.5.5' }, body: JSON.stringify({ version: 1, summary: {} }),
    }),
    env,
  });
  assert.equal((await ask()).status, 200);
  const limited = await ask();
  assert.equal(limited.status, 429);
  assert.deepEqual(await limited.json(), { error: 'ai_rate_limited', message: '用得太频繁了，请一小时后再试' });
});
