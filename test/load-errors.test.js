import test from 'node:test';
import assert from 'node:assert/strict';

import { isCodeDownloadError } from '../src/domain/load-errors.js';

test('chunk download failures from each browser are recognised', () => {
  for (const message of [
    'Failed to fetch dynamically imported module: https://example.com/assets/Scene3D-abc.js',
    'Importing a module script failed.',
    'error loading dynamically imported module: https://example.com/assets/Scene3D-abc.js',
  ]) {
    assert.equal(isCodeDownloadError(new TypeError(message)), true, message);
  }
});

test('other errors are not mistaken for a download failure', () => {
  assert.equal(isCodeDownloadError(new Error('Error creating WebGL context')), false);
  assert.equal(isCodeDownloadError(null), false);
  assert.equal(isCodeDownloadError({}), false);
});
