import test from 'node:test';
import assert from 'node:assert/strict';

import { buildFreeImprovements } from '../src/domain/recommendations.js';
import { STANDARD_CABLE_LENGTHS, evaluateConnectionLength } from '../src/domain/connections.js';
import { hydrateProjectObjects } from '../src/domain/catalog.js';
import { buildTemplateScene } from '../src/domain/desk-templates.js';

const ROOM = { length: 4, width: 3.5, height: 2.7 };

function gamingDesk() {
  const scene = buildTemplateScene('gaming');
  return { objects: hydrateProjectObjects(scene.objects), connections: scene.connections };
}

// A cable auto-wiring adds, or a free fix lengthens, is a size people can
// buy and covers its route plus the 10% the length check asks for, like the
// ones templates come with.
function assertSizedLikeTemplates(connection, objects, label) {
  assert.ok(STANDARD_CABLE_LENGTHS.includes(connection.length), `${label}: ${connection.length} m is not a common size`);
  assert.equal(evaluateConnectionLength(connection, objects).hasRecommendedSlack, true, `${label}: too short for its route`);
}

test('a screen cable auto-wiring adds is a common size that covers the route', () => {
  const { objects, connections } = gamingDesk();
  const remaining = connections.filter(connection => connection.cableType !== 'displayport');
  const suggestion = buildFreeImprovements(ROOM, objects, remaining).find(item => item.code === 'auto_connect_display');
  assert.ok(suggestion, 'the computer is offered a screen cable again');
  assertSizedLikeTemplates(suggestion.patch.newConnection, objects, 'display');
});

test('a power cable auto-wiring adds is a common size that covers the route', () => {
  const { objects, connections } = gamingDesk();
  const tower = objects.find(object => object.modelId === 'desktop-pc');
  const remaining = connections.filter(connection => !(connection.toObjectId === tower.id && connection.cableType === 'power'));
  const suggestion = buildFreeImprovements(ROOM, objects, remaining).find(item => item.code === 'auto_power_device');
  assert.ok(suggestion, 'the tower is offered a power cable again');
  assertSizedLikeTemplates(suggestion.patch.newConnection, objects, 'power');
});

test('lengthening a short cable picks a common size, not a centimetre figure', () => {
  const { objects, connections } = gamingDesk();
  const shortened = connections.map(connection => connection.cableType === 'displayport' ? { ...connection, length: 0.5 } : connection);
  const display = shortened.find(connection => connection.cableType === 'displayport');
  const suggestion = buildFreeImprovements(ROOM, objects, shortened).find(item => item.code === 'extend_cable');
  assert.ok(suggestion, 'the short display cable is offered a longer length');
  assertSizedLikeTemplates({ ...display, length: suggestion.patch.length }, objects, 'extended');
});
