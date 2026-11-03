import test from 'node:test';
import assert from 'node:assert/strict';

import { createRateLimiter, readLimits } from '../server/ai/rate-limit.js';
import { createLayoutHandler } from '../server/ai/layout-handler.js';

class FakeKv {
  constructor() { this.values = new Map(); this.puts = []; }
  async get(key) { return this.values.get(key) ?? null; }
  async put(key, value, options) { this.values.set(key, value); this.puts.push([key, value, options]); }
  async list({ prefix = '', cursor, limit = 1000 } = {}) {
    const names = [...this.values.keys()].filter(key => key.startsWith(prefix)).sort();
    const start = cursor ? Number(cursor) : 0;
    const slice = names.slice(start, start + limit);
    const next = start + slice.length;
    const done = next >= names.length;
    return { keys: slice.map(name => ({ name })), list_complete: done, cursor: done ? undefined : String(next) };
  }
}

class StaleGetKv extends FakeKv {
  async get() { return '0'; }
}

class StaleListKv extends FakeKv {
  async list() { return { keys: [], list_complete: true }; }
}

function createFakeCaches() {
  const stored = new Map();
  return {
    default: {
      async match(request) {
        const body = stored.get(request.url);
        return body === undefined ? undefined : new Response(body);
      },
      async put(request, response) {
        stored.set(request.url, await response.text());
      },
    },
  };
}

const clock = start => {
  let time = Date.parse(start);
  return { now: () => time, advance: ms => { time += ms; } };
};

test('limits come from the environment with safe defaults', () => {
  assert.deepEqual(readLimits({}), { perAddressHourly: 20, perUserDaily: 20 });
  assert.deepEqual(readLimits({ AI_PER_IP_HOURLY: '3', AI_DAILY_PER_USER: '10' }), { perAddressHourly: 3, perUserDaily: 10 });
  assert.deepEqual(readLimits({ AI_PER_IP_HOURLY: '-1', AI_DAILY_PER_USER: 'lots' }), { perAddressHourly: 20, perUserDaily: 20 });
});

test('without KV, each address gets its hourly allowance in memory', async () => {
  const time = clock('2026-10-30T02:10:00Z');
  const limiter = createRateLimiter({ now: time.now });
  const env = { AI_PER_IP_HOURLY: '2' };
  assert.deepEqual(await limiter.take('1.1.1.1', env), { allowed: true, mode: 'memory', remaining: 1, scope: null });
  assert.equal((await limiter.take('1.1.1.1', env)).allowed, true);
  assert.deepEqual(await limiter.take('1.1.1.1', env), { allowed: false, mode: 'memory', remaining: 0, scope: 'hour' });
  assert.equal((await limiter.take('2.2.2.2', env)).allowed, true, 'another address has its own allowance');
  time.advance(60 * 60 * 1000);
  assert.equal((await limiter.take('1.1.1.1', env)).allowed, true, 'a new hour starts afresh');
});

test('each email has its own daily allowance and there is no site-wide cap', async () => {
  // 15:59 UTC is 23:59 in Beijing.
  const time = clock('2026-10-30T15:59:00Z');
  const limiter = createRateLimiter({ now: time.now });
  const env = { AI_DAILY_PER_USER: '2', AI_PER_IP_HOURLY: '100' };
  assert.equal((await limiter.takeUser('a@b.cn', env)).allowed, true);
  assert.equal((await limiter.takeUser('a@b.cn', env)).allowed, true);
  assert.deepEqual(await limiter.takeUser('a@b.cn', env), { allowed: false, mode: 'memory', remaining: 0, scope: 'day' });
  assert.equal((await limiter.takeUser('c@b.cn', env)).allowed, true, 'another email is not blocked by the first');
  time.advance(2 * 60 * 1000);
  assert.equal((await limiter.takeUser('a@b.cn', env)).allowed, true, '00:01 in Beijing is a new day');
});

test('with a KV namespace bound as AI_LIMITS, counts live in KV with expiry', async () => {
  const kv = new FakeKv();
  const time = clock('2026-10-30T02:10:00Z');
  const limiter = createRateLimiter({ now: time.now });
  const env = { AI_LIMITS: kv, AI_PER_IP_HOURLY: '1' };
  assert.deepEqual(await limiter.take('9.9.9.9', env), { allowed: true, mode: 'kv', remaining: 0, scope: null });
  assert.deepEqual(await limiter.take('9.9.9.9', env), { allowed: false, mode: 'kv', remaining: 0, scope: 'hour' });
  assert.equal(kv.puts.length, 1, 'a refusal does not write another marker');
  assert.ok(kv.puts.every(([, value, options]) => value === '1' && options.expirationTtl >= 60));
  assert.ok(kv.puts.some(([key]) => key.startsWith('ai:addr:9.9.9.9:')));
  // A second server instance sees the same counts.
  assert.equal((await createRateLimiter({ now: time.now }).take('9.9.9.9', env)).allowed, false);
  time.advance(60 * 60 * 1000);
  assert.equal((await limiter.take('9.9.9.9', env)).allowed, true, 'a new hour starts afresh');
});

test('a cached KV get does not reset the count', async () => {
  const kv = new StaleGetKv();
  const time = clock('2026-10-30T02:10:00Z');
  const limiter = createRateLimiter({ now: time.now });
  const env = { AI_LIMITS: kv, AI_PER_IP_HOURLY: '1' };
  assert.equal((await limiter.take('9.9.9.9', env)).allowed, true);
  assert.deepEqual(await limiter.take('9.9.9.9', env), { allowed: false, mode: 'kv', remaining: 0, scope: 'hour' });
});

test('a stale KV list still stops a burst through the colo cache', async () => {
  const kv = new StaleListKv();
  const caches = createFakeCaches();
  const time = clock('2026-10-30T02:10:00Z');
  const env = { AI_LIMITS: kv, AI_PER_IP_HOURLY: '2' };
  const first = createRateLimiter({ now: time.now, caches });
  assert.equal((await first.take('1.1.1.1', env)).allowed, true);
  assert.equal((await first.take('1.1.1.1', env)).allowed, true);
  assert.equal(kv.puts.length, 2);
  // The next isolate in this colo cannot see the KV keys yet.
  const second = createRateLimiter({ now: time.now, caches });
  assert.deepEqual(await second.take('1.1.1.1', env), { allowed: false, mode: 'kv', remaining: 0, scope: 'hour' });
  assert.equal(kv.puts.length, 2);
});

test('KV counts marker keys past the first list page', async () => {
  const kv = new FakeKv();
  for (let i = 0; i < 1500; i += 1) kv.values.set(`ai:user:a@b.cn:2026-10-30:seed-${i}`, '1');
  const time = clock('2026-10-30T02:10:00Z');
  const limiter = createRateLimiter({ now: time.now });
  const env = { AI_LIMITS: kv, AI_DAILY_PER_USER: '1500', AI_PER_IP_HOURLY: '100' };
  assert.equal((await limiter.takeUser('a@b.cn', env)).allowed, false);
});

test('a binding without list stays on the memory counter', async () => {
  const kv = { async get() { return '0'; }, async put() { throw new Error('should not write'); } };
  const limiter = createRateLimiter({ now: () => Date.parse('2026-10-30T02:10:00Z') });
  const env = { AI_LIMITS: kv, AI_PER_IP_HOURLY: '1' };
  assert.deepEqual(await limiter.take('1.1.1.1', env), { allowed: true, mode: 'memory', remaining: 0, scope: null });
  assert.deepEqual(await limiter.take('1.1.1.1', env), { allowed: false, mode: 'memory', remaining: 0, scope: 'hour' });
});

test('the endpoint explains which limit was hit', async () => {
  const env = { DEEPSEEK_API_KEY: 'sk-x', AI_PER_IP_HOURLY: '1' };
  const handler = createLayoutHandler({
    rateLimiter: createRateLimiter(),
    sessionOf: async () => ({ email: 'tester@example.com' }),
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
  assert.deepEqual(await limited.json(), { error: 'ai_rate_limited', message: '用得太频繁了，请一小时后再试', remaining: 19 });
});
