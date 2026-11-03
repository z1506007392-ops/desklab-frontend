import test from 'node:test';
import assert from 'node:assert/strict';

import { loginCodeMessage, mailConfig, sendLoginCode } from '../server/ai/mail.js';

const ready = { BREVO_API_KEY: 'secret-key', MAIL_FROM: 'login@desklab.test', MAIL_FROM_NAME: 'DeskLab' };

test('the login message is only the code and how long it lasts', () => {
  assert.equal(loginCodeMessage('123456'), '你的 DeskLab 登录验证码是 123456，10 分钟内有效。');
});

test('mail is unconfigured until both the key and the sender are set', () => {
  assert.equal(mailConfig({}).configured, false);
  assert.equal(mailConfig({ BREVO_API_KEY: 'secret-key' }).configured, false);
  assert.equal(mailConfig({ MAIL_FROM: 'login@desklab.test' }).configured, false);
  assert.equal(mailConfig({ BREVO_API_KEY: '  ', MAIL_FROM: 'login@desklab.test' }).configured, false);
  assert.equal(mailConfig(ready).fromName, 'DeskLab');
  assert.equal(mailConfig({ ...ready, MAIL_FROM_NAME: '  ' }).fromName, 'DeskLab');
});

test('a missing key does not call Brevo', async () => {
  let called = false;
  const result = await sendLoginCode({
    fetchImpl: async () => { called = true; return new Response('{}', { status: 201 }); },
    env: {},
    to: 'a@b.cn',
    code: '123456',
  });
  assert.deepEqual(result, { ok: false, reason: 'unconfigured' });
  assert.equal(called, false);
});

test('a configured sender posts the Chinese note and keeps the key out of the body', async () => {
  let sent;
  const result = await sendLoginCode({
    fetchImpl: async (url, init) => {
      sent = { url, init, body: JSON.parse(init.body) };
      return new Response('{}', { status: 201 });
    },
    env: ready,
    to: 'a@b.cn',
    code: '123456',
  });
  assert.deepEqual(result, { ok: true });
  assert.equal(sent.url, 'https://api.brevo.com/v3/smtp/email');
  assert.equal(sent.init.method, 'POST');
  assert.equal(sent.init.headers['api-key'], 'secret-key');
  assert.equal(sent.body.sender.email, 'login@desklab.test');
  assert.equal(sent.body.sender.name, 'DeskLab');
  assert.deepEqual(sent.body.to, [{ email: 'a@b.cn' }]);
  assert.equal(sent.body.subject, 'DeskLab 登录验证码');
  assert.equal(sent.body.textContent, loginCodeMessage('123456'));
  assert.equal(JSON.stringify(sent.body).includes('secret-key'), false);
});

test('a Brevo failure or a network error is reported and not thrown', async () => {
  const refused = await sendLoginCode({
    fetchImpl: async () => new Response('no', { status: 400 }),
    env: ready,
    to: 'a@b.cn',
    code: '123456',
  });
  assert.deepEqual(refused, { ok: false, reason: 'upstream' });
  const thrown = await sendLoginCode({
    fetchImpl: async () => { throw new Error('network'); },
    env: ready,
    to: 'a@b.cn',
    code: '123456',
  });
  assert.deepEqual(thrown, { ok: false, reason: 'upstream' });
});
