import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { ASSET_REVISIONS } from '../src/domain/asset-revisions.js';
import { catalogFontUrl, catalogModelUrl, catalogThumbnailUrl, isCatalogModelUrl } from '../src/domain/catalog.js';
import { PROJECT_STORAGE_KEY } from '../src/domain/local-project-store.js';
import {
  collectAssetRevisions,
  earlyModelPreloadScript,
  headersFile,
} from '../tools/static-delivery.mjs';

const publicDir = fileURLToPath(new URL('../public/', import.meta.url));

test('asset revisions match the files that are shipped', () => {
  assert.deepEqual(ASSET_REVISIONS, collectAssetRevisions(publicDir));
});

test('catalog URLs carry the content revision and still point at the file', () => {
  const model = new URL(catalogModelUrl('laptop-15'), 'https://desklab.local');
  assert.equal(model.pathname, '/models/laptop-15.glb');
  assert.equal(model.searchParams.get('v'), ASSET_REVISIONS['models/laptop-15.glb']);
  const thumb = new URL(catalogThumbnailUrl('laptop-15'), 'https://desklab.local');
  assert.equal(thumb.pathname, '/thumbnails/laptop-15.webp');
  assert.equal(thumb.searchParams.get('v'), ASSET_REVISIONS['thumbnails/laptop-15.webp']);
  const font = new URL(catalogFontUrl(), 'https://desklab.local');
  assert.equal(font.pathname, '/fonts/axis-label.woff');
  assert.equal(font.searchParams.get('v'), ASSET_REVISIONS['fonts/axis-label.woff']);
});

test('catalog model URLs are recognized with or without a revision', () => {
  assert.equal(isCatalogModelUrl(catalogModelUrl('router')), true);
  assert.equal(isCatalogModelUrl('/models/router.glb'), true);
  assert.equal(isCatalogModelUrl('/models/not-a-device.glb'), false);
  assert.equal(isCatalogModelUrl('/thumbnails/router.webp'), false);
  assert.equal(isCatalogModelUrl(''), false);
});

test('the Pages headers file matches the delivery rules', () => {
  const headers = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
  assert.equal(headers, headersFile());
  assert.match(headers, /\/assets\/\*\n {2}Cache-Control: public, max-age=31536000, immutable/);
  assert.match(headers, /\/models\/\*\n {2}Content-Type: model\/gltf-binary\n {2}Content-Encoding: br/);
  assert.doesNotMatch(headers, /api[_-]?key|token|secret/i);
});

test('the early preload script names only the saved project models', () => {
  const script = earlyModelPreloadScript(PROJECT_STORAGE_KEY, {
    'models/router.glb': 'abcd1234',
    'models/office-desk.glb': '00112233',
    'thumbnails/router.webp': 'ffffeeee',
  });
  assert.match(script, new RegExp(PROJECT_STORAGE_KEY.replace(/\./g, '\\.')));
  assert.match(script, /router/);
  assert.match(script, /abcd1234/);
  assert.match(script, /fetchPriority='low'/);
  assert.doesNotMatch(script, /modulepreload/);
  assert.doesNotMatch(script, /ffffeeee/);
  assert.doesNotMatch(script, /api[_-]?key|token|secret/i);
});
