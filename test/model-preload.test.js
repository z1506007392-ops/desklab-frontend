import assert from 'node:assert/strict';
import test from 'node:test';
import { partitionModelPreload } from '../src/domain/model-preload.js';

test('an empty room preloads nothing until the catalog is idle', () => {
  const catalog = ['/models/a.glb', '/models/b.glb'];
  assert.deepEqual(partitionModelPreload([], catalog), { now: [], later: catalog });
});

test('the open project is preloaded now and the rest later', () => {
  const plan = partitionModelPreload(
    ['/models/desk.glb', null, '/models/desk.glb', '/models/pc.glb'],
    ['/models/desk.glb', '/models/pc.glb', '/models/lamp.glb'],
  );
  assert.deepEqual(plan, {
    now: ['/models/desk.glb', '/models/pc.glb'],
    later: ['/models/lamp.glb'],
  });
});

test('a model that is not in the catalog is still preloaded now', () => {
  const plan = partitionModelPreload(['/custom/thing.glb'], ['/models/desk.glb']);
  assert.deepEqual(plan.now, ['/custom/thing.glb']);
  assert.deepEqual(plan.later, ['/models/desk.glb']);
});
