import test from 'node:test';
import assert from 'node:assert/strict';

import { findPowerTags } from '../src/domain/power-tags.js';
import { hydrateProjectObjects } from '../src/domain/catalog.js';
import { buildTemplateScene } from '../src/domain/desk-templates.js';

function template(id) {
  const scene = buildTemplateScene(id);
  return { objects: hydrateProjectObjects(scene.objects), connections: scene.connections };
}

test('a desk whose power is fine gets no power tags', () => {
  for (const id of ['home-office', 'desktop-dual', 'gaming']) {
    const { objects, connections } = template(id);
    assert.deepEqual(findPowerTags(objects, connections), [], id);
  }
});

test('a strip over its limit is tagged as overloaded, and only the strip', () => {
  const { objects, connections } = template('gaming');
  const strip = objects.find(object => object.modelId === 'power-strip');
  strip.maxLoad = 450;
  const tags = findPowerTags(objects, connections);
  assert.equal(tags.length, 1);
  assert.equal(tags[0].objectId, strip.id);
  assert.equal(tags[0].status, 'overload');
  assert.match(tags[0].text, /^超载 \d+W \/ 450W$/);
  assert.ok(tags[0].load > 450);
});

test('a strip close to its limit is tagged as near it', () => {
  const { objects, connections } = template('gaming');
  const strip = objects.find(object => object.modelId === 'power-strip');
  const { load } = findPowerTags(objects, connections).find(() => true) ?? {};
  assert.equal(load, undefined, 'nothing tagged before the change');
  strip.maxLoad = 540;
  const [tag] = findPowerTags(objects, connections);
  assert.equal(tag.status, 'warning');
  assert.match(tag.text, /^接近上限 \d+W \/ 540W$/);
});

test('missing or broken data gives no tags instead of throwing', () => {
  assert.deepEqual(findPowerTags(null, undefined), []);
  assert.deepEqual(findPowerTags([{ id: 'x', ports: [{ id: 'o', type: 'ac_output' }] }], []), []);
});
