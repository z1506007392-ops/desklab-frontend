// Limits for /api/ai/layout and for login codes.
// "Today" is a Beijing-time day, since the users are in China.
//
// Each allowed call stores a new KV key under that window's prefix. One
// shared counter key does not add up during a burst: KV caches reads.
// list() can lag too, so the colo Cache API keeps the same count where this
// request landed. The decision uses whichever number is higher. The header
// stays "kv" when the AI_LIMITS binding is what was written.
// Without the binding, this isolate counts in memory.
const HOUR_MS = 60 * 60 * 1000;
const BEIJING_OFFSET_MS = 8 * HOUR_MS;
const HOUR_TTL_SECONDS = 2 * 60 * 60;
const DAY_TTL_SECONDS = 2 * 24 * 60 * 60;
const LIST_PAGE = 1000;

function positiveInt(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

export function readLimits(env = {}) {
  return {
    perAddressHourly: positiveInt(env.AI_PER_IP_HOURLY, 20),
    perUserDaily: positiveInt(env.AI_DAILY_PER_USER, 20),
  };
}

export function beijingDay(time) {
  return new Date(time + BEIJING_OFFSET_MS).toISOString().slice(0, 10);
}

export function hourBucket(time) {
  return Math.floor(time / HOUR_MS);
}

function edgeCacheOf(injected) {
  const source = injected ?? globalThis.caches;
  const cache = source?.default;
  if (!cache || typeof cache.match !== 'function' || typeof cache.put !== 'function') return null;
  return cache;
}

function edgeRequest(prefix) {
  // Not the public site host: this key is only for caches.default.
  return new Request(`https://ai-limits.desklab.internal/v1/${encodeURIComponent(prefix)}`);
}

async function readEdgeCount(cache, prefix) {
  if (!cache) return 0;
  try {
    const hit = await cache.match(edgeRequest(prefix));
    if (!hit) return 0;
    const count = Number(await hit.text());
    return Number.isInteger(count) && count > 0 ? count : 0;
  } catch {
    return 0;
  }
}

async function writeEdgeCount(cache, prefix, count, ttlSeconds) {
  if (!cache) return;
  try {
    await cache.put(edgeRequest(prefix), new Response(String(count), {
      headers: {
        'cache-control': `public, max-age=${ttlSeconds}`,
        'content-type': 'text/plain;charset=UTF-8',
      },
    }));
  } catch {
    // A missed colo write only slows the burst check. The KV keys remain.
  }
}

async function countPrefix(kv, prefix, stopAt) {
  let count = 0;
  let cursor;
  for (let page = 0; page < 10; page += 1) {
    const listed = await kv.list({ prefix, cursor, limit: LIST_PAGE });
    count += listed?.keys?.length ?? 0;
    if (count >= stopAt) return count;
    const next = listed?.list_complete ? undefined : listed?.cursor;
    if (!next || next === cursor) break;
    cursor = next;
  }
  return count;
}

function usesKv(kv) {
  return Boolean(kv) && typeof kv.put === 'function' && typeof kv.list === 'function';
}

export function createRateLimiter({ now = () => Date.now(), caches: cachesImpl } = {}) {
  const memory = new Map();

  function memoryCount(prefix) {
    const entry = memory.get(prefix);
    return entry && entry.expires > now() ? entry.count : 0;
  }

  async function countOf(env, prefix, limit) {
    const kv = env.AI_LIMITS;
    if (!usesKv(kv)) return { count: memoryCount(prefix), mode: 'memory', cache: null };
    const cache = edgeCacheOf(cachesImpl);
    const [listed, edge] = await Promise.all([
      countPrefix(kv, prefix, limit),
      readEdgeCount(cache, prefix),
    ]);
    return { count: Math.max(listed, edge), mode: 'kv', cache };
  }

  async function consume(env, { prefix, limit, ttlSeconds }) {
    const ttl = Math.max(60, ttlSeconds);
    const { count, mode, cache } = await countOf(env, prefix, limit);
    if (count >= limit) return { allowed: false, mode, count, remaining: 0 };
    const next = count + 1;
    if (mode === 'memory') {
      memory.set(prefix, { count: next, expires: now() + ttl * 1000 });
      if (memory.size > 5000) {
        for (const [storedKey, entry] of memory) if (entry.expires <= now()) memory.delete(storedKey);
      }
    } else {
      await env.AI_LIMITS.put(`${prefix}${crypto.randomUUID()}`, '1', { expirationTtl: ttl });
      await writeEdgeCount(cache, prefix, next, ttl);
    }
    return { allowed: true, mode, count: next, remaining: Math.max(0, limit - next) };
  }

  return {
    consume,
    async read(env, { prefix, limit }) {
      const { count, mode } = await countOf(env, prefix, limit);
      return { count, mode, remaining: Math.max(0, limit - count) };
    },
    // Per-address hourly backstop. Not a site-wide cap.
    async take(address, env = {}) {
      const limits = readLimits(env);
      const prefix = `ai:addr:${address}:${hourBucket(now())}:`;
      const result = await consume(env, { prefix, limit: limits.perAddressHourly, ttlSeconds: HOUR_TTL_SECONDS });
      return { allowed: result.allowed, mode: result.mode, remaining: result.remaining, scope: result.allowed ? null : 'hour' };
    },
    // One allowance per email per Beijing day. Emails do not share a pool.
    async takeUser(email, env = {}) {
      const limits = readLimits(env);
      const prefix = `ai:user:${email}:${beijingDay(now())}:`;
      const result = await consume(env, { prefix, limit: limits.perUserDaily, ttlSeconds: DAY_TTL_SECONDS });
      return { allowed: result.allowed, mode: result.mode, remaining: result.remaining, scope: result.allowed ? null : 'day' };
    },
    async readUser(email, env = {}) {
      const limits = readLimits(env);
      return this.read(env, { prefix: `ai:user:${email}:${beijingDay(now())}:`, limit: limits.perUserDaily });
    },
  };
}
