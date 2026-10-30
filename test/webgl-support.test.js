import test from 'node:test';
import assert from 'node:assert/strict';

import { canUseWebGL, createRendererOrReport } from '../src/domain/webgl-support.js';

const canvasWith = contexts => () => ({ getContext: type => contexts[type] ?? null });

test('a browser with WebGL 2 or WebGL 1 can show the 3D view', () => {
  let released = false;
  const context = { getExtension: () => ({ loseContext: () => { released = true; } }) };
  assert.equal(canUseWebGL(canvasWith({ webgl2: context })), true);
  assert.equal(released, true, 'the probe context is released');
  assert.equal(canUseWebGL(canvasWith({ webgl: {} })), true);
  assert.equal(canUseWebGL(canvasWith({ 'experimental-webgl': {} })), true);
});

test('no context or a throwing canvas means no 3D view', () => {
  assert.equal(canUseWebGL(canvasWith({})), false);
  assert.equal(canUseWebGL(() => { throw new Error('blocked'); }), false);
  assert.equal(canUseWebGL(() => ({ getContext: () => { throw new Error('GPU blocklisted'); } })), false);
});

test('a renderer that cannot start is reported instead of thrown', async () => {
  const renderer = { kind: 'renderer' };
  const failures = [];
  assert.equal(createRendererOrReport(() => renderer, { antialias: true }, error => failures.push(error)), renderer);
  assert.deepEqual(failures, []);

  const result = createRendererOrReport(() => { throw new Error('Error creating WebGL context'); }, {}, error => failures.push(error));
  assert.equal(failures.length, 1);
  assert.equal(failures[0].message, 'Error creating WebGL context');
  assert.ok(result instanceof Promise, 'R3F is handed a promise that never settles');
  const settled = await Promise.race([result.then(() => 'settled'), new Promise(resolve => setTimeout(() => resolve('pending'), 20))]);
  assert.equal(settled, 'pending');
});
