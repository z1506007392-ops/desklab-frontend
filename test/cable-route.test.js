import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CABLE_EDGE_CLEARANCE,
  findCableDesk,
  routeCable,
} from '../src/domain/cable-route.js';
import { buildCableShoppingList } from '../src/domain/cable-shopping-list.js';
import { evaluateConnectionLength, getConnectionEndpoints, getConnectionRoute } from '../src/domain/connections.js';
import { hydrateProjectObjects } from '../src/domain/catalog.js';
import { buildTemplateScene } from '../src/domain/desk-templates.js';

// A 1.4 x 0.7 desk, top at 0.75, the person sitting on its -y side.
function desk(rotation = 0) {
  return {
    id: 'desk', modelId: 'office-desk', type: 'office-desk', name: '书桌', shape: 'rect',
    position: { x: 0, y: 0, z: 0.375 }, rotation: { x: 0, y: 0, z: rotation }, scale: { x: 1.4, y: 0.7, z: 0.75 },
  };
}

function device(id, position, scale = { x: 0.2, y: 0.2, z: 0.4 }) {
  return {
    id, type: 'device', name: id, shape: 'rect',
    position: { x: position.x, y: position.y, z: position.z ?? scale.z / 2 }, rotation: { x: 0, y: 0, z: 0 }, scale,
    ports: [{ id: 'p', name: '接口', type: 'hdmi', direction: 'bidirectional', anchor: { x: 0, y: 0.5, z: 0 } }],
  };
}

const onDesk = (id, x, y, height = 0.4) => device(id, { x, y, z: 0.75 + height / 2 }, { x: 0.2, y: 0.2, z: height });
const straight = (from, to) => Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-6, `${message}: ${actual} vs ${expected}`);

function route(objects, fromId, toId) {
  const connection = { id: 'c', fromObjectId: fromId, fromPortId: 'p', toObjectId: toId, toPortId: 'p', cableType: 'hdmi', length: 3, name: '线' };
  return getConnectionRoute(connection, objects);
}

test('two devices that are not on a desk are joined straight, as before', () => {
  const objects = [desk(), device('a', { x: 1.5, y: 1 }), device('b', { x: 1.5, y: -1 })];
  const { points, length } = route(objects, 'a', 'b');
  assert.equal(points.length, 2);
  near(length, straight(points[0], points[1]), 'length');
});

test('two devices on the same desk are joined across the desktop', () => {
  const objects = [desk(), onDesk('laptop', -0.4, 0, 0.02), onDesk('monitor', 0.3, 0.1, 0.5)];
  const { points, length } = route(objects, 'laptop', 'monitor');
  assert.equal(points.length, 4);
  near(points[1].z, 0.75, 'it lies on the desktop');
  near(points[2].z, 0.75, 'it lies on the desktop');
  const [from, , , to] = points;
  near(length, (from.z - 0.75) + Math.hypot(to.x - from.x, to.y - from.y) + (to.z - 0.75), 'down, across, up');
});

test('from the floor behind the desk the cable comes over the back edge, not through the desktop', () => {
  const objects = [desk(), onDesk('monitor', 0, 0.1, 0.5), device('pc', { x: 0.2, y: 0.9 })];
  const { points, length } = route(objects, 'pc', 'monitor');
  const over = points.find(point => Math.abs(point.z - 0.75) < 1e-9 && Math.abs(point.y) > 0.35);
  assert.ok(over, 'it crosses the desk height outside the desktop');
  near(over.y, 0.35 + CABLE_EDGE_CLEARANCE, 'just past the back edge');
  // Nothing between the plug and the edge cuts through the board.
  for (const point of points) {
    const insideBoard = Math.abs(point.x) < 0.7 && Math.abs(point.y) < 0.35 && point.z < 0.75 - 1e-9;
    assert.equal(insideBoard, false, `point ${JSON.stringify(point)} is inside the desk`);
  }
  assert.ok(length > straight(points[0], points[points.length - 1]));
});

test('from the floor on the seat side the cable goes round a side edge, never past the person', () => {
  const objects = [desk(), onDesk('monitor', 0.4, 0.1, 0.5), device('console', { x: 0.2, y: -0.9 })];
  const { points } = route(objects, 'console', 'monitor');
  const over = points.find(point => Math.abs(point.z - 0.75) < 1e-9 && (Math.abs(point.x) > 0.7 || Math.abs(point.y) > 0.35));
  near(over.x, 0.7 + CABLE_EDGE_CLEARANCE, 'over the right edge, the nearer side');
  assert.ok(points.every(point => point.y > -0.35 - 1e-9 || point.z < 0.75 - 0.05), 'it never crosses the front edge');
});

test('a turned desk turns its back edge with it', () => {
  // Turned 90°, the desk's back (local +y) faces world -x.
  const objects = [desk(90), onDesk('monitor', 0, 0, 0.5), device('pc', { x: -1, y: 0.1 })];
  const { points } = route(objects, 'pc', 'monitor');
  const over = points.find(point => Math.abs(point.z - 0.75) < 1e-9 && Math.abs(point.x) > 0.3);
  near(over.x, -(0.35 + CABLE_EDGE_CLEARANCE), 'over the back edge, now facing -x');
});

test('a monitor on a stand on the desk counts as on the desk', () => {
  const stand = { ...onDesk('stand', 0, 0.1, 0.45), modelId: 'monitor-stand', type: 'monitor-stand', ports: [] };
  const monitor = device('monitor', { x: 0, y: 0.1, z: 1.2 + 0.25 }, { x: 0.2, y: 0.2, z: 0.5 });
  const objects = [desk(), stand, monitor];
  assert.equal(findCableDesk(monitor, objects)?.id, 'desk');
  assert.equal(findCableDesk(objects[0], objects), null, 'the desk itself is on the floor');
});

test('a route is never shorter than the straight line, on every template', () => {
  for (const id of ['home-office', 'desktop-dual', 'gaming']) {
    const scene = buildTemplateScene(id);
    const objects = hydrateProjectObjects(scene.objects);
    for (const connection of scene.connections) {
      const { from, to } = getConnectionEndpoints(connection, objects);
      const fromObject = objects.find(object => object.id === connection.fromObjectId);
      const toObject = objects.find(object => object.id === connection.toObjectId);
      const { length } = routeCable(from, to, fromObject, toObject, objects);
      assert.ok(length >= straight(from, to) - 1e-9, `${id} ${connection.id}`);
    }
  }
});

test('a cable that reaches in a straight line but not over the desk edge is too short', () => {
  const objects = [desk(), onDesk('monitor', 0, 0.1, 0.5), device('pc', { x: 0.2, y: 0.9 })];
  const connection = { id: 'c', fromObjectId: 'pc', fromPortId: 'p', toObjectId: 'monitor', toPortId: 'p', cableType: 'hdmi', name: '线' };
  const { from, to } = getConnectionEndpoints(connection, objects);
  const status = evaluateConnectionLength({ ...connection, length: straight(from, to) + 0.05 }, objects);
  assert.equal(status.sufficient, false);
  assert.ok(status.distance > straight(from, to));
});

test('the cable list buys the gaming desk a display cable long enough to go over the desk edge', () => {
  const scene = buildTemplateScene('gaming');
  const objects = hydrateProjectObjects(scene.objects);
  const display = scene.connections.filter(connection => connection.cableType === 'displayport');
  const { items } = buildCableShoppingList(display, objects);
  // Straight through the desktop would buy 1.5 m. Over the back edge the
  // route is about 1.51 m, and 0.2 m of shop slack buys 2 m.
  assert.deepEqual(items.map(item => item.name), ['2 米 DP 线']);
});
