import test from 'node:test';
import assert from 'node:assert/strict';

import { createAuthHandlers, sha256Hex } from '../server/ai/auth.js';
import { createLayoutHandler } from '../server/ai/layout-handler.js';
import { createRateLimiter } from '../server/ai/rate-limit.js';

const mailjetEnv = {
  MAILJET_API_KEY: 'mj-public-test',
  MAILJET_API_SECRET: 'mj-private-test',
  MAIL_FROM: 'login@desklab.test',
  DEEPSEEK_API_KEY: 'sk-test-secret',
};

function clock(start) {
  let time = Date.parse(start);
  return {
    now: () => time,
    advance(ms) { time += ms; },
    set(iso) { time = Date.parse(iso); },
  };
}

function post(url, body, headers = {}) {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

function setup({ time = clock('2026-10-30T02:10:00Z'), env = mailjetEnv, mailjetStatus = 'success' } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({
      url,
      headers: init?.headers,
      body: init?.body ? JSON.parse(init.body) : null,
    });
    if (String(url).includes('api.mailjet.com')) {
      if (mailjetStatus === 'throw') throw new Error('network');
      return new Response(JSON.stringify({ Messages: [{ Status: mailjetStatus }] }), { status: 200 });
    }
    if (String(url).includes('api.deepseek.com')) {
      return new Response(JSON.stringify({
        model: 'deepseek-chat',
        choices: [{ message: { content: '{"suggestions":[]}' } }],
      }), { status: 200 });
    }
    return new Response('unexpected', { status: 500 });
  };
  const limiter = createRateLimiter({ now: time.now });
  const auth = createAuthHandlers({ fetchImpl, now: time.now, rateLimiter: limiter });
  const layout = createLayoutHandler({
    fetchImpl,
    rateLimiter: limiter,
    sessionOf: (request, requestEnv) => auth.readSession(request, requestEnv),
    logger: { log() {} },
  });
  return { calls, time, auth, layout, env };
}

function cookieToken(response) {
  return (response.headers.get('set-cookie') || '').match(/desklab_session=([0-9a-f]+)/)?.[1] || '';
}

test('missing mail, and a half-set Mailjet pair, stay closed without calling out', async () => {
  const closed = setup({ env: {} });
  const response = await closed.auth.requestCode({
    request: post('https://desklab.test/api/auth/request-code', { email: 'a@b.cn' }),
    env: closed.env,
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).message, '登录暂未开放');
  assert.equal(closed.calls.length, 0);

  const partial = setup({
    env: { MAILJET_API_KEY: 'only-one', BREVO_API_KEY: 'brevo-test', MAIL_FROM: 'login@desklab.test' },
  });
  const again = await partial.auth.requestCode({
    request: post('https://desklab.test/api/auth/request-code', { email: 'a@b.cn' }),
    env: partial.env,
  });
  assert.equal(again.status, 503);
  assert.equal((await again.json()).message, '登录暂未开放');
  assert.equal(partial.calls.length, 0);
});

test('bad login input is a 400 with the Chinese sentence, not a 500', async () => {
  const rig = setup();
  const cases = [
    [post('https://desklab.test/api/auth/request-code', { email: 'not-an-email' }), '请填写有效的邮箱地址'],
    [new Request('https://desklab.test/api/auth/request-code', { method: 'POST', body: '{' }), '请填写有效的邮箱地址'],
    [new Request('https://desklab.test/api/auth/request-code', { method: 'POST', body: '[]' }), '请填写有效的邮箱地址'],
    [new Request('https://desklab.test/api/auth/request-code', { method: 'POST', body: 'x'.repeat(5000) }), '请填写有效的邮箱地址'],
    [post('https://desklab.test/api/auth/verify', { email: 'a@b.cn', code: '12' }), '请填写 6 位验证码'],
  ];
  for (const [request, message] of cases) {
    const response = await (request.url.endsWith('/verify') ? rig.auth.verify({ request, env: rig.env }) : rig.auth.requestCode({ request, env: rig.env }));
    assert.equal(response.status, 400, message);
    assert.equal((await response.json()).message, message);
  }
  assert.equal(rig.calls.length, 0);
});

test('the login flow sends one Mailjet note, then a cookie, and AI stays closed until then', async () => {
  const rig = setup();
  const summary = { objects: [] };
  const layoutRequest = (cookie) => new Request('https://desklab.test/api/ai/layout', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify({ version: 1, summary }),
  });
  const denied = await rig.layout({ request: layoutRequest(), env: rig.env });
  assert.equal(denied.status, 401);
  assert.deepEqual(await denied.json(), { error: 'auth_required', message: '请先登录后再使用 AI' });
  assert.equal(rig.calls.some(call => String(call.url).includes('deepseek')), false);

  const sent = await rig.auth.requestCode({
    request: post('https://desklab.test/api/auth/request-code', { email: ' User@Example.com ' }, { 'CF-Connecting-IP': '203.0.113.10' }),
    env: rig.env,
  });
  assert.equal(sent.status, 200);
  const mail = rig.calls.find(call => String(call.url).includes('api.mailjet.com'));
  assert.equal(mail.headers.authorization, `Basic ${btoa('mj-public-test:mj-private-test')}`);
  assert.equal(mail.body.Messages[0].TextPart, '你的 DeskLab 登录验证码是 ' + mail.body.Messages[0].TextPart.match(/\d{6}/)[0] + '，10 分钟内有效。');
  assert.equal(JSON.stringify(mail.body).includes('mj-private-test'), false);
  const code = mail.body.Messages[0].TextPart.match(/\d{6}/)[0];

  const locked = await rig.auth.requestCode({
    request: post('https://desklab.test/api/auth/request-code', { email: 'user@example.com' }, { 'CF-Connecting-IP': '203.0.113.10' }),
    env: rig.env,
  });
  assert.equal(locked.status, 429);
  assert.equal((await locked.json()).message, '发送太频繁，请稍后再试');

  const ok = await rig.auth.verify({
    request: post('https://desklab.test/api/auth/verify', { email: 'user@example.com', code }),
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
  assert.equal(await sha256Hex(`user@example.com:${code}`).then(hash => hash.length), 64);
  const body = await ok.json();
  assert.equal(body.email, 'user@example.com');
  assert.equal(body.remaining, 20);

  const allowed = await rig.layout({
    request: layoutRequest(`desklab_session=${token}`),
    env: rig.env,
  });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get('X-AI-Limit-Mode'), 'memory');
  const allowedBody = await allowed.json();
  assert.equal(allowedBody.remaining, 19);
  assert.equal(JSON.stringify(allowedBody).includes('sk-test-secret'), false);
  assert.equal(JSON.stringify(allowedBody).includes('mj-private-test'), false);

  const gone = await rig.auth.logout({
    request: new Request('https://desklab.test/api/auth/logout', {
      method: 'POST',
      headers: { cookie: `desklab_session=${token}` },
    }),
    env: rig.env,
  });
  assert.equal(gone.status, 200);
  assert.match(gone.headers.get('set-cookie'), /desklab_session=/);
  assert.match(gone.headers.get('set-cookie'), /HttpOnly/i);
  assert.match(gone.headers.get('set-cookie'), /Max-Age=0/);
  const after = await rig.layout({ request: layoutRequest(`desklab_session=${token}`), env: rig.env });
  assert.equal(after.status, 401);
  assert.equal((await after.json()).message, '请先登录后再使用 AI');
});

test('one address shares the hourly send cap, and the message is the hourly sentence', async () => {
  const rig = setup({ env: { ...mailjetEnv, AUTH_CODE_PER_IP_HOURLY: '1' } });
  const ask = email => rig.auth.requestCode({
    request: post('https://desklab.test/api/auth/request-code', { email }, { 'CF-Connecting-IP': '198.51.100.8' }),
    env: rig.env,
  });
  assert.equal((await ask('a@b.cn')).status, 200);
  const blocked = await ask('c@b.cn');
  assert.equal(blocked.status, 429);
  assert.equal((await blocked.json()).message, '发送太频繁，请一小时后再试');
  assert.equal(rig.calls.filter(call => String(call.url).includes('mailjet')).length, 1);
});

test('a Mailjet failure deletes the code and answers 502', async () => {
  const rig = setup({ mailjetStatus: 'error' });
  const response = await rig.auth.requestCode({
    request: post('https://desklab.test/api/auth/request-code', { email: 'a@b.cn' }),
    env: rig.env,
  });
  assert.equal(response.status, 502);
  assert.equal((await response.json()).message, '邮件没有发出去，请稍后再试');
  const missed = await rig.auth.verify({
    request: post('https://desklab.test/api/auth/verify', { email: 'a@b.cn', code: '123456' }),
    env: rig.env,
  });
  assert.equal((await missed.json()).message, '验证码已失效，请重新获取');
});

test('a code expires after ten minutes, and a session expires after thirty days', async () => {
  const time = clock('2026-10-30T02:10:00Z');
  const rig = setup({ time });
  await rig.auth.requestCode({
    request: post('https://desklab.test/api/auth/request-code', { email: 'a@b.cn' }),
    env: rig.env,
  });
  const code = rig.calls[0].body.Messages[0].TextPart.match(/\d{6}/)[0];
  time.advance(10 * 60 * 1000 - 1);
  const still = await rig.auth.verify({
    request: post('https://desklab.test/api/auth/verify', { email: 'a@b.cn', code }),
    env: rig.env,
  });
  assert.equal(still.status, 200);
  const token = cookieToken(still);
  const me = () => rig.auth.me({
    request: new Request('https://desklab.test/api/auth/me', { headers: { cookie: `desklab_session=${token}` } }),
    env: rig.env,
  });
  time.advance(30 * 24 * 60 * 60 * 1000 - 1);
  assert.equal((await (await me()).json()).email, 'a@b.cn');
  time.advance(1);
  assert.equal((await (await me()).json()).email, null);

  const expired = setup({ time: clock('2026-10-30T02:10:00Z') });
  await expired.auth.requestCode({
    request: post('https://desklab.test/api/auth/request-code', { email: 'a@b.cn' }),
    env: expired.env,
  });
  expired.time.advance(10 * 60 * 1000);
  const late = await expired.auth.verify({
    request: post('https://desklab.test/api/auth/verify', { email: 'a@b.cn', code: '000000' }),
    env: expired.env,
  });
  assert.equal((await late.json()).message, '验证码已失效，请重新获取');
});

test('the daily send cap resets at Beijing midnight', async () => {
  const time = clock('2026-10-30T15:40:00.000Z');
  const rig = setup({ time });
  const ask = () => rig.auth.requestCode({
    request: post('https://desklab.test/api/auth/request-code', { email: 'a@b.cn' }, { 'CF-Connecting-IP': '203.0.113.20' }),
    env: rig.env,
  });
  assert.equal((await ask()).status, 200);
  for (let i = 0; i < 4; i += 1) {
    time.advance(61 * 1000);
    assert.equal((await ask()).status, 200);
  }
  time.advance(61 * 1000);
  const blocked = await ask();
  assert.equal(blocked.status, 429);
  assert.equal((await blocked.json()).message, '这个邮箱今天的验证码次数用完了，明天再试');
  time.set('2026-10-30T16:00:01.000Z');
  assert.equal((await ask()).status, 200);
});
