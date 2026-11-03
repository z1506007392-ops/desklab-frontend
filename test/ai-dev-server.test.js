import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { mockSuggestions } from '../server/ai/mock-model.js';
import { sanitizeSuggestions } from '../src/domain/ai-protocol.js';

const desk = { id: 'desk', kind: 'office-desk', center: [0, 1.2, 0.375], size: [1.6, 0.8, 0.75], restingOn: 'floor' };

test('the mock suggests centring an off-centre monitor and moving a tower off the desk', () => {
  const suggestions = mockSuggestions({
    objects: [
      desk,
      { id: 'mon', kind: 'monitor-27', center: [0.4, 1.45, 0.94], size: [0.62, 0.06, 0.37], restingOn: 'desk' },
      { id: 'pc', kind: 'desktop-pc', center: [-0.5, 1.2, 1.0], size: [0.25, 0.5, 0.5], restingOn: 'desk' },
    ],
  });
  assert.deepEqual(suggestions.map(s => s.actions[0]), [
    { type: 'move', objectId: 'mon', x: 0, y: 1.45 },
    { type: 'move', objectId: 'pc', x: 1.03, y: 1.2, z: 0.25 },
  ]);
  assert.deepEqual(sanitizeSuggestions({ suggestions }), suggestions, 'mock answers fit the protocol');
  assert.deepEqual(mockSuggestions({ objects: [desk] }), []);
  assert.deepEqual(mockSuggestions(null), []);
});

function startServer(env) {
  const script = fileURLToPath(new URL('../tools/dev-api-server.mjs', import.meta.url));
  const port = String(30000 + Math.floor(Math.random() * 20000));
  const child = spawn(process.execPath, [script], { env: { ...process.env, DEEPSEEK_API_KEY: '', ...env, PORT: port } });
  const ready = new Promise((resolve, reject) => {
    child.stdout.on('data', data => { if (String(data).includes('dev server')) resolve(); });
    child.on('exit', code => reject(new Error(`dev server exited with ${code}`)));
  });
  return { url: `http://127.0.0.1:${port}/api/ai/layout`, ready, stop: () => child.kill() };
}

const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('the local dev server answers like the Cloudflare function', async () => {
  const noKey = startServer({});
  try {
    await noKey.ready;
    const response = await post(noKey.url, { version: 1, summary: {} });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error, 'ai_unavailable');
    const code = await post(noKey.url.replace('/api/ai/layout', '/api/auth/request-code'), { email: 'a@b.cn' });
    assert.equal(code.status, 503);
    assert.equal((await code.json()).message, '登录暂未开放');
  } finally {
    noKey.stop();
  }

  const mock = startServer({ AI_MOCK: '1' });
  try {
    await mock.ready;
    const response = await post(mock.url, {
      version: 1,
      summary: { objects: [desk, { id: 'mon', kind: 'monitor-24', center: [0.3, 1.4, 0.9], size: [0.54, 0.05, 0.32], restingOn: 'desk' }] },
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.model, 'mock');
    assert.equal(body.suggestions[0].actions[0].objectId, 'mon');
    const me = await fetch(mock.url.replace('/api/ai/layout', '/api/auth/me'));
    assert.equal(me.status, 200);
    assert.equal((await me.json()).email, 'dev@localhost');
    assert.equal((await fetch(mock.url.replace('/api/ai/layout', '/other'))).status, 404);
  } finally {
    mock.stop();
  }
});
