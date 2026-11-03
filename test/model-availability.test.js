import test from 'node:test';
import assert from 'node:assert/strict';

import { createModelAvailabilityChecker, isUsableModelResponse } from '../src/domain/model-availability.js';

const response = (status, type) => ({ ok: status >= 200 && status < 300, status, headers: new Headers(type ? { 'content-type': type } : {}) });

test('a model file is usable only when it exists and is not an HTML page', () => {
  assert.equal(isUsableModelResponse(response(200, 'model/gltf-binary')), true);
  assert.equal(isUsableModelResponse(response(200, 'application/octet-stream')), true);
  assert.equal(isUsableModelResponse(response(200)), true);
  assert.equal(isUsableModelResponse(response(404, 'text/plain')), false);
  assert.equal(isUsableModelResponse(response(200, 'text/html; charset=utf-8')), false, 'SPA fallback page');
  assert.equal(isUsableModelResponse(undefined), false);
});

test('each model is checked once with a HEAD request and the result is remembered', async () => {
  const calls = [];
  const checker = createModelAvailabilityChecker(async (url, init) => {
    calls.push([url, init.method]);
    return url.includes('missing') ? response(404) : response(200, 'model/gltf-binary');
  });
  assert.equal(checker.peek('/models/router.glb'), 'pending');
  assert.equal(await checker.check('/models/router.glb'), true);
  assert.equal(await checker.check('/models/router.glb'), true);
  assert.equal(await checker.check('/models/missing.glb'), false);
  assert.deepEqual(calls, [['/models/router.glb', 'HEAD'], ['/models/missing.glb', 'HEAD']]);
  assert.equal(checker.peek('/models/router.glb'), 'available');
  assert.equal(checker.peek('/models/missing.glb'), 'missing');
});

test('a remote or script model address is missing and is never fetched', async () => {
  const checker = createModelAvailabilityChecker(async () => { throw new Error('fetch must not run'); });
  for (const url of ['https://evil.test/models/x.glb', 'javascript:alert(1)']) {
    assert.equal(await checker.check(url), false);
    assert.equal(checker.peek(url), 'missing');
  }
});

test('a network failure counts as missing instead of throwing', async () => {
  const checker = createModelAvailabilityChecker(async () => { throw new TypeError('Failed to fetch'); });
  assert.equal(await checker.check('/models/desk.glb'), false);
  assert.equal(checker.peek('/models/desk.glb'), 'missing');
});
