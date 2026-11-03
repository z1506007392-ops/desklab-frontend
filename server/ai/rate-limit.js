// Per-address hourly limit and a site-wide daily cap for /api/ai/layout,
// because every call costs DeepSeek tokens. "Today" is a Beijing-time day,
// since the users are in China.
//
// With a Workers KV namespace bound as AI_LIMITS (put and list), each allowed
// call stores a new key under that window's prefix. One shared counter key
// does not add up during a burst: KV caches reads, and writing the same key
// again does not move the number the next request sees. list() can lag too,
// so the colo Cache API keeps the same count where this request landed. The
// decision uses whichever number is higher, and the header stays "kv".
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
    dailyTotal: positiveInt(env.AI_DAILY_TOTAL, 2000),
  };
}

function bucketKeys(address, time) {
  const hour = Math.floor(time / HOUR_MS);
  const day = new Date(time + BEIJING_OFFSET_MS).toISOString().slice(0, 10);
  return { hourKey: `ai:addr:${address}:${hour}`, dayKey: `ai:day:${day}` };
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

export function createRateLimiter({ now = () => Date.now(), caches: cachesImpl } = {}) {
  const memory = new Map();

  const memoryStore = {
    async get(key) {
      const entry = memory.get(key);
      return entry && entry.expires > now() ? entry.count : 0;
    },
    async put(key, count, ttlSeconds) {
      memory.set(key, { count, expires: now() + ttlSeconds * 1000 });
      if (memory.size > 5000) {
        for (const [storedKey, entry] of memory) if (entry.expires <= now()) memory.delete(storedKey);
      }
    },
  };

  return {
    async take(address, env = {}) {
      const kv = env.AI_LIMITS;
      const usesKv = Boolean(kv) && typeof kv.put === 'function' && typeof kv.list === 'function';
      const limits = readLimits(env);
      const { hourKey, dayKey } = bucketKeys(address, now());
      const mode = usesKv ? 'kv' : 'memory';

      const readCounts = async () => {
        if (!usesKv) {
          const [hourCount, dayCount] = await Promise.all([memoryStore.get(hourKey), memoryStore.get(dayKey)]);
          return { hourCount, dayCount };
        }
        const cache = edgeCacheOf(cachesImpl);
        const hourPrefix = `${hourKey}:`;
        const dayPrefix = `${dayKey}:`;
        const [hourListed, dayListed, hourEdge, dayEdge] = await Promise.all([
          countPrefix(kv, hourPrefix, limits.perAddressHourly),
          countPrefix(kv, dayPrefix, limits.dailyTotal),
          readEdgeCount(cache, hourPrefix),
          readEdgeCount(cache, dayPrefix),
        ]);
        return {
          hourCount: Math.max(hourListed, hourEdge),
          dayCount: Math.max(dayListed, dayEdge),
          cache,
          hourPrefix,
          dayPrefix,
        };
      };

      const counts = await readCounts();
      if (counts.dayCount >= limits.dailyTotal) return { allowed: false, mode, scope: 'day' };
      if (counts.hourCount >= limits.perAddressHourly) return { allowed: false, mode, scope: 'hour' };

      if (!usesKv) {
        await Promise.all([
          memoryStore.put(hourKey, counts.hourCount + 1, HOUR_TTL_SECONDS),
          memoryStore.put(dayKey, counts.dayCount + 1, DAY_TTL_SECONDS),
        ]);
        return { allowed: true, mode, scope: null };
      }

      const marker = crypto.randomUUID();
      await Promise.all([
        kv.put(`${counts.hourPrefix}${marker}`, '1', { expirationTtl: HOUR_TTL_SECONDS }),
        kv.put(`${counts.dayPrefix}${marker}`, '1', { expirationTtl: DAY_TTL_SECONDS }),
        writeEdgeCount(counts.cache, counts.hourPrefix, counts.hourCount + 1, HOUR_TTL_SECONDS),
        writeEdgeCount(counts.cache, counts.dayPrefix, counts.dayCount + 1, DAY_TTL_SECONDS),
      ]);
      return { allowed: true, mode, scope: null };
    },
  };
}
