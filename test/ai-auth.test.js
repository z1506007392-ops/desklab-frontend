import test from 'node:test';
import assert from 'node:assert/strict';

import { LOGIN_CODE_ROLL_LIMIT } from '../src/domain/login-code.js';
import { createAuthHandlers, normalizeEmail, sessionCookieName, sha256Hex } from '../server/ai/auth.js';
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

function setup({ time = clock('2026-10-30T02:10:00Z'), env = mailEnv, mail, randomUint32 = null } = {}) {
  const kv = new FakeKv(time.now);
  const sent = [];
  const handlers = createAuthHandlers({
    now: time.now,
    rateLimiter: createRateLimiter({ now: time.now }),
    mail: mail ?? (async ({ to, code }) => { sent.push({ to, code }); return { ok: true }; }),
    randomUint32,
  });
  return { kv, sent, time, env: { ...env, AI_LIMITS: kv }, ...handlers };
}

function cookieToken(response) {
  const header = response.headers.get('set-cookie') || '';
  return header.match(/desklab_session=([0-9a-f]+)/)?.[1] || '';
}

function websiteCookie(token) {
  return `__Host-desklab_session=${token}`;
}

test('a rejected roll is discarded before the code is mailed', async () => {
  const rolls = [LOGIN_CODE_ROLL_LIMIT, 0xFFFFFFFF, 42];
  const rig = setup({ randomUint32: () => rolls.shift() });
  const response = await rig.requestCode({
    request: post('https://desklab.test/api/auth/request-code', { email: 'a@b.cn' }),
    env: rig.env,
  });
  assert.equal(response.status, 200);
  assert.equal(rig.sent[0].code, '000042');
  assert.equal(rolls.length, 0);
  assert.notEqual(rig.sent[0].code, String(0xFFFFFFFF % 1000000).padStart(6, '0'));
});

test('eight rejected rolls do not fall back to modulo or send mail', async () => {
  const rig = setup({ randomUint32: () => 0xFFFFFFFF });
  const response = await rig.requestCode({
    request: post('https://desklab.test/api/auth/request-code', { email: 'a@b.cn' }),
    env: rig.env,
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).message, '登录暂未开放');
  assert.equal(rig.sent.length, 0);
  assert.equal(await rig.kv.get('auth:code:a@b.cn'), null);
  assert.equal(rig.kv.puts.some(([key]) => String(key).startsWith('auth:lock:')), false);
});

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
  assert.deepEqual(await missed.json(), { error: 'code_rejected', message: '验证码不对或已失效，请重新获取' });
  assert.equal(missed.headers.get('x-content-type-options'), 'nosniff');

  const ok = await rig.verify({
    request: post('https://desklab.test/api/auth/verify', { email: 'user@example.com', code: rig.sent[0].code }),
    env: rig.env,
  });
  assert.equal(ok.status, 200);
  const cookie = ok.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
  assert.equal(/SameSite=None/i.test(cookie), false);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /Path=\//);
  assert.match(cookie, /Max-Age=2592000/);
  assert.equal(/Domain=/i.test(cookie), false);
  const issued = ok.headers.getSetCookie();
  assert.equal(issued.length, 2);
  const token = cookieToken(ok);
  assert.match(issued[0], new RegExp(`^__Host-desklab_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000; Secure$`));
  assert.match(issued[1], /^desklab_session=; HttpOnly; SameSite=Lax; Path=\/; Max-Age=0; Secure$/);
  assert.equal(token.length, 64);
  assert.deepEqual(JSON.parse(await rig.kv.get(`auth:session:${await sha256Hex(token)}`)), {
    email: 'user@example.com',
    generation: 0,
  });
  assert.equal(await rig.kv.get('auth:generation:user@example.com'), null);
  assert.equal(await rig.kv.get('auth:code:user@example.com'), null);
  const body = await ok.json();
  assert.equal(body.email, 'user@example.com');
  assert.equal(body.remaining, 20);

  const ignored = await rig.me({
    request: new Request('https://desklab.test/api/auth/me', { headers: { cookie: `desklab_session=${token}` } }),
    env: rig.env,
  });
  assert.deepEqual(await ignored.json(), { email: null, remaining: null });
  const me = await rig.me({
    request: new Request('https://desklab.test/api/auth/me', { headers: { cookie: websiteCookie(token) } }),
    env: rig.env,
  });
  assert.deepEqual(await me.json(), { email: 'user@example.com', remaining: 20 });

  const gone = await rig.logout({
    request: new Request('https://desklab.test/api/auth/logout', { method: 'POST', headers: { cookie: websiteCookie(token) } }),
    env: rig.env,
  });
  assert.equal(gone.status, 200);
  assert.match(gone.headers.get('set-cookie'), /Max-Age=0/);
  assert.match(gone.headers.get('set-cookie'), /Secure/);
  assert.match(gone.headers.get('set-cookie'), /SameSite=Lax/i);
  assert.deepEqual(gone.headers.getSetCookie(), [
    '__Host-desklab_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0; Secure',
    'desklab_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0; Secure',
  ]);
  assert.equal(gone.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(await rig.kv.get(`auth:session:${await sha256Hex(token)}`), null);
  const after = await rig.me({ request: new Request('https://desklab.test/api/auth/me'), env: rig.env });
  assert.deepEqual(await after.json(), { email: null, remaining: null });
});

test('the host prefix is only for website https', () => {
  const site = 'https://desklab-frontend.pages.dev/api/auth/verify';
  assert.equal(sessionCookieName(new Request(site)), '__Host-desklab_session');
  assert.equal(sessionCookieName(new Request(site, { headers: { origin: 'https://desklab-frontend.pages.dev' } })), '__Host-desklab_session');
  assert.equal(sessionCookieName(new Request('http://127.0.0.1:3001/api/auth/verify')), 'desklab_session');
  for (const origin of ['tauri://localhost', 'http://tauri.localhost', 'https://tauri.localhost']) {
    assert.equal(sessionCookieName(new Request(site, { headers: { origin } })), 'desklab_session', origin);
    assert.equal(sessionCookieName(new Request('http://127.0.0.1:3001/api/auth/verify', { headers: { origin } })), 'desklab_session', origin);
  }
});

test('a desktop origin keeps the unprefixed cookie and does not read the host name', async () => {
  const rig = setup();
  const origin = 'tauri://localhost';
  await rig.requestCode({
    request: post('https://desklab-frontend.pages.dev/api/auth/request-code', { email: 'a@b.cn' }, { origin }),
    env: rig.env,
  });
  const ok = await rig.verify({
    request: post('https://desklab-frontend.pages.dev/api/auth/verify', { email: 'a@b.cn', code: rig.sent[0].code }, { origin }),
    env: rig.env,
  });
  const cookies = ok.headers.getSetCookie();
  assert.equal(cookies.length, 1);
  const token = cookieToken(ok);
  assert.match(cookies[0], new RegExp(`^desklab_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000; Secure$`));
  assert.equal(cookies[0].includes('__Host-'), false);
  const me = cookie => rig.me({
    request: new Request('https://desklab-frontend.pages.dev/api/auth/me', { headers: { origin, cookie } }),
    env: rig.env,
  });
  assert.equal((await (await me(`desklab_session=${token}`)).json()).email, 'a@b.cn');
  assert.equal((await (await me(websiteCookie(token))).json()).email, null);
});

test('an old website cookie cannot sign in or end the host session', async () => {
  const rig = setup();
  await rig.requestCode({
    request: post('https://desklab.test/api/auth/request-code', { email: 'a@b.cn' }),
    env: rig.env,
  });
  const ok = await rig.verify({
    request: post('https://desklab.test/api/auth/verify', { email: 'a@b.cn', code: rig.sent[0].code }),
    env: rig.env,
  });
  const token = cookieToken(ok);
  const stale = await rig.logout({
    request: new Request('https://desklab.test/api/auth/logout', {
      method: 'POST',
      headers: { cookie: `desklab_session=${token}` },
    }),
    env: rig.env,
  });
  assert.equal(stale.status, 200);
  assert.equal(await rig.kv.get('auth:generation:a@b.cn'), null);
  assert.deepEqual(JSON.parse(await rig.kv.get(`auth:session:${await sha256Hex(token)}`)), {
    email: 'a@b.cn',
    generation: 0,
  });
  const me = await rig.me({
    request: new Request('https://desklab.test/api/auth/me', { headers: { cookie: websiteCookie(token) } }),
    env: rig.env,
  });
  assert.equal((await me.json()).email, 'a@b.cn');
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
  assert.match(cookie, /^desklab_session=/);
  assert.equal(cookie.includes('__Host-'), false);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
  assert.equal(/Secure/.test(cookie), false);
  assert.equal(ok.headers.getSetCookie().length, 1);
  const gone = await rig.logout({
    request: new Request('http://127.0.0.1/api/auth/logout', { method: 'POST', headers: { cookie: `desklab_session=${cookieToken(ok)}` } }),
    env: rig.env,
  });
  assert.equal(/Secure/.test(gone.headers.get('set-cookie')), false);
  assert.match(gone.headers.get('set-cookie'), /SameSite=Lax/i);
});

test('logging out ends every session for that email and leaves other emails signed in', async () => {
  const time = clock('2026-10-30T02:10:00Z');
  const rig = setup({ time });
  const open = async email => {
    const sent = await rig.requestCode({
      request: post('https://desklab.test/api/auth/request-code', { email }),
      env: rig.env,
    });
    assert.equal(sent.status, 200, email);
    const response = await rig.verify({
      request: post('https://desklab.test/api/auth/verify', { email, code: rig.sent.at(-1).code }),
      env: rig.env,
    });
    assert.equal(response.status, 200, email);
    return cookieToken(response);
  };
  const me = token => rig.me({
    request: new Request('https://desklab.test/api/auth/me', { headers: { cookie: websiteCookie(token) } }),
    env: rig.env,
  });
  const first = await open('a@b.cn');
  time.advance(61 * 1000);
  const second = await open('a@b.cn');
  const other = await open('c@b.cn');
  const legacyToken = 'cd'.repeat(32);
  await rig.kv.put(`auth:session:${await sha256Hex(legacyToken)}`, 'a@b.cn', { expirationTtl: 3600 });
  assert.equal((await (await me(legacyToken)).json()).email, 'a@b.cn');
  assert.equal(await rig.kv.get('auth:generation:a@b.cn'), null);

  const gone = await rig.logout({
    request: new Request('https://desklab.test/api/auth/logout', {
      method: 'POST',
      headers: { cookie: websiteCookie(first) },
    }),
    env: rig.env,
  });
  assert.equal(gone.status, 200);
  assert.equal((await (await me(first)).json()).email, null);
  assert.equal((await (await me(second)).json()).email, null);
  assert.equal((await (await me(legacyToken)).json()).email, null);
  assert.equal((await (await me(other)).json()).email, 'c@b.cn');
  assert.equal(await rig.kv.get(`auth:session:${await sha256Hex(first)}`), null);
  assert.deepEqual(JSON.parse(await rig.kv.get(`auth:session:${await sha256Hex(second)}`)), {
    email: 'a@b.cn',
    generation: 0,
  });
  assert.equal(await rig.kv.get('auth:generation:a@b.cn'), '1');
  assert.equal(await rig.kv.get('auth:generation:c@b.cn'), null);
  const generationPut = rig.kv.puts.filter(([key]) => key === 'auth:generation:a@b.cn').at(-1);
  assert.equal(generationPut[2].expirationTtl, 30 * 24 * 60 * 60 + 24 * 60 * 60);

  time.advance(61 * 1000);
  const again = await open('a@b.cn');
  assert.equal((await (await me(again)).json()).email, 'a@b.cn');
  assert.equal((await (await me(second)).json()).email, null);
  assert.equal((await (await me(other)).json()).email, 'c@b.cn');
  assert.deepEqual(JSON.parse(await rig.kv.get(`auth:session:${await sha256Hex(again)}`)), {
    email: 'a@b.cn',
    generation: 1,
  });

  const stale = await rig.logout({
    request: new Request('https://desklab.test/api/auth/logout', {
      method: 'POST',
      headers: { cookie: websiteCookie(legacyToken) },
    }),
    env: rig.env,
  });
  assert.equal(stale.status, 200);
  assert.equal(await rig.kv.get('auth:generation:a@b.cn'), '1');
  assert.equal((await (await me(again)).json()).email, 'a@b.cn');
  assert.equal(await rig.kv.get(`auth:session:${await sha256Hex(legacyToken)}`), null);
});

test('two logouts still leave that email signed out everywhere', async () => {
  const time = clock('2026-10-30T02:10:00Z');
  const rig = setup({ time });
  const open = async email => {
    assert.equal((await rig.requestCode({
      request: post('https://desklab.test/api/auth/request-code', { email }),
      env: rig.env,
    })).status, 200);
    const response = await rig.verify({
      request: post('https://desklab.test/api/auth/verify', { email, code: rig.sent.at(-1).code }),
      env: rig.env,
    });
    return cookieToken(response);
  };
  const first = await open('a@b.cn');
  time.advance(61 * 1000);
  const second = await open('a@b.cn');
  const leave = token => rig.logout({
    request: new Request('https://desklab.test/api/auth/logout', {
      method: 'POST',
      headers: { cookie: websiteCookie(token) },
    }),
    env: rig.env,
  });
  const responses = await Promise.all([leave(first), leave(second)]);
  assert.deepEqual(responses.map(response => response.status), [200, 200]);
  const me = token => rig.me({
    request: new Request('https://desklab.test/api/auth/me', { headers: { cookie: websiteCookie(token) } }),
    env: rig.env,
  });
  assert.equal((await (await me(first)).json()).email, null);
  assert.equal((await (await me(second)).json()).email, null);
  assert.equal(await rig.kv.get('auth:generation:a@b.cn'), '1');
});

test('logging out without a live session does not move any generation', async () => {
  const rig = setup();
  const empty = await rig.logout({
    request: new Request('https://desklab.test/api/auth/logout', { method: 'POST' }),
    env: rig.env,
  });
  assert.equal(empty.status, 200);
  const unknown = 'ab'.repeat(32);
  await rig.kv.put(`auth:session:${await sha256Hex(unknown)}`, 'not-an-email', { expirationTtl: 60 });
  const junk = await rig.logout({
    request: new Request('https://desklab.test/api/auth/logout', {
      method: 'POST',
      headers: { cookie: websiteCookie(unknown) },
    }),
    env: rig.env,
  });
  assert.equal(junk.status, 200);
  assert.equal(await rig.kv.get(`auth:session:${await sha256Hex(unknown)}`), null);
  assert.equal(rig.kv.puts.some(([key]) => String(key).startsWith('auth:generation:')), false);
});

test('five wrong codes lock the challenge', async () => {
  const rig = setup();
  await rig.requestCode({
    request: post('https://desklab.test/api/auth/request-code', { email: 'a@b.cn' }),
    env: rig.env,
  });
  const wrong = rig.sent[0].code === '111111' ? '222222' : '111111';
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const response = await rig.verify({
      request: post('https://desklab.test/api/auth/verify', { email: 'a@b.cn', code: wrong }),
      env: rig.env,
    });
    const body = await response.json();
    assert.equal(body.error, 'code_rejected', `attempt ${attempt}`);
    assert.equal(body.message, '验证码不对或已失效，请重新获取');
  }
  assert.equal(JSON.parse(await rig.kv.get('auth:code:a@b.cn')).attempts, 5);
  const tooLate = await rig.verify({
    request: post('https://desklab.test/api/auth/verify', { email: 'a@b.cn', code: rig.sent[0].code }),
    env: rig.env,
  });
  assert.deepEqual(await tooLate.json(), { error: 'code_rejected', message: '验证码不对或已失效，请重新获取' });
  assert.equal(tooLate.status, 400);
});

test('a missing code and a wrong code use the same words', async () => {
  const rig = setup();
  const missing = await rig.verify({
    request: post('https://desklab.test/api/auth/verify', { email: 'a@b.cn', code: '123456' }),
    env: rig.env,
  });
  await rig.requestCode({
    request: post('https://desklab.test/api/auth/request-code', { email: 'a@b.cn' }),
    env: rig.env,
  });
  const wrong = rig.sent[0].code === '123456' ? '654321' : '123456';
  const missed = await rig.verify({
    request: post('https://desklab.test/api/auth/verify', { email: 'a@b.cn', code: wrong }),
    env: rig.env,
  });
  assert.deepEqual(await missing.json(), await missed.json());
});

test('a burst of wrong codes cannot record more than five attempts', async () => {
  const rig = setup();
  await rig.requestCode({
    request: post('https://desklab.test/api/auth/request-code', { email: 'a@b.cn' }),
    env: rig.env,
  });
  const wrong = rig.sent[0].code === '111111' ? '222222' : '111111';
  const responses = await Promise.all(Array.from({ length: 12 }, () => rig.verify({
    request: post('https://desklab.test/api/auth/verify', { email: 'a@b.cn', code: wrong }),
    env: rig.env,
  })));
  const bodies = await Promise.all(responses.map(response => response.json()));
  assert.equal(bodies.every(body => body.error === 'code_rejected'), true);
  assert.equal(JSON.parse(await rig.kv.get('auth:code:a@b.cn')).attempts, 5);
  const late = await rig.verify({
    request: post('https://desklab.test/api/auth/verify', { email: 'a@b.cn', code: rig.sent[0].code }),
    env: rig.env,
  });
  assert.equal(late.status, 400);
  assert.notEqual(await rig.kv.get('auth:code:a@b.cn'), null);
});

test('an address that is verifying too fast does not use up the five tries', async () => {
  const rig = setup({ env: { ...mailEnv, AUTH_VERIFY_PER_IP_HOURLY: '2' } });
  await rig.requestCode({
    request: post('https://desklab.test/api/auth/request-code', { email: 'a@b.cn' }, { 'CF-Connecting-IP': '203.0.113.9' }),
    env: rig.env,
  });
  const wrong = rig.sent[0].code === '111111' ? '222222' : '111111';
  const guess = ip => rig.verify({
    request: post('https://desklab.test/api/auth/verify', { email: 'a@b.cn', code: wrong }, { 'CF-Connecting-IP': ip }),
    env: rig.env,
  });
  assert.equal((await guess('203.0.113.9')).status, 400);
  assert.equal((await guess('203.0.113.9')).status, 400);
  const blocked = await guess('203.0.113.9');
  assert.equal(blocked.status, 429);
  const blockedBody = await blocked.json();
  assert.equal(blockedBody.error, 'verify_limited');
  assert.equal(blockedBody.message, '发送太频繁，请稍后再试');
  assert.equal(JSON.parse(await rig.kv.get('auth:code:a@b.cn')).attempts, 2);
  const ok = await rig.verify({
    request: post('https://desklab.test/api/auth/verify', { email: 'a@b.cn', code: rig.sent[0].code }, { 'CF-Connecting-IP': '203.0.113.10' }),
    env: rig.env,
  });
  assert.equal(ok.status, 200);
});

test('parallel verifies from one address cannot pass the hourly cap', async () => {
  const rig = setup({ env: { ...mailEnv, AUTH_VERIFY_PER_IP_HOURLY: '1' } });
  await rig.requestCode({
    request: post('https://desklab.test/api/auth/request-code', { email: 'a@b.cn' }, { 'CF-Connecting-IP': '203.0.113.40' }),
    env: rig.env,
  });
  const wrong = rig.sent[0].code === '111111' ? '222222' : '111111';
  const responses = await Promise.all(Array.from({ length: 8 }, () => rig.verify({
    request: post('https://desklab.test/api/auth/verify', { email: 'a@b.cn', code: wrong }, { 'CF-Connecting-IP': '203.0.113.40' }),
    env: rig.env,
  })));
  const statuses = responses.map(response => response.status).sort();
  assert.deepEqual(statuses, [400, 429, 429, 429, 429, 429, 429, 429]);
  assert.equal(JSON.parse(await rig.kv.get('auth:code:a@b.cn')).attempts, 1);
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
  assert.deepEqual(await locked.json(), { error: 'send_limited', message: '发送太频繁，请稍后再试' });
  for (let i = 0; i < 4; i += 1) {
    time.advance(61 * 1000);
    assert.equal((await ask()).status, 200, `send ${i + 2}`);
  }
  time.advance(61 * 1000);
  const daily = await ask();
  assert.equal(daily.status, 429);
  assert.deepEqual(await daily.json(), { error: 'send_limited', message: '发送太频繁，请稍后再试' });
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
  assert.deepEqual(await blocked.json(), { error: 'send_limited', message: '发送太频繁，请稍后再试' });
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
