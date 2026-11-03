import test from 'node:test';
import assert from 'node:assert/strict';

import { fetchCurrentSession, logoutSession, requestLoginCode, verifyLoginCode } from '../src/domain/auth-client.js';

function jsonResponse(body, ok = true) {
  return { ok, json: async () => body };
}

const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
});

test('a signed-in session returns the email and the remaining count', async () => {
  const session = await fetchCurrentSession(async () => jsonResponse({ email: 'a@b.co', remaining: 7 }));
  assert.deepEqual(session, { email: 'a@b.co', remaining: 7 });
});

test('an answer with no email is signed out, not a network failure', async () => {
  const session = await fetchCurrentSession(async () => jsonResponse({ email: null, remaining: null }));
  assert.equal(session.email, null);
  assert.equal(session.offline, undefined);
});

test('a dropped session check is a network failure, not a signed-out user', async () => {
  const session = await fetchCurrentSession(() => Promise.reject(new Error('offline')));
  assert.equal(session.offline, true);
  assert.equal(session.email, null);
  assert.equal(session.remaining, null);
});

test('asking for a code reports a dropped connection in plain words', async () => {
  await assert.rejects(
    () => requestLoginCode({ email: 'a@b.co', fetchImpl: () => Promise.reject(new Error('offline')) }),
    error => error.message === '网络连接失败，请检查网络后再试' && error.code === 'network_error',
  );
});

test('a code request that is not JSON uses the plain sentence', async () => {
  await assert.rejects(
    requestLoginCode({
      email: 'a@b.cn',
      fetchImpl: async () => new Response('nope', { status: 502, headers: { 'content-type': 'text/plain' } }),
    }),
    { message: '登录没有完成，请稍后再试' },
  );
  await assert.rejects(
    requestLoginCode({
      email: 'a@b.cn',
      fetchImpl: async () => new Response('ok', { status: 200 }),
    }),
    { message: '登录没有完成，请稍后再试' },
  );
});

test('verify keeps the server sentence and rejects a success that is not JSON', async () => {
  await assert.rejects(
    verifyLoginCode({
      email: 'a@b.cn',
      code: '123456',
      fetchImpl: async () => json(400, { error: 'code_wrong', message: '验证码不对' }),
    }),
    { message: '验证码不对' },
  );
  await assert.rejects(
    verifyLoginCode({
      email: 'a@b.cn',
      code: '123456',
      fetchImpl: async () => new Response('<html>', { status: 200 }),
    }),
    { message: '登录没有完成，请稍后再试' },
  );
});

test('a dropped connection while asking for a code says to check the network', async () => {
  await assert.rejects(
    requestLoginCode({
      email: 'a@b.cn',
      fetchImpl: async () => { throw new TypeError('Failed to fetch'); },
    }),
    { message: '网络连接失败，请检查网络后再试' },
  );
});

test('a failed logout says to try again and does not throw the response body', async () => {
  await assert.rejects(
    logoutSession(async () => new Response('nope', { status: 502 })),
    { message: '退出没有完成，请再试一次' },
  );
  const ok = await logoutSession(async () => json(200, { ok: true }));
  assert.deepEqual(ok, { ok: true });
});
