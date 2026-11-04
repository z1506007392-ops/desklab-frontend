// Email-code login for the AI feature. The desk itself stays in the
// browser. Codes, sessions, and send counters live in the AI_LIMITS KV
// binding when it is present, and in this isolate's memory otherwise.
import { uniformLoginCode } from '../../src/domain/login-code.js';
import { isDesktopOrigin, statedOrigin } from './desktop-cors.js';
import { beijingDay, createRateLimiter, hourBucket } from './rate-limit.js';
import { mailConfig, sendLoginCode } from './mail.js';

const CODE_TTL_SECONDS = 10 * 60;
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
// Outlives every session that existed when the user logged out, and is
// refreshed on the next login. A missing key means generation 0.
const GENERATION_TTL_SECONDS = SESSION_TTL_SECONDS + 24 * 60 * 60;
const SENDS_PER_EMAIL_DAY = 5;
const LOCK_TTL_SECONDS = 60;
const MAX_ATTEMPTS = 5;
const CODE_IP_HOURLY_DEFAULT = 10;
const VERIFY_IP_HOURLY_DEFAULT = 30;
export const SESSION_COOKIE = 'desklab_session';
export const HOST_SESSION_COOKIE = '__Host-desklab_session';

export const AUTH_MESSAGES = Object.freeze({
  auth_unavailable: '登录暂未开放',
  bad_email: '请填写有效的邮箱地址',
  bad_code: '请填写 6 位验证码',
  // One sentence for "just sent", "this email is done today", and "this IP is done".
  send_limited: '发送太频繁，请稍后再试',
  send_failed: '邮件没有发出去，请稍后再试',
  // One sentence for a missing code, a wrong code, and a code that is used up.
  code_rejected: '验证码不对或已失效，请重新获取',
  verify_limited: '发送太频繁，请稍后再试',
});

function positiveInt(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function json(status, body, headers = {}) {
  const { 'set-cookie': setCookie, ...rest } = headers;
  const responseHeaders = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...rest,
  });
  const cookies = setCookie == null ? [] : (Array.isArray(setCookie) ? setCookie : [setCookie]);
  for (const cookie of cookies) responseHeaders.append('set-cookie', cookie);
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

function fail(status, error, extraHeaders) {
  return json(status, { error, message: AUTH_MESSAGES[error] }, extraHeaders);
}

export function normalizeEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (email.length < 3 || email.length > 254) return null;
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) return null;
  return email;
}

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function newCode(randomUint32) {
  const next = randomUint32 || (() => crypto.getRandomValues(new Uint32Array(1))[0]);
  return uniformLoginCode(next);
}

function clientIp(request) {
  const raw = request.headers.get('CF-Connecting-IP') || '';
  const token = raw.split(/[\s,]/).find(Boolean) || '';
  return /^[A-Za-z0-9.:]{1,64}$/.test(token) ? token : 'unknown';
}

// One isolate runs overlapping requests. Chain them per key so a burst
// cannot read the same attempt count twice. KV itself has no compare-and-set.
function createKeyLock() {
  const tails = new Map();
  return function exclusive(key, task) {
    const previous = tails.get(key) || Promise.resolve();
    const run = previous.then(task, task);
    const settled = run.then(() => {}, () => {});
    tails.set(key, settled);
    settled.then(() => {
      if (tails.get(key) === settled) tails.delete(key);
    });
    return run;
  };
}

function cookieValue(request, name) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    if (trimmed.slice(0, eq) === name) return trimmed.slice(eq + 1);
  }
  return '';
}

function sessionCookie(name, token, { secure, maxAge }) {
  // The website cookie stays Lax. desktop-cors.js rewrites this SameSite=Lax
  // token to None, and only for the packaged app's origins. No Domain attribute:
  // the __Host- prefix is rejected by the browser when Domain is set.
  const parts = [`${name}=${token}`, 'HttpOnly', 'SameSite=Lax', 'Path=/', `Max-Age=${maxAge}`];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

// Pages gives the function the public URL, so production https includes Secure.
// Local http omits it; otherwise the browser will not store the cookie.
function isSecureRequest(request) {
  return new URL(request.url).protocol === 'https:';
}

// __Host- requires a cryptographic response, Secure, Path=/, and no Domain.
// The desktop app's dev server is local http, and the packaged app's cookie is
// cross-site (SameSite=None on desklab_session). Renaming that cookie would
// drop existing desktop sessions, so only the website https cookie is prefixed.
export function sessionCookieName(request) {
  if (isSecureRequest(request) && !isDesktopOrigin(statedOrigin(request))) return HOST_SESSION_COOKIE;
  return SESSION_COOKIE;
}

function sessionCookies(request, token, maxAge) {
  const name = sessionCookieName(request);
  const secure = isSecureRequest(request);
  const cookies = [sessionCookie(name, token, { secure: secure || name === HOST_SESSION_COOKIE, maxAge })];
  if (name === HOST_SESSION_COOKIE) {
    cookies.push(sessionCookie(SESSION_COOKIE, '', { secure: true, maxAge: 0 }));
  }
  return cookies;
}

async function readJson(request) {
  const text = await request.text();
  if (text.length > 4096) return null;
  try {
    const body = JSON.parse(text);
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

function memoryKv(memory, now) {
  const live = key => {
    const entry = memory.get(key);
    if (!entry || entry.expires <= now()) {
      memory.delete(key);
      return null;
    }
    return entry;
  };
  return {
    async get(key) {
      return live(key)?.value ?? null;
    },
    async put(key, value, options = {}) {
      const ttl = Number(options.expirationTtl) > 0 ? Number(options.expirationTtl) : 60;
      memory.set(key, { value: String(value), expires: now() + ttl * 1000 });
    },
    async delete(key) {
      memory.delete(key);
    },
    async list({ prefix = '', cursor, limit = 1000 } = {}) {
      const names = [...memory.keys()].filter(key => key.startsWith(prefix) && live(key)).sort();
      const start = cursor ? Number(cursor) : 0;
      const slice = names.slice(start, start + limit);
      const next = start + slice.length;
      const done = next >= names.length;
      return { keys: slice.map(name => ({ name })), list_complete: done, cursor: done ? undefined : String(next) };
    },
  };
}

function safeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

function generationKey(email) {
  return `auth:generation:${email}`;
}

function parseSessionValue(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  if (raw[0] === '{') {
    try {
      const body = JSON.parse(raw);
      const email = normalizeEmail(body?.email);
      const generation = Number(body?.generation);
      if (!email || !Number.isInteger(generation) || generation < 0) return null;
      return { email, generation };
    } catch {
      return null;
    }
  }
  const email = normalizeEmail(raw);
  if (email !== raw) return null;
  return { email, generation: 0 };
}

async function readGeneration(store, email) {
  const raw = await store.get(generationKey(email));
  if (raw == null || raw === '') return 0;
  const number = Number(raw);
  return Number.isInteger(number) && number >= 0 ? number : 0;
}

export function createAuthHandlers({
  fetchImpl = (...args) => fetch(...args),
  now = () => Date.now(),
  mail = sendLoginCode,
  rateLimiter = null,
  randomUint32 = null,
} = {}) {
  const memory = new Map();
  const limiter = rateLimiter ?? createRateLimiter({ now });
  const exclusive = createKeyLock();

  function storeFor(env) {
    const kv = env?.AI_LIMITS;
    if (kv && typeof kv.get === 'function' && typeof kv.put === 'function' && typeof kv.delete === 'function' && typeof kv.list === 'function') {
      return kv;
    }
    return memoryKv(memory, now);
  }

  async function readSession(request, env = {}) {
    const token = cookieValue(request, sessionCookieName(request));
    if (!token) return null;
    const store = storeFor(env);
    const parsed = parseSessionValue(await store.get(`auth:session:${await sha256Hex(token)}`));
    if (!parsed) return null;
    const generation = await readGeneration(store, parsed.email);
    if (parsed.generation !== generation) return null;
    return { email: parsed.email };
  }

  async function issueSession(store, email) {
    return exclusive(`session:${email}`, async () => {
      const generation = await readGeneration(store, email);
      const token = newToken();
      await store.put(`auth:session:${await sha256Hex(token)}`, JSON.stringify({ email, generation }), {
        expirationTtl: SESSION_TTL_SECONDS,
      });
      if (generation > 0) {
        await store.put(generationKey(email), String(generation), { expirationTtl: GENERATION_TTL_SECONDS });
      }
      return token;
    });
  }

  async function remainingFor(email, env) {
    if (!limiter.readUser) return null;
    const quota = await limiter.readUser(email, env);
    return quota.remaining;
  }

  async function requestCode({ request, env = {} }) {
    const body = await readJson(request);
    const email = normalizeEmail(body?.email);
    if (!email) return fail(400, 'bad_email');
    if (!mailConfig(env).configured) return fail(503, 'auth_unavailable');

    const store = storeFor(env);
    const ip = clientIp(request);
    const day = beijingDay(now());
    const hour = hourBucket(now());
    const ipLimit = positiveInt(env.AUTH_CODE_PER_IP_HOURLY, CODE_IP_HOURLY_DEFAULT);
    const lockPrefix = `auth:lock:${email}:`;
    const dailyPrefix = `auth:send:${email}:${day}:`;
    const ipPrefix = `auth:code-ip:${ip}:${hour}:`;
    // Look first, so a refusal does not burn the other allowances.
    const blocked = async (prefix, limit, error) => {
      const current = await limiter.read(env, { prefix, limit });
      return current.count >= limit ? fail(429, error) : null;
    };
    const refusal = await blocked(lockPrefix, 1, 'send_limited')
      || await blocked(dailyPrefix, SENDS_PER_EMAIL_DAY, 'send_limited')
      || await blocked(ipPrefix, ipLimit, 'send_limited');
    if (refusal) return refusal;

    const code = newCode(randomUint32);
    if (!code) return fail(503, 'auth_unavailable');

    const lock = await limiter.consume(env, { prefix: lockPrefix, limit: 1, ttlSeconds: LOCK_TTL_SECONDS });
    if (!lock.allowed) return fail(429, 'send_limited');
    const daily = await limiter.consume(env, { prefix: dailyPrefix, limit: SENDS_PER_EMAIL_DAY, ttlSeconds: 2 * 24 * 60 * 60 });
    if (!daily.allowed) return fail(429, 'send_limited');
    const ipHit = await limiter.consume(env, { prefix: ipPrefix, limit: ipLimit, ttlSeconds: 2 * 60 * 60 });
    if (!ipHit.allowed) return fail(429, 'send_limited');

    const record = JSON.stringify({ hash: await sha256Hex(`${email}:${code}`), attempts: 0 });
    await store.put(`auth:code:${email}`, record, { expirationTtl: CODE_TTL_SECONDS });
    const sent = await mail({ fetchImpl, env, to: email, code });
    if (!sent.ok) {
      await store.delete(`auth:code:${email}`);
      return fail(502, 'send_failed');
    }
    return json(200, { ok: true });
  }

  function rejectCode() {
    return fail(400, 'code_rejected');
  }

  async function verify({ request, env = {} }) {
    const body = await readJson(request);
    const email = normalizeEmail(body?.email);
    const code = typeof body?.code === 'string' ? body.code.trim() : '';
    if (!email) return fail(400, 'bad_email');
    if (!/^\d{6}$/.test(code)) return fail(400, 'bad_code');

    const ip = clientIp(request);
    const verifyLimit = positiveInt(env.AUTH_VERIFY_PER_IP_HOURLY, VERIFY_IP_HOURLY_DEFAULT);
    const ipHit = await exclusive(`verify-ip:${ip}`, () => limiter.consume(env, {
      prefix: `auth:verify-ip:${ip}:${hourBucket(now())}:`,
      limit: verifyLimit,
      ttlSeconds: 2 * 60 * 60,
    }));
    if (!ipHit.allowed) return fail(429, 'verify_limited');

    return exclusive(`verify:${email}`, () => checkCode({ request, env, email, code }));
  }

  async function checkCode({ request, env, email, code }) {
    const store = storeFor(env);
    const key = `auth:code:${email}`;
    const raw = await store.get(key);
    if (!raw) return rejectCode();
    let record;
    try {
      record = JSON.parse(raw);
    } catch {
      record = null;
    }
    if (!record || typeof record.hash !== 'string') return rejectCode();
    const attempts = Number(record.attempts) || 0;
    if (attempts >= MAX_ATTEMPTS) return rejectCode();
    const expected = await sha256Hex(`${email}:${code}`);
    if (!safeEqual(record.hash, expected)) {
      const next = JSON.stringify({ hash: record.hash, attempts: attempts + 1 });
      await store.put(key, next, { expirationTtl: CODE_TTL_SECONDS });
      return rejectCode();
    }

    await store.delete(key);
    const token = await issueSession(store, email);
    const remaining = await remainingFor(email, env);
    return json(200, { email, remaining }, {
      'set-cookie': sessionCookies(request, token, SESSION_TTL_SECONDS),
    });
  }

  async function me({ request, env = {} }) {
    const session = await readSession(request, env);
    if (!session) return json(200, { email: null, remaining: null });
    return json(200, { email: session.email, remaining: await remainingFor(session.email, env) });
  }

  async function logout({ request, env = {} }) {
    const store = storeFor(env);
    const token = cookieValue(request, sessionCookieName(request));
    if (token) {
      const key = `auth:session:${await sha256Hex(token)}`;
      const parsed = parseSessionValue(await store.get(key));
      if (parsed) {
        await exclusive(`session:${parsed.email}`, async () => {
          const current = parseSessionValue(await store.get(key));
          if (!current) return;
          const generation = await readGeneration(store, current.email);
          // Only a session from the current generation can move it forward.
          // An already-dead cookie must not sign out a newer login.
          if (current.generation === generation) {
            await store.put(generationKey(current.email), String(generation + 1), {
              expirationTtl: GENERATION_TTL_SECONDS,
            });
          }
          await store.delete(key);
        });
      } else {
        await store.delete(key);
      }
    }
    return json(200, { ok: true }, {
      'set-cookie': sessionCookies(request, '', 0),
    });
  }

  return { requestCode, verify, me, logout, readSession };
}
