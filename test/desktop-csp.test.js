import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { PACKAGED_API_ORIGIN } from '../src/domain/api-base.js';
import { cspForBuild, desktopContentSecurityPolicy } from '../src/domain/desktop-csp.js';

function sources(policy, name) {
  const part = policy.split(';').map(item => item.trim()).find(item => item === name || item.startsWith(`${name} `));
  assert.ok(part, name);
  return part.slice(name.length).trim().split(/\s+/).filter(Boolean);
}

test('the packaged policy keeps blob workers and names only the API origin', () => {
  const policy = desktopContentSecurityPolicy();
  assert.equal(policy.includes('gstatic'), false);
  assert.equal(policy.includes('jsdelivr'), false);
  for (const source of policy.split(';').flatMap(part => part.trim().split(/\s+/))) {
    assert.equal(source === 'https:' || source === 'http:' || source === "'unsafe-eval'", false, source);
  }
  const scripts = sources(policy, 'script-src');
  assert.ok(scripts.includes("'self'"));
  assert.ok(scripts.includes('blob:'));
  assert.ok(scripts.includes("'wasm-unsafe-eval'"));
  assert.equal(scripts.includes("'unsafe-inline'"), false);
  assert.deepEqual(sources(policy, 'worker-src').sort(), ["'self'", 'blob:'].sort());
  assert.ok(sources(policy, 'style-src').includes("'unsafe-inline'"));
  assert.ok(sources(policy, 'img-src').includes('blob:'));
  const connect = sources(policy, 'connect-src');
  for (const source of ["'self'", 'blob:', 'ipc:', 'http://ipc.localhost', 'https://ipc.localhost', PACKAGED_API_ORIGIN]) {
    assert.ok(connect.includes(source), source);
  }
  assert.equal(connect.filter(source => source.startsWith('https://')).length, 2);
});

test('a different build origin replaces the API host and does not open every https site', () => {
  const policy = cspForBuild('https://staging.example.com');
  const connect = sources(policy, 'connect-src');
  assert.ok(connect.includes('https://staging.example.com'));
  assert.equal(connect.includes(PACKAGED_API_ORIGIN), false);
  assert.throws(() => cspForBuild('http://staging.example.com'), /https origin/);
  assert.equal(cspForBuild(''), desktopContentSecurityPolicy());
  assert.equal(cspForBuild(undefined), desktopContentSecurityPolicy());
});

test('the committed Tauri config matches the default policy and does not apply it during tauri dev', () => {
  const conf = JSON.parse(readFileSync(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'));
  assert.equal(conf.app.security.csp, desktopContentSecurityPolicy());
  assert.equal(conf.app.security.devCsp, null);
  assert.deepEqual(conf.app.security.dangerousDisableAssetCspModification, ['style-src']);
  assert.equal(conf.app.security.useHttpsScheme, undefined);
});

test('installer builds stay out of the website workflow and do not publish a release', () => {
  const desktop = readFileSync(new URL('../.github/workflows/desktop.yml', import.meta.url), 'utf8');
  const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.match(desktop, /windows-latest/);
  assert.match(desktop, /macos-latest/);
  assert.match(desktop, /nsis/);
  assert.match(desktop, /dmg/);
  assert.match(desktop, /upload-artifact/);
  assert.match(desktop, /1\.99\.1/);
  assert.equal(desktop.includes('pull_request'), false);
  assert.equal(desktop.includes('softprops/action-gh-release'), false);
  assert.equal(desktop.includes('create-release'), false);
  assert.equal(ci.includes('desktop:build'), false);
  assert.equal(ci.includes('tauri build'), false);
  assert.match(ci, /workflows\/desktop\.yml/);
});
