// Per-address hourly limit and a site-wide daily cap for /api/ai/layout,
// because every call costs DeepSeek tokens. With a Workers KV namespace bound
// as AI_LIMITS the counts are shared across Cloudflare's servers (KV is
// eventually consistent, so the limits are approximate); without it each
// server instance counts in memory, which is weaker but never fails a call.
// "Today" is a Beijing-time day, since the users are in China.
const HOUR_MS = 60 * 60 * 1000;
const BEIJING_OFFSET_MS = 8 * HOUR_MS;

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

export function createRateLimiter({ now = () => Date.now() } = {}) {
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

  const kvStore = kv => ({
    async get(key) {
      return Number(await kv.get(key)) || 0;
    },
    async put(key, count, ttlSeconds) {
      await kv.put(key, String(count), { expirationTtl: ttlSeconds });
    },
  });

  return {
    async take(address, env = {}) {
      const usesKv = typeof env.AI_LIMITS?.get === 'function' && typeof env.AI_LIMITS?.put === 'function';
      const store = usesKv ? kvStore(env.AI_LIMITS) : memoryStore;
      const mode = usesKv ? 'kv' : 'memory';
      const limits = readLimits(env);
      const { hourKey, dayKey } = bucketKeys(address, now());
      const [hourCount, dayCount] = await Promise.all([store.get(hourKey), store.get(dayKey)]);
      if (dayCount >= limits.dailyTotal) return { allowed: false, mode, scope: 'day' };
      if (hourCount >= limits.perAddressHourly) return { allowed: false, mode, scope: 'hour' };
      // KV needs a TTL of at least 60 s; keep each count a little past its window.
      await Promise.all([store.put(hourKey, hourCount + 1, 2 * 60 * 60), store.put(dayKey, dayCount + 1, 2 * 24 * 60 * 60)]);
      return { allowed: true, mode, scope: null };
    },
  };
}
