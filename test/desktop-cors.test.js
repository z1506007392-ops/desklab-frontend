import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { createAuthHandlers } from '../server/ai/auth.js';
import {
  applyDesktopCors,
  cookieForDesktop,
  foreignOriginResponse,
  guardApiRequest,
} from '../server/ai/desktop-cors.js';
import { onRequest } from '../functions/api/_middleware.js';

const mailEnv = { BREVO_API_KEY: 'secret-key', MAIL_FROM: 'login@desklab.test' };

function post(url, body, headers = {}) {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

function auth() {
  const sent = [];
  const handlers = createAuthHandlers({
    mail: async ({ code }) => { sent.push(code); return { ok: true }; },
  });
  return { sent, env: mailEnv, ...handlers };
}

async function login(handlers, origin) {
  const headers = origin ? { origin } : {};
  await handlers.requestCode({
    request: post('https://desklab-frontend.pages.dev/api/auth/request-code', { email: 'a@b.cn' }, headers),
    env: handlers.env,
  });
  return handlers.verify({
    request: post('https://desklab-frontend.pages.dev/api/auth/verify', { email: 'a@b.cn', code: handlers.sent[0] }, headers),
    env: handlers.env,
  });
}

test('a website login cookie stays Lax and gains no CORS headers', async () => {
  const handlers = auth();
  const request = post('https://desklab-frontend.pages.dev/api/auth/verify', {}, { origin: 'https://desklab-frontend.pages.dev' });
  const response = await guardApiRequest(request, () => login(handlers, 'https://desklab-frontend.pages.dev'));
  const cookie = response.headers.get('set-cookie');
  assert.match(cookie, /SameSite=Lax/i);
  assert.equal(/SameSite=None/i.test(cookie), false);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});

test('a desktop login cookie is SameSite=None and the origin is echoed', async () => {
  for (const origin of ['tauri://localhost', 'http://tauri.localhost', 'https://tauri.localhost']) {
    const handlers = auth();
    const request = post('https://desklab-frontend.pages.dev/api/auth/verify', {}, { origin });
    const response = await guardApiRequest(request, () => login(handlers, origin));
    const cookie = response.headers.get('set-cookie');
    assert.match(cookie, /SameSite=None/i, origin);
    assert.match(cookie, /Secure/i, origin);
    assert.equal(/SameSite=Lax/i.test(cookie), false, origin);
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
    assert.match(response.headers.get('vary'), /Origin/);
  }
});

test('logout from the desktop app clears the cookie with the same site rules', async () => {
  const handlers = auth();
  const request = post('https://desklab-frontend.pages.dev/api/auth/logout', {}, { origin: 'tauri://localhost' });
  const response = await guardApiRequest(request, () => handlers.logout({ request, env: handlers.env }));
  const cookie = response.headers.get('set-cookie');
  assert.match(cookie, /Max-Age=0/);
  assert.match(cookie, /SameSite=None/i);
  assert.match(cookie, /Secure/i);
});

test('a missing origin is unchanged, and a foreign or broken origin is refused', async () => {
  const handlers = auth();
  const plain = await guardApiRequest(
    post('https://desklab-frontend.pages.dev/api/ai/layout', {}),
    () => login(handlers),
  );
  assert.match(plain.headers.get('set-cookie'), /SameSite=Lax/i);
  assert.equal(plain.headers.get('access-control-allow-origin'), null);

  let called = false;
  const refused = await guardApiRequest(
    post('https://desklab-frontend.pages.dev/api/ai/layout', {}, { origin: 'https://evil.example' }),
    () => { called = true; return new Response('no'); },
  );
  assert.equal(called, false);
  assert.equal(refused.status, 403);
  assert.equal(refused.headers.get('x-content-type-options'), 'nosniff');
  assert.equal((await refused.json()).error, 'forbidden_origin');
  assert.equal(refused.headers.get('access-control-allow-origin'), null);

  for (const origin of ['null', 'http://127.0.0.1:5173']) {
    const blocked = foreignOriginResponse(post('https://desklab-frontend.pages.dev/api/ai/layout', {}, { origin }));
    assert.equal(blocked?.status, 403, origin);
  }
  const injected = {
    url: 'https://desklab-frontend.pages.dev/api/ai/layout',
    method: 'POST',
    headers: { get: name => (name === 'origin' ? 'https://evil.example\r\nSet-Cookie: x' : null) },
  };
  assert.equal(foreignOriginResponse(injected)?.status, 403);
  assert.equal(foreignOriginResponse(post('http://127.0.0.1:3001/api/ai/layout', {}, { origin: 'http://127.0.0.1:5173' }), { allowLoopback: true }), null);
  assert.equal(foreignOriginResponse(post('http://[::1]:3001/api/ai/layout', {}, { origin: 'http://[::1]:5173' }), { allowLoopback: true }), null);
});

test('a desktop preflight does not run the handler', async () => {
  let called = false;
  const response = await guardApiRequest(
    new Request('https://desklab-frontend.pages.dev/api/ai/layout', { method: 'OPTIONS', headers: { origin: 'tauri://localhost' } }),
    () => { called = true; return new Response('no'); },
  );
  assert.equal(called, false);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), 'tauri://localhost');
  assert.equal(response.headers.get('access-control-allow-headers'), 'content-type, accept');
});

test('an http desktop cookie gains Secure', () => {
  const cookie = cookieForDesktop('desklab_session=abc; HttpOnly; SameSite=Lax; Path=/; Max-Age=10');
  assert.match(cookie, /SameSite=None/);
  assert.match(cookie, /Secure/);
  assert.equal(/SameSite=Lax/.test(cookie), false);
  const response = applyDesktopCors(
    post('http://127.0.0.1/api/auth/verify', {}, { origin: 'http://tauri.localhost' }),
    new Response('{}', { headers: { 'set-cookie': cookie } }),
  );
  assert.match(response.headers.get('set-cookie'), /Secure/);
});

test('login and AI reject a foreign origin with nosniff before the handler runs', async () => {
  const cases = [
    ['POST', '/api/auth/request-code', { email: 'a@b.cn' }],
    ['POST', '/api/auth/verify', { email: 'a@b.cn', code: '123456' }],
    ['POST', '/api/auth/logout', {}],
    ['GET', '/api/auth/me', null],
    ['POST', '/api/ai/layout', { version: 1, summary: {} }],
    ['OPTIONS', '/api/auth/verify', null],
    ['OPTIONS', '/api/ai/layout', null],
  ];
  for (const origin of ['https://evil.example', 'null']) {
    for (const [method, path, body] of cases) {
      let called = false;
      const request = new Request(`https://desklab-frontend.pages.dev${path}`, {
        method,
        headers: { origin, 'content-type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const response = await onRequest({
        request,
        async next() { called = true; return new Response('should-not-run'); },
      });
      const label = `${method} ${path} ${origin}`;
      assert.equal(called, false, label);
      assert.equal(response.status, 403, label);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff', label);
      assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8', label);
      assert.equal(response.headers.get('access-control-allow-origin'), null, label);
      assert.equal(response.headers.get('set-cookie'), null, label);
      assert.equal((await response.json()).error, 'forbidden_origin');
    }
  }
});

test('the Pages middleware keeps website cookies Lax and desktop cookies None', async () => {
  const site = 'https://desklab-frontend.pages.dev';
  const handlers = auth();
  const website = await onRequest({
    request: post(`${site}/api/auth/verify`, {}, { origin: site }),
    next: () => login(handlers, site),
  });
  const websiteCookie = website.headers.get('set-cookie');
  assert.match(websiteCookie, /SameSite=Lax/i);
  assert.equal(/SameSite=None/i.test(websiteCookie), false);
  assert.equal(website.headers.get('access-control-allow-origin'), null);
  assert.equal(website.headers.get('x-content-type-options'), 'nosniff');

  for (const origin of ['tauri://localhost', 'http://tauri.localhost', 'https://tauri.localhost']) {
    const desktopHandlers = auth();
    const response = await onRequest({
      request: post(`${site}/api/auth/verify`, {}, { origin }),
      next: () => login(desktopHandlers, origin),
    });
    const cookie = response.headers.get('set-cookie');
    assert.match(cookie, /SameSite=None/i, origin);
    assert.match(cookie, /Secure/i, origin);
    assert.equal(/SameSite=Lax/i.test(cookie), false, origin);
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  }

  for (const [method, path] of [['GET', '/api/auth/me'], ['POST', '/api/ai/layout'], ['POST', '/api/auth/request-code'], ['POST', '/api/auth/logout']]) {
    let called = false;
    const response = await onRequest({
      request: new Request(`${site}${path}`, {
        method,
        headers: { origin: site, 'content-type': 'application/json' },
        body: method === 'POST' ? '{}' : undefined,
      }),
      async next() {
        called = true;
        return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
      },
    });
    assert.equal(called, true, path);
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get('access-control-allow-origin'), null, path);
  }
});

test('the Pages middleware is the guard', async () => {
  let forwarded = null;
  const request = post('https://desklab-frontend.pages.dev/api/auth/me', {}, { origin: 'https://evil.example' });
  const response = await onRequest({
    request,
    async next() { forwarded = true; return new Response('no'); },
  });
  assert.equal(forwarded, null);
  assert.equal(response.status, 403);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
});

function startServer() {
  const script = fileURLToPath(new URL('../tools/dev-api-server.mjs', import.meta.url));
  const port = String(30000 + Math.floor(Math.random() * 20000));
  const child = spawn(process.execPath, [script], {
    env: { ...process.env, DEEPSEEK_API_KEY: '', PORT: port },
  });
  const ready = new Promise((resolve, reject) => {
    child.stdout.on('data', data => { if (String(data).includes('dev server')) resolve(); });
    child.on('exit', code => reject(new Error(`dev server exited with ${code}`)));
  });
  return { url: `http://127.0.0.1:${port}/api/ai/layout`, ready, stop: () => child.kill() };
}

test('the local API server allows the desktop origin and the Vite proxy, and refuses other sites', async () => {
  const server = startServer();
  try {
    await server.ready;
    const headers = { 'content-type': 'application/json' };
    const foreign = await fetch(server.url, {
      method: 'POST',
      headers: { ...headers, origin: 'https://evil.example' },
      body: '{}',
    });
    assert.equal(foreign.status, 403);
    assert.equal(foreign.headers.get('x-content-type-options'), 'nosniff');
    assert.equal((await foreign.json()).error, 'forbidden_origin');
    for (const path of ['/api/auth/request-code', '/api/auth/verify', '/api/auth/logout']) {
      const refused = await fetch(server.url.replace('/api/ai/layout', path), {
        method: 'POST',
        headers: { ...headers, origin: 'https://evil.example' },
        body: '{}',
      });
      assert.equal(refused.status, 403, path);
      assert.equal(refused.headers.get('x-content-type-options'), 'nosniff', path);
      assert.equal(refused.headers.get('access-control-allow-origin'), null, path);
    }
    const me = await fetch(server.url.replace('/api/ai/layout', '/api/auth/me'), {
      headers: { origin: 'https://evil.example' },
    });
    assert.equal(me.status, 403);
    assert.equal(me.headers.get('x-content-type-options'), 'nosniff');
    const desktop = await fetch(server.url, {
      method: 'POST',
      headers: { ...headers, origin: 'tauri://localhost' },
      body: '{}',
    });
    assert.equal(desktop.status, 503);
    assert.equal(desktop.headers.get('access-control-allow-origin'), 'tauri://localhost');
    const preflight = await fetch(server.url, {
      method: 'OPTIONS',
      headers: { origin: 'http://tauri.localhost', 'access-control-request-method': 'POST' },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-credentials'), 'true');
    const proxy = await fetch(server.url, {
      method: 'POST',
      headers: { ...headers, origin: 'http://127.0.0.1:5173' },
      body: '{}',
    });
    assert.equal(proxy.status, 503);
    assert.equal(proxy.headers.get('access-control-allow-origin'), null);
  } finally {
    server.stop();
  }
});
