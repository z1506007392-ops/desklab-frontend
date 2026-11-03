import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const headersText = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function parseHeaders(text) {
  const blocks = [];
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    assert.ok(new TextEncoder().encode(line).byteLength <= 2000, `header line longer than 2000 bytes: ${line.slice(0, 40)}`);
    if (!/^[ \t]/.test(line)) {
      current = { path: line.trim(), headers: new Map() };
      blocks.push(current);
      continue;
    }
    assert.ok(current, 'a header line appeared before a path');
    const trimmed = line.trim();
    const split = trimmed.indexOf(':');
    assert.ok(split > 0, trimmed);
    const name = trimmed.slice(0, split).trim();
    const value = trimmed.slice(split + 1).trim();
    assert.equal(current.headers.has(name), false, `duplicate ${name} would be joined with a comma`);
    current.headers.set(name, value);
  }
  return blocks;
}

function directive(policy, name) {
  const part = policy.split(';').map(item => item.trim()).find(item => item === name || item.startsWith(`${name} `));
  assert.ok(part, `${name} missing from ${policy}`);
  return part.slice(name.length).trim().split(/\s+/).filter(Boolean);
}

const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
const scriptHash = createHash('sha256').update(script).digest('base64');

test('the static site sends the security headers without a cache header on the same line', () => {
  const blocks = parseHeaders(headersText);
  const site = blocks.find(block => block.path === '/*');
  assert.ok(site, 'a /* block is required so HTML and the app share the policy');
  assert.equal(site.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(site.headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
  assert.equal(site.headers.get('X-Frame-Options'), 'DENY');
  assert.equal(site.headers.has('Cache-Control'), false, 'cache rules belong in their own path block');

  const permissions = site.headers.get('Permissions-Policy');
  for (const feature of ['camera=()', 'microphone=()', 'geolocation=()', 'payment=()']) {
    assert.ok(permissions.includes(feature), feature);
  }
  assert.equal(permissions.includes('clipboard'), false, 'copy and paste of a project must stay allowed');
});

test('the content security policy allows this app and nothing fetched from another site', () => {
  const site = parseHeaders(headersText).find(block => block.path === '/*');
  const policy = site.headers.get('Content-Security-Policy');
  assert.equal(policy.includes('gstatic'), false);
  assert.equal(policy.includes('jsdelivr'), false);
  assert.equal(policy.includes('http:'), false);
  assert.equal(policy.includes('https:'), false);

  const scriptSrc = directive(policy, 'script-src');
  assert.ok(scriptSrc.includes("'self'"));
  assert.ok(scriptSrc.includes("'wasm-unsafe-eval'"));
  assert.ok(scriptSrc.includes(`'sha256-${scriptHash}'`));
  assert.equal(scriptSrc.includes("'unsafe-inline'"), false);
  assert.equal(scriptSrc.includes("'unsafe-eval'"), false);
  assert.equal(scriptSrc.includes('blob:'), false);

  assert.deepEqual(directive(policy, 'worker-src').sort(), ["'self'", 'blob:'].sort());
  assert.ok(directive(policy, 'style-src').includes("'unsafe-inline'"));
  const images = directive(policy, 'img-src');
  assert.ok(images.includes("'self'") && images.includes('blob:') && images.includes('data:'));
  assert.ok(directive(policy, 'font-src').includes('data:'));
  assert.deepEqual(directive(policy, 'connect-src'), ["'self'"]);
  assert.deepEqual(directive(policy, 'object-src'), ["'none'"]);
  assert.deepEqual(directive(policy, 'frame-ancestors'), ["'none'"]);
  assert.deepEqual(directive(policy, 'frame-src'), ["'none'"]);
  assert.deepEqual(directive(policy, 'base-uri'), ["'self'"]);
});
