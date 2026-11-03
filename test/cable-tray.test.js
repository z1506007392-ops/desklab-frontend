import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCableShoppingList } from '../src/domain/cable-shopping-list.js';
import {
  drawCablePoints,
  findHostDesk,
  isTrayMountedOn,
  placeCableTray,
  remountCableTray,
} from '../src/domain/cable-tray.js';
import { routeCable } from '../src/domain/cable-route.js';
import { findModelTemplate, hydrateProjectObjects } from '../src/domain/catalog.js';
import { getConnectionEndpoints, getConnectionRoute } from '../src/domain/connections.js';
import { buildTemplateScene } from '../src/domain/desk-templates.js';
import { analyzeProjectLayout, findSupportingObject } from '../src/domain/layout-analysis.js';
import { placeCatalogObject } from '../src/domain/placement.js';
import { findRiders, moveWithRiders, removeAndDropRiders } from '../src/domain/riders.js';

const room = { length: 4, width: 3.5, height: 2.7 };

function desk(extra = {}) {
  return {
    id: 'desk', modelId: 'office-desk', type: 'office-desk', category: 'furniture', name: '书桌', shape: 'rect',
    position: { x: 0, y: 0, z: 0.375 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1.4, y: 0.7, z: 0.75 },
    ...extra,
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

function trayTemplate() {
  return findModelTemplate({ modelId: 'cable-tray' });
}

function addTray(objects, id = 'tray') {
  const placed = placeCatalogObject({
    modelTemplate: trayTemplate(),
    categoryId: 'accessory',
    room,
    id,
    objects,
  });
  assert.equal(placed.valid, true);
  return placed.object;
}

function routeOf(objects) {
  const connection = {
    id: 'c', fromObjectId: 'pc', fromPortId: 'p', toObjectId: 'monitor', toPortId: 'p', cableType: 'hdmi', length: 3, name: '线',
  };
  return getConnectionRoute(connection, objects);
}

test('a new tray hangs under the back of the desk and does not count as floating or overlapping it', () => {
  const deskObject = desk();
  const tray = addTray([deskObject]);
  assert.ok(isTrayMountedOn(tray, deskObject));
  assert.equal(findHostDesk(tray, [deskObject, tray])?.id, 'desk');
  assert.equal(findSupportingObject(tray, [deskObject, tray])?.id, 'desk');
  assert.ok(tray.position.z < 0.75, 'under the desktop');
  assert.ok(tray.position.z > 0.4, 'not sitting on the floor');
  assert.ok(tray.position.y > 0.15, 'toward the back edge');
  const issues = analyzeProjectLayout(room, [deskObject, tray]);
  assert.equal(issues.some(issue => issue.code === 'floating_object'), false);
  assert.equal(issues.some(issue => issue.code === 'object_overlap'), false);
});

test('without a desk the tray sits on the floor', () => {
  const tray = addTray([]);
  assert.equal(findHostDesk(tray, [tray]), null);
  assert.ok(Math.abs(tray.position.z - tray.scale.z / 2) < 1e-6);
});

function longSurfaceRun(points, deskObject) {
  const top = deskObject.position.z + deskObject.scale.z / 2;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const point = points[index];
    if (Math.abs(previous.z - top) > 0.01 || Math.abs(point.z - top) > 0.01) continue;
    if (Math.hypot(previous.x - point.x, previous.y - point.y) > 0.08) return true;
  }
  return false;
}

test('each preset hangs one tray under the back, beside the strip', () => {
  for (const id of ['home-office', 'desktop-dual', 'gaming']) {
    const scene = buildTemplateScene(id);
    const trays = scene.objects.filter(object => object.modelId === 'cable-tray');
    assert.equal(trays.length, 1, id);
    const deskObject = scene.objects.find(object => object.modelId === 'office-desk');
    assert.equal(findHostDesk(trays[0], scene.objects)?.id, deskObject.id, id);
    assert.ok(trays[0].position.z > 0.4, id);
    const issues = analyzeProjectLayout(scene.room, scene.objects);
    assert.equal(issues.some(issue => issue.code === 'object_overlap' || issue.code === 'floating_object'), false, id);
  }
});

test('a tray still hangs under a preset desk when the strip is already there', () => {
  for (const id of ['home-office', 'desktop-dual', 'gaming']) {
    const scene = buildTemplateScene(id);
    const objects = scene.objects.filter(object => object.modelId !== 'cable-tray');
    const tray = placeCatalogObject({
      modelTemplate: trayTemplate(),
      categoryId: 'accessory',
      room: scene.room,
      id: 'tray',
      objects,
    });
    assert.equal(tray.valid, true, id);
    const deskObject = objects.find(object => object.modelId === 'office-desk');
    const withTray = [...objects, tray.object];
    assert.equal(findHostDesk(tray.object, withTray)?.id, deskObject.id, id);
    assert.ok(tray.object.position.z > 0.4, id);
    const issues = analyzeProjectLayout(scene.room, withTray);
    assert.equal(issues.some(issue => issue.code === 'object_overlap' || issue.code === 'floating_object'), false, id);
  }
});

test('letting the tray go over the desk snaps it back underneath, and off the desk it can drop', () => {
  const deskObject = desk();
  const tray = addTray([deskObject]);
  const shifted = {
    ...tray,
    position: { x: 0.2, y: 0.05, z: 0.9 },
  };
  const mounted = remountCableTray(room, shifted, [deskObject, shifted]);
  assert.ok(isTrayMountedOn(mounted, deskObject));
  assert.ok(Math.abs(mounted.position.x - 0.2) < 0.06);

  const aside = { ...tray, position: { x: 2, y: 0, z: 0.9 } };
  assert.equal(remountCableTray(room, aside, [deskObject, aside]), null);
  assert.equal(placeCableTray({ ...tray, id: 'second' }, room, [deskObject, tray]), null, 'the first tray already fills the back');
});

test('a cable over the back edge is drawn into the tray, and the shop length stays the old route', () => {
  const objects = [desk(), onDesk('monitor', 0, 0.1, 0.5), device('pc', { x: 0.2, y: 0.9 })];
  const before = routeOf(objects);
  const tray = addTray(objects);
  const withTray = [...objects, tray];
  const after = routeOf(withTray);
  assert.equal(after.length, before.length);
  assert.deepEqual(after.points, before.points);

  const drawn = drawCablePoints(after.points, withTray);
  const inside = drawn.some(point => Math.abs(point.y - tray.position.y) < 1e-6 && point.z < tray.position.z);
  assert.equal(inside, true);
  assert.equal(longSurfaceRun(drawn, objects[0]), false);

  const side = [desk(), onDesk('monitor', 0.4, 0.1, 0.5), device('console', { x: 1.2, y: 0.1 })];
  const sideTray = addTray(side, 'side-tray');
  const sideObjects = [...side, sideTray];
  const connection = {
    id: 'c', fromObjectId: 'console', fromPortId: 'p', toObjectId: 'monitor', toPortId: 'p', cableType: 'hdmi', length: 3, name: '线',
  };
  const sideRoute = getConnectionRoute(connection, sideObjects);
  const sideDrawn = drawCablePoints(sideRoute.points, sideObjects);
  assert.equal(sideRoute.length, routeCable(
    getConnectionEndpoints(connection, side).from,
    getConnectionEndpoints(connection, side).to,
    side[2],
    side[1],
    side,
  ).length);
  assert.equal(longSurfaceRun(sideDrawn, side[0]), false);
  assert.ok(sideDrawn.some(point => point.z < sideTray.position.z));
});

test('a turned desk still tucks the cable into the tray on its own back edge', () => {
  const turned = desk({ rotation: { x: 0, y: 0, z: 90 } });
  const monitor = device('monitor', { x: 0, y: 0, z: 1 }, { x: 0.2, y: 0.2, z: 0.5 });
  const pc = device('pc', { x: -1, y: 0.1 });
  const objects = [turned, monitor, pc];
  const tray = addTray(objects, 'turned-tray');
  assert.equal(Math.round(tray.rotation.z), 90);
  const { from, to } = getConnectionEndpoints({
    fromObjectId: 'pc', fromPortId: 'p', toObjectId: 'monitor', toPortId: 'p',
  }, [...objects, tray]);
  const measured = routeCable(from, to, pc, monitor, objects);
  const tucked = routeCable(from, to, pc, monitor, [...objects, tray]);
  assert.equal(tucked.length, measured.length);
  const drawn = drawCablePoints(tucked.points, [...objects, tray]);
  assert.ok(drawn.some(point => point.z < tray.position.z && Math.abs(point.x - tray.position.x) < tray.scale.y));
});

test('the shop list gains one tray line and does not shorten the cables', () => {
  const scene = buildTemplateScene('gaming');
  const objects = hydrateProjectObjects(scene.objects).filter(object => object.modelId !== 'cable-tray');
  const before = buildCableShoppingList(scene.connections, objects);
  const tray = addTray(objects, 'shop-tray');
  const after = buildCableShoppingList(scene.connections, [...objects, tray]);
  assert.deepEqual(after.items.slice(0, -1), before.items);
  assert.deepEqual(after.items.at(-1), { name: '桌下理线槽', length: null, quantity: 1 });
  assert.match(after.text, /桌下理线槽 ×1/);
  assert.equal(buildCableShoppingList([], [tray]).text, '要买的线\n- 桌下理线槽 ×1');
});

test('preset cables drop into the tray on screen and stay the same length to buy', () => {
  for (const id of ['home-office', 'desktop-dual', 'gaming']) {
    const scene = buildTemplateScene(id);
    const deskObject = scene.objects.find(object => object.modelId === 'office-desk');
    const bare = scene.objects.filter(object => object.modelId !== 'cable-tray');
    const withList = buildCableShoppingList(scene.connections, scene.objects);
    const bareList = buildCableShoppingList(scene.connections, bare);
    assert.deepEqual(withList.items.slice(0, -1), bareList.items, id);
    assert.deepEqual(withList.items.at(-1), { name: '桌下理线槽', length: null, quantity: 1 }, id);
    for (const connection of scene.connections) {
      const measured = getConnectionRoute(connection, scene.objects);
      const without = getConnectionRoute(connection, bare);
      assert.equal(measured.length, without.length, `${id} ${connection.name}`);
      const drawn = drawCablePoints(measured.points, scene.objects);
      assert.equal(longSurfaceRun(drawn, deskObject), false, `${id} ${connection.name}`);
    }
  }
});

test('the tray rides the desk and drops to the floor when the desk is removed', () => {
  const deskObject = desk();
  const tray = addTray([deskObject]);
  const objects = [deskObject, tray];
  assert.deepEqual(findRiders(deskObject, objects).map(object => object.id), ['tray']);
  const moved = { ...deskObject, position: { ...deskObject.position, x: 0.4 } };
  const carried = moveWithRiders(objects, deskObject, moved, room).find(object => object.id === 'tray');
  assert.ok(Math.abs(carried.position.x - tray.position.x - 0.4) < 1e-6);
  assert.equal(findHostDesk(carried, [moved, carried])?.id, 'desk');
  const dropped = removeAndDropRiders(objects, 'desk', room);
  const fallen = dropped.objects.find(object => object.id === 'tray');
  assert.ok(Math.abs(fallen.position.z - fallen.scale.z / 2) < 1e-6);
  assert.equal(findHostDesk(fallen, dropped.objects), null);
});
