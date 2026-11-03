import test from 'node:test';
import assert from 'node:assert/strict';

import { PACKAGED_API_ORIGIN, apiUrl, configuredApiOrigin, resolveApiUrl } from '../src/domain/api-base.js';

test('the website and tauri dev keep relative API paths', () => {
  assert.equal(PACKAGED_API_ORIGIN, 'https://desklab-frontend.pages.dev');
  assert.equal(resolveApiUrl('/api/ai/layout'), '/api/ai/layout');
  assert.equal(resolveApiUrl('/api/auth/me', { desktop: true, dev: true }), '/api/auth/me');
  assert.equal(resolveApiUrl('/api/community/layouts', { desktop: false, dev: false }), '/api/community/layouts');
});

test('a packaged desktop app prefixes the https origin', () => {
  assert.equal(
    resolveApiUrl('/api/ai/layout', { desktop: true, dev: false }),
    'https://desklab-frontend.pages.dev/api/ai/layout',
  );
  assert.equal(
    resolveApiUrl('/api/auth/verify', { desktop: true, origin: 'https://example.com' }),
    'https://example.com/api/auth/verify',
  );
});

test('an API path has to stay on this app', () => {
  assert.throws(() => resolveApiUrl('https://evil.example/api'), /API path/);
  assert.throws(() => resolveApiUrl('//evil.example/api', { desktop: true }), /API path/);
});

test('the override is an https origin and nothing else', () => {
  assert.equal(configuredApiOrigin(undefined), null);
  assert.equal(configuredApiOrigin(''), null);
  assert.equal(configuredApiOrigin('https://desklab-frontend.pages.dev'), PACKAGED_API_ORIGIN);
  assert.equal(configuredApiOrigin('https://example.com/'), 'https://example.com');
  for (const raw of [
    'http://example.com',
    'https://user:pass@example.com',
    'https://example.com/api',
    'https://example.com?q=1',
    'https://example.com#x',
    'not a url',
    'https://example.com\n',
  ]) {
    assert.throws(() => configuredApiOrigin(raw), /https origin/, raw);
  }
});

test('node tests, with no desktop shell, still call relative URLs', () => {
  assert.equal(apiUrl('/api/ai/layout'), '/api/ai/layout');
  const previous = globalThis.window;
  globalThis.window = { __TAURI_INTERNALS__: {} };
  try {
    assert.equal(apiUrl('/api/auth/me'), 'https://desklab-frontend.pages.dev/api/auth/me');
  } finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
});
