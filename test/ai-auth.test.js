import test from 'node:test';
import assert from 'node:assert/strict';

import { createAuthHandlers, normalizeEmail, sha256Hex } from '../server/ai/auth.js';
import { createRateLimiter } from '../server/ai/rate-limit.js';

class FakeKv {
  constructor(now) { this.values = new Map(); this.puts = []; this.now = now; }
  live(key) {
    const entry = this.values.get(key);
    if (!entry) return null;
    if (entry.expires != null && this.now && entry.expires <= this.now()) {
      this.values.delete(key);
      return null;
    }
    return entry;
  }
  async get(key) { return this.live(key)?.value ?? null; }
  async put(key, value, options = {}) {
    const ttl = Number(options.expirationTtl);
    const expires = this.now && Number.isFinite(ttl) ? this.now() + ttl * 1000 : null;
    this.values.set(key, { value: String(value), expires });
    this.puts.push([key, value, options]);
  }
  async delete(key) { this.values.delete(key); }
  async list({ prefix = '', cursor, limit = 1000 } = {}) {
    const names = [...this.values.keys()].filter(key => key.startsWith(prefix) && this.live(key)).sort();
    const start = cursor ? Number(cursor) : 0;
    const slice = names.slice(start, start + limit);
    const next = start + slice.length;
    const done = next >= names.length;
    return { keys: slice.map(name => ({ name })), list_complete: done, cursor: done ? undefined : String(next) };
  }
}

const mailEnv = { BREVO_API_KEY: 'secret-key', MAIL_FROM: 'login@desklab.test' };

function clock(start) {
  let time = Date.parse(start);
  return { now: () => time, advance: ms => { time += ms; } };
}

function post(url, body, headers = {}) {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

function setup({ time = clock('2026-10-30T02:10:00Z'), env = mailEnv, mail } = {}) {
  const kv = new FakeKv(time.now);
  const sent = [];
  const handlers = createAuthHandlers({
    now: time.now,
    rateLimiter: createRateLimiter({ now: time.now }),
    mail: mail ?? (async ({ to, code }) => { sent.push({ to, code }); return { ok: true }; }),
  });
  return { kv, sent, time, env: { ...env, AI_LIMITS: kv }, ...handlers };
}

function cookieToken(response) {
  const header = response.headers.get('set-cookie') || '';
  return header.match(/desklab_session=([0-9a-f]+)/)?.[1] || '';
}

test('email addresses are trimmed and lowercased, and junk is refused', () => {
  assert.equal(normalizeEmail('  User@Example.com '), 'user@example.com');
  assert.equal(normalizeEmail('not-an-email'), null);
  assert.equal(normalizeEmail(''), null);
  assert.equal(normalizeEmail(null), null);
});

test('without a mail provider, requesting a code says login is not open and stores nothing', async () => {
  let called = false;
  const { kv, requestCode } = setup({
    env: {},
    mail: async () => { called = true; return { ok: true }; },
  });
  const response = await requestCode({
    request: post('https://desklab.test/api/auth/request-code', { email: 'A@B.cn' }),
    env: { AI_LIMITS: kv },
  });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'auth_unavailable', message: '登录暂未开放' });
  assert.equal(called, false);
  assert.equal(kv.puts.length, 0);
  const again = await requestCode({
    request: post('https://desklab.test/api/auth/request-code', { email: 'a@b.cn' }),
    env: { AI_LIMITS: kv },
  });
  assert.equal(again.status, 503);
});

test('a code is stored only as a hash, and the right code opens a 30-day session', async () => {
  const rig = setup();
  const sent = await rig.requestCode({
    request: post('https://desklab.test/api/auth/request-code', { email: ' User@Example.com ' }, { 'CF-Connecting-IP': '1.2.3.4' }),
    env: rig.env,
  });
  assert.equal(sent.status, 200);
  assert.equal(rig.sent[0].to, 'user@example.com');
  assert.match(rig.sent[0].code, /^\d{6}$/);
  const stored = await rig.kv.get('auth:code:user@example.com');
  assert.equal(stored.includes(rig.sent[0].code), false);
  assert.equal(JSON.parse(stored).hash, await sha256Hex(`user@example.com:${rig.sent[0].code}`));
  assert.equal(rig.kv.puts.find(([key]) => key === 'auth:code:user@example.com')[2].expirationTtl, 600);

  const wrong = rig.sent[0].code === '000000' ? '000001' : '000000';
  const missed = await rig.verify({
    request: post('https://desklab.test/api/auth/verify', { email: 'user@example.com', code: wrong }),
    env: rig.env,
  });
  assert.equal(missed.status, 400);
  assert.equal((await missed.json()).message, '验证码不对');

  const ok = await rig.verify({
    request: post('https://desklab.test/api/auth/verify', { email: 'user@example.com', code: rig.sent[0].code }),
    env: rig.env,
  });
  assert.equal(ok.status, 200);
  const cookie = ok.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /Path=\//);
  assert.match(cookie, /Max-Age=2592000/);
  const token = cookieToken(ok);
  assert.equal(token.length, 64);
  assert.equal(await rig.kv.get(`auth:session:${await sha256Hex(token)}`), 'user@example.com');
  assert.equal(await rig.kv.get('auth:code:user@example.com'), null);
  const body = await ok.json();
  assert.equal(body.email, 'user@example.com');
  assert.equal(body.remaining, 20);

  const me = await rig.me({
    request: new Request('https://desklab.test/api/auth/me', { headers: { cookie: `desklab_session=${token}` } }),
    env: rig.env,
  });
  assert.deepEqual(await me.json(), { email: 'user@example.com', remaining: 20 });

  const gone = await rig.logout({
    request: new Request('https://desklab.test/api/auth/logout', { method: 'POST', headers: { cookie: `desklab_session=${token}` } }),
    env: rig.env,
  });
  assert.equal(gone.status, 200);
  assert.match(gone.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal(await rig.kv.get(`auth:session:${await sha256Hex(token)}`), null);
  const after = await rig.me({ request: new Request('https://desklab.test/api/auth/me'), env: rig.env });
  assert.deepEqual(await after.json(), { email: null, remaining: null });
});

test('a local http session cookie is not marked Secure', async () => {
  const rig = setup();
  await rig.requestCode({
    request: post('http://127.0.0.1/api/auth/request-code', { email: 'a@b.cn' }),
    env: rig.env,
  });
  const ok = await rig.verify({
    request: post('http://127.0.0.1/api/auth/verify', { email: 'a@b.cn', code: rig.sent[0].code }),
    env: rig.env,
  });
  const cookie = ok.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/i);
  assert.equal(/Secure/.test(cookie), false);
});

test('five wrong codes lock the challenge', async () => {
  const rig = setup();
  await rig.requestCode({
    request: post('https://desklab.test/api/auth/request-code', { email: 'a@b.cn' }),
    env: rig.env,
  });
  const wrong = rig.sent[0].code === '111111' ? '222222' : '111111';
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await rig.verify({
      request: post('https://desklab.test/api/auth/verify', { email: 'a@b.cn', code: wrong }),
      env: rig.env,
    });
    assert.equal((await response.json()).error, 'code_wrong', `attempt ${attempt}`);
  }
  const locked = await rig.verify({
    request: post('https://desklab.test/api/auth/verify', { email: 'a@b.cn', code: wrong }),
    env: rig.env,
  });
  assert.equal((await locked.json()).message, '验证码错误次数太多，请重新获取');
  const tooLate = await rig.verify({
    request: post('https://desklab.test/api/auth/verify', { email: 'a@b.cn', code: rig.sent[0].code }),
    env: rig.env,
  });
  assert.equal((await tooLate.json()).error, 'code_locked');
});

test('the same email waits a minute and can only ask five times a day', async () => {
  const time = clock('2026-10-30T02:10:00Z');
  const rig = setup({ time });
  const ask = () => rig.requestCode({
    request: post('https://desklab.test/api/auth/request-code', { email: 'a@b.cn' }, { 'CF-Connecting-IP': '9.9.9.9' }),
    env: rig.env,
  });
  assert.equal((await ask()).status, 200);
  const locked = await ask();
  assert.equal(locked.status, 429);
  assert.equal((await locked.json()).error, 'send_lock');
  for (let i = 0; i < 4; i += 1) {
    time.advance(61 * 1000);
    assert.equal((await ask()).status, 200, `send ${i + 2}`);
  }
  time.advance(61 * 1000);
  const daily = await ask();
  assert.equal(daily.status, 429);
  assert.equal((await daily.json()).message, '这个邮箱今天的验证码次数用完了，明天再试');
});

test('one address shares an hourly send cap, and a refusal does not spend the other email', async () => {
  const time = clock('2026-10-30T02:10:00Z');
  const rig = setup({ time, env: { ...mailEnv, AUTH_CODE_PER_IP_HOURLY: '1' } });
  const ask = email => rig.requestCode({
    request: post('https://desklab.test/api/auth/request-code', { email }, { 'CF-Connecting-IP': '8.8.8.8' }),
    env: rig.env,
  });
  assert.equal((await ask('a@b.cn')).status, 200);
  const blocked = await ask('c@b.cn');
  assert.equal(blocked.status, 429);
  assert.equal((await blocked.json()).error, 'send_ip');
  time.advance(60 * 60 * 1000);
  assert.equal((await ask('c@b.cn')).status, 200, 'the refused email still has its daily send');
});

test('a mail failure deletes the code and does not crash', async () => {
  const rig = setup({ mail: async () => ({ ok: false, reason: 'upstream' }) });
  const response = await rig.requestCode({
    request: post('https://desklab.test/api/auth/request-code', { email: 'a@b.cn' }),
    env: rig.env,
  });
  assert.equal(response.status, 502);
  assert.equal((await response.json()).message, '邮件没有发出去，请稍后再试');
  assert.equal(await rig.kv.get('auth:code:a@b.cn'), null);
});

test('the Pages auth routes answer instead of throwing when mail is not configured', async () => {
  const { onRequestPost: requestCode } = await import('../functions/api/auth/request-code.js');
  const { onRequestPost: verify } = await import('../functions/api/auth/verify.js');
  const { onRequestGet: me } = await import('../functions/api/auth/me.js');
  const { onRequestPost: logout } = await import('../functions/api/auth/logout.js');
  const response = await requestCode({
    request: post('https://desklab.test/api/auth/request-code', { email: 'a@b.cn' }),
    env: {},
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).message, '登录暂未开放');
  const signedOut = await me({ request: new Request('https://desklab.test/api/auth/me'), env: {} });
  assert.deepEqual(await signedOut.json(), { email: null, remaining: null });
  assert.equal((await verify({
    request: post('https://desklab.test/api/auth/verify', { email: 'a@b.cn', code: '123456' }),
    env: {},
  })).status, 400);
  assert.equal((await logout({
    request: new Request('https://desklab.test/api/auth/logout', { method: 'POST' }),
    env: {},
  })).status, 200);
});
