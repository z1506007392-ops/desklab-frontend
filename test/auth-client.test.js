import test from 'node:test';
import assert from 'node:assert/strict';

import { fetchCurrentSession, requestLoginCode } from '../src/domain/auth-client.js';

function jsonResponse(body, ok = true) {
  return { ok, json: async () => body };
}

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
