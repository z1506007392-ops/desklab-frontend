import test from 'node:test';
import assert from 'node:assert/strict';

import { loginCodeMessage, mailConfig, sendLoginCode } from '../server/ai/mail.js';
import { postResend, resendFrom } from '../server/ai/resend.js';

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

const mailjetEnv = {
  MAILJET_API_KEY: 'mj-public-test',
  MAILJET_API_SECRET: 'mj-private-test',
  MAIL_FROM: 'login@desklab.test',
  MAIL_FROM_NAME: 'DeskLab',
};

test('Mailjet is chosen when both of its keys are set, even if Brevo is also set', () => {
  assert.equal(mailConfig(mailjetEnv).provider, 'mailjet');
  assert.equal(mailConfig(mailjetEnv).configured, true);
  assert.equal(mailConfig({ ...mailjetEnv, BREVO_API_KEY: 'secret-key' }).provider, 'mailjet');
  assert.equal(mailConfig(ready).provider, 'brevo');
  assert.equal(mailConfig({ MAILJET_API_KEY: 'only-one', ...ready }).configured, false);
  assert.equal(mailConfig({ MAILJET_API_SECRET: 'only-one', ...ready }).provider, 'mailjet');
  assert.equal(mailConfig({ MAILJET_API_KEY: ' mj-public-test ', MAILJET_API_SECRET: ' mj-private-test ', MAIL_FROM: ' login@desklab.test ' }).configured, true);
  assert.equal(mailConfig({ ...mailjetEnv, MAIL_FROM: '' }).configured, false);
});

test('a half-set Mailjet pair does not call either provider', async () => {
  let called = false;
  const result = await sendLoginCode({
    fetchImpl: async () => { called = true; return new Response('{}', { status: 200 }); },
    env: { MAILJET_API_KEY: 'only-one', BREVO_API_KEY: 'secret-key', MAIL_FROM: 'login@desklab.test' },
    to: 'a@b.cn',
    code: '123456',
  });
  assert.deepEqual(result, { ok: false, reason: 'unconfigured' });
  assert.equal(called, false);
});

test('Mailjet gets the same Chinese note with Basic auth, and the secret stays out of the body', async () => {
  let sent;
  const result = await sendLoginCode({
    fetchImpl: async (url, init) => {
      sent = { url, init, body: JSON.parse(init.body) };
      return new Response(JSON.stringify({ Messages: [{ Status: 'success' }] }), { status: 200 });
    },
    env: mailjetEnv,
    to: 'a@b.cn',
    code: '123456',
  });
  assert.deepEqual(result, { ok: true });
  assert.equal(sent.url, 'https://api.mailjet.com/v3.1/send');
  assert.equal(sent.init.method, 'POST');
  assert.equal(sent.init.headers.authorization, `Basic ${btoa('mj-public-test:mj-private-test')}`);
  assert.equal(sent.init.headers['api-key'], undefined);
  assert.equal(sent.body.Messages[0].From.Email, 'login@desklab.test');
  assert.equal(sent.body.Messages[0].From.Name, 'DeskLab');
  assert.deepEqual(sent.body.Messages[0].To, [{ Email: 'a@b.cn' }]);
  assert.equal(sent.body.Messages[0].Subject, 'DeskLab 登录验证码');
  assert.equal(sent.body.Messages[0].TextPart, loginCodeMessage('123456'));
  assert.equal(sent.body.Messages[0].HTMLPart, undefined);
  const packed = JSON.stringify(sent.body);
  assert.equal(packed.includes('mj-public-test'), false);
  assert.equal(packed.includes('mj-private-test'), false);
});

test('a Mailjet error status, a failed message, or a network error is not thrown', async () => {
  const refused = await sendLoginCode({
    fetchImpl: async () => new Response('no', { status: 401 }),
    env: mailjetEnv,
    to: 'a@b.cn',
    code: '123456',
  });
  assert.deepEqual(refused, { ok: false, reason: 'upstream' });
  const logical = await sendLoginCode({
    fetchImpl: async () => new Response(JSON.stringify({ Messages: [{ Status: 'error' }] }), { status: 200 }),
    env: mailjetEnv,
    to: 'a@b.cn',
    code: '123456',
  });
  assert.deepEqual(logical, { ok: false, reason: 'upstream' });
  const empty = await sendLoginCode({
    fetchImpl: async () => new Response('', { status: 200 }),
    env: mailjetEnv,
    to: 'a@b.cn',
    code: '123456',
  });
  assert.deepEqual(empty, { ok: false, reason: 'upstream' });
  const thrown = await sendLoginCode({
    fetchImpl: async () => { throw new Error('network'); },
    env: mailjetEnv,
    to: 'a@b.cn',
    code: '123456',
  });
  assert.deepEqual(thrown, { ok: false, reason: 'upstream' });
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

const resendEnv = {
  RESEND_API_KEY: 're_test_secret',
  MAIL_FROM: 'login@desklab.test',
  MAIL_FROM_NAME: 'DeskLab',
};

test('Resend is chosen ahead of Mailjet and Brevo when its key is set', () => {
  const all = { ...mailjetEnv, BREVO_API_KEY: 'secret-key', RESEND_API_KEY: 're_test_secret' };
  assert.equal(mailConfig(all).provider, 'resend');
  assert.equal(mailConfig(all).configured, true);
  assert.equal(mailConfig(all).apiKey, 're_test_secret');
  assert.equal(mailConfig(all).apiSecret, '');
  assert.equal(mailConfig({ RESEND_API_KEY: '  re_test_secret  ', MAIL_FROM: ' login@desklab.test ' }).configured, true);
  assert.equal(mailConfig({ RESEND_API_KEY: '  re_test_secret  ', MAIL_FROM: ' login@desklab.test ' }).from, 'login@desklab.test');
  assert.equal(mailConfig({ RESEND_API_KEY: 're_test_secret' }).configured, false);
  assert.equal(mailConfig({ RESEND_API_KEY: 're_test_secret', MAIL_FROM: '  ' }).configured, false);
  assert.equal(mailConfig({ RESEND_API_KEY: '   ', ...mailjetEnv }).provider, 'mailjet');
  assert.equal(mailConfig({ RESEND_API_KEY: '   ', ...ready }).provider, 'brevo');
  assert.equal(mailConfig(mailjetEnv).provider, 'mailjet');
  assert.equal(mailConfig(ready).provider, 'brevo');
});

test('a Resend key without a sender does not call Resend, Mailjet, or Brevo', async () => {
  let called = false;
  const result = await sendLoginCode({
    fetchImpl: async () => { called = true; return new Response('{}', { status: 200 }); },
    env: {
      RESEND_API_KEY: 're_test_secret',
      MAILJET_API_KEY: 'mj-public-test',
      MAILJET_API_SECRET: 'mj-private-test',
      BREVO_API_KEY: 'secret-key',
    },
    to: 'a@b.cn',
    code: '123456',
  });
  assert.deepEqual(result, { ok: false, reason: 'unconfigured' });
  assert.equal(called, false);
});

test('Resend gets the same Chinese note with Bearer auth, and the key stays out of the body', async () => {
  let sent;
  const result = await sendLoginCode({
    fetchImpl: async (url, init) => {
      sent = { url, init, body: JSON.parse(init.body) };
      return new Response('{"id":"email_test"}', { status: 200 });
    },
    env: { ...resendEnv, ...mailjetEnv, BREVO_API_KEY: 'secret-key', MAIL_FROM_NAME: 'Desk Lab' },
    to: 'a@b.cn',
    code: '123456',
  });
  assert.deepEqual(result, { ok: true });
  assert.equal(sent.url, 'https://api.resend.com/emails');
  assert.equal(sent.init.method, 'POST');
  assert.equal(sent.init.headers.authorization, 'Bearer re_test_secret');
  assert.equal(sent.init.headers['api-key'], undefined);
  assert.equal(sent.body.from, 'Desk Lab <login@desklab.test>');
  assert.deepEqual(sent.body.to, ['a@b.cn']);
  assert.equal(sent.body.subject, 'DeskLab 登录验证码');
  assert.equal(sent.body.text, loginCodeMessage('123456'));
  assert.equal(sent.body.html, undefined);
  const packed = JSON.stringify(sent.body);
  assert.equal(packed.includes('re_test_secret'), false);
  assert.equal(packed.includes('mj-private-test'), false);
  assert.equal(packed.includes('secret-key'), false);
});

test('a half-set Mailjet pair still sends through Resend when that key is set', async () => {
  let sent;
  const result = await sendLoginCode({
    fetchImpl: async (url, init) => {
      sent = { url, body: JSON.parse(init.body) };
      return new Response('', { status: 201 });
    },
    env: { RESEND_API_KEY: 're_test_secret', MAILJET_API_KEY: 'only-one', BREVO_API_KEY: 'secret-key', MAIL_FROM: 'login@desklab.test' },
    to: 'a@b.cn',
    code: '123456',
  });
  assert.deepEqual(result, { ok: true });
  assert.equal(sent.url, 'https://api.resend.com/emails');
  assert.equal(sent.body.from, 'DeskLab <login@desklab.test>');
});

test('a Resend error status or a network error is not thrown', async () => {
  const refused = await sendLoginCode({
    fetchImpl: async () => new Response('no', { status: 403 }),
    env: resendEnv,
    to: 'a@b.cn',
    code: '123456',
  });
  assert.deepEqual(refused, { ok: false, reason: 'upstream' });
  const thrown = await sendLoginCode({
    fetchImpl: async () => { throw new Error('network'); },
    env: resendEnv,
    to: 'a@b.cn',
    code: '123456',
  });
  assert.deepEqual(thrown, { ok: false, reason: 'upstream' });
});

test('Resend uses the bare address when there is no sender name', async () => {
  assert.equal(resendFrom('login@desklab.test', ''), 'login@desklab.test');
  assert.equal(resendFrom('login@desklab.test', '  '), 'login@desklab.test');
  assert.equal(resendFrom('login@desklab.test', 'DeskLab'), 'DeskLab <login@desklab.test>');
  let sent;
  const result = await postResend({
    fetchImpl: async (url, init) => {
      sent = { url, body: JSON.parse(init.body) };
      return new Response('{}', { status: 200 });
    },
    apiKey: 're_test_secret',
    from: 'onboarding@resend.dev',
    fromName: '',
    to: 'a@b.cn',
    subject: 'DeskLab 登录验证码',
    text: loginCodeMessage('123456'),
  });
  assert.deepEqual(result, { ok: true });
  assert.equal(sent.url, 'https://api.resend.com/emails');
  assert.equal(sent.body.from, 'onboarding@resend.dev');
  assert.deepEqual(sent.body.to, ['a@b.cn']);
});
