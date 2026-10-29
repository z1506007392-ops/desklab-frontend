import test from 'node:test';
import assert from 'node:assert/strict';

import { DEVICE_CATALOG } from '../src/domain/catalog.js';
import { getGenericModelAsset, hasGenericModelAsset } from '../src/domain/model-assets.js';

test('monitor catalog models resolve to the generic in-house monitor asset', () => {
  for (const modelId of ['monitor-24', 'monitor-27', 'ultrawide-monitor']) {
    const asset = getGenericModelAsset(modelId);

    assert.equal(asset.id, 'generic-monitor');
    assert.equal(asset.source, 'in-house-generated');
    assert.equal(asset.license, 'DeskLab-owned');
    assert.equal(asset.category, 'display');
  }
});

test('power strip resolves to the generic in-house power asset', () => {
  const asset = getGenericModelAsset('power-strip');

  assert.equal(asset.id, 'generic-power-strip');
  assert.equal(asset.source, 'in-house-generated');
  assert.equal(asset.license, 'DeskLab-owned');
  assert.equal(asset.category, 'power');
});

test('router resolves to the generic in-house network asset', () => {
  const asset = getGenericModelAsset('router');

  assert.equal(asset.id, 'generic-router');
  assert.equal(asset.source, 'in-house-generated');
  assert.equal(asset.license, 'DeskLab-owned');
  assert.equal(asset.category, 'network');
});

test('desktop pc resolves to the generic in-house computer asset', () => {
  const asset = getGenericModelAsset('desktop-pc');

  assert.equal(asset.id, 'generic-desktop-pc');
  assert.equal(asset.source, 'in-house-generated');
  assert.equal(asset.license, 'DeskLab-owned');
  assert.equal(asset.category, 'computer');
});

test('power adapter resolves to the generic in-house power asset', () => {
  const asset = getGenericModelAsset('power-adapter');

  assert.equal(asset.id, 'generic-power-adapter');
  assert.equal(asset.source, 'in-house-generated');
  assert.equal(asset.license, 'DeskLab-owned');
  assert.equal(asset.category, 'power');
});

test('wall outlet resolves to the generic in-house power asset', () => {
  const asset = getGenericModelAsset('wall-outlet');

  assert.equal(asset.id, 'generic-wall-outlet');
  assert.equal(asset.source, 'in-house-generated');
  assert.equal(asset.license, 'DeskLab-owned');
  assert.equal(asset.category, 'power');
});

test('laptop resolves to the generic in-house computer asset', () => {
  const asset = getGenericModelAsset('laptop-15');

  assert.equal(asset.id, 'generic-laptop');
  assert.equal(asset.source, 'in-house-generated');
  assert.equal(asset.license, 'DeskLab-owned');
  assert.equal(asset.category, 'computer');
});

test('office desk resolves to the generic in-house furniture asset', () => {
  const asset = getGenericModelAsset('office-desk');

  assert.equal(asset.id, 'generic-office-desk');
  assert.equal(asset.source, 'in-house-generated');
  assert.equal(asset.license, 'DeskLab-owned');
  assert.equal(asset.category, 'furniture');
});

test('every catalog model keeps a generic fallback asset alongside its GLB', () => {
  const models = DEVICE_CATALOG.flatMap(category => category.models.map(model => ({
    ...model,
    category: category.category,
  })));

  assert.ok(models.every(model => model.assetUrl));
  for (const model of models) {
    const asset = getGenericModelAsset(model.modelId);

    assert.ok(asset, `${model.modelId} should have a generic asset`);
    assert.equal(asset.category, model.category);
    assert.equal(asset.source, 'in-house-generated');
    assert.equal(asset.license, 'DeskLab-owned');
  }
});

test('unknown or externally loaded models keep the fallback rendering path', () => {
  assert.equal(getGenericModelAsset('missing-model'), null);
  assert.equal(hasGenericModelAsset('missing-model'), false);
  assert.equal(hasGenericModelAsset('monitor-24'), true);
});
