import test from 'node:test';
import assert from 'node:assert/strict';

import { DEVICE_CATALOG } from '../src/domain/catalog.js';
import { isGenericModelLayoutWithinBounds } from '../src/domain/generic-model-layouts.js';

test('generic office desk layout remains inside its catalog footprint', () => {
  assert.equal(isGenericModelLayoutWithinBounds('office-desk'), true);
});

test('generic monitor layouts remain inside their catalog footprints', () => {
  for (const modelId of ['monitor-24', 'monitor-27', 'ultrawide-monitor']) {
    assert.equal(isGenericModelLayoutWithinBounds(modelId), true);
  }
});

test('generic desktop PC layout remains inside its catalog footprint', () => {
  assert.equal(isGenericModelLayoutWithinBounds('desktop-pc'), true);
});

test('generic power adapter layout remains inside its catalog footprint', () => {
  assert.equal(isGenericModelLayoutWithinBounds('power-adapter'), true);
});

test('generic wall outlet layout remains inside its catalog footprint', () => {
  assert.equal(isGenericModelLayoutWithinBounds('wall-outlet'), true);
});

test('generic router layout remains inside its catalog footprint', () => {
  assert.equal(isGenericModelLayoutWithinBounds('router'), true);
});

test('generic power strip layout remains inside its catalog footprint', () => {
  assert.equal(isGenericModelLayoutWithinBounds('power-strip'), true);
});

test('generic laptop layout remains inside its catalog footprint', () => {
  assert.equal(isGenericModelLayoutWithinBounds('laptop-15'), true);
});

test('every catalog model keeps an in-bounds generic layout as its load fallback', () => {
  const modelIds = DEVICE_CATALOG.flatMap(category => category.models).map(model => model.modelId);

  for (const modelId of modelIds) {
    assert.equal(isGenericModelLayoutWithinBounds(modelId), true, `${modelId} should have an in-bounds layout`);
  }
});
