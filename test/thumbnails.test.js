import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { DEVICE_CATALOG, catalogThumbnailUrl } from '../src/domain/catalog.js';

// Width and height of a WebP file, from its VP8X, VP8L or VP8 header.
function webpSize(bytes) {
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
  const chunk = bytes.toString('ascii', 12, 16);
  if (chunk === 'VP8X') return [1 + bytes.readUIntLE(24, 3), 1 + bytes.readUIntLE(27, 3)];
  if (chunk === 'VP8L') {
    const bits = bytes.readUInt32LE(21);
    return [1 + (bits & 0x3fff), 1 + ((bits >> 14) & 0x3fff)];
  }
  if (chunk === 'VP8 ') return [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff];
  throw new Error(`unknown WebP chunk ${chunk}`);
}

test('every catalog device has a 112 px library picture that says where it came from', () => {
  for (const model of DEVICE_CATALOG.flatMap(category => category.models)) {
    const url = new URL(catalogThumbnailUrl(model.modelId), 'https://desklab.local');
    assert.equal(url.pathname, `/thumbnails/${model.modelId}.webp`);
    assert.match(url.searchParams.get('v'), /^[0-9a-f]{8}$/);
    const file = new URL(`../public${url.pathname}`, import.meta.url);
    assert.deepEqual(webpSize(readFileSync(file)), [112, 112], model.modelId);
    const provenance = JSON.parse(readFileSync(new URL(`../public${url.pathname}.json`, import.meta.url), 'utf8'));
    assert.match(provenance.prompt, new RegExp(`public/models/${model.modelId}\\.glb`), model.modelId);
  }
});
