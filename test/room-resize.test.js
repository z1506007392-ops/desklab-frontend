import test from 'node:test';
import assert from 'node:assert/strict';

import { refitLayoutToRoom } from '../src/domain/room-resize.js';
import { constrainProjectToRoom } from '../src/domain/geometry.js';
import { buildTemplateScene, DESK_TEMPLATES } from '../src/domain/desk-templates.js';
import { hydrateProjectObjects, DEVICE_CATALOG } from '../src/domain/catalog.js';
import { analyzeProjectLayout, findSupportingObject } from '../src/domain/layout-analysis.js';
import { analyzeProjectWiring } from '../src/domain/analysis.js';
import { placeCatalogObject } from '../src/domain/placement.js';

const isOutlet = object => object.modelId === 'wall-outlet';
const problems = (room, objects) => analyzeProjectLayout(room, objects)
  .filter(issue => issue.severity !== 'info').map(issue => issue.title);
const wiringProblems = (objects, connections) => analyzeProjectWiring(objects, connections)
  .filter(issue => issue.severity === 'error' || issue.severity === 'warning').map(issue => issue.code);
const CHANGES = [
  { width: -0.3 }, { width: -0.6 }, { width: -1 }, { length: -0.8 }, { length: -1.2, width: -0.5 },
  { width: 0.5 }, { length: 1 }, { length: 2, width: 1.5 },
];
const resized = (room, change) => Object.fromEntries(Object.entries(room).map(([key, value]) => [key, Math.round((value + (change[key] ?? 0)) * 1000) / 1000]));

for (const { id } of DESK_TEMPLATES) {
  test(`the ${id} template keeps its layout when the room is resized`, () => {
    const scene = buildTemplateScene(id);
    const objects = hydrateProjectObjects(scene.objects);
    for (const change of CHANGES) {
      const room = resized(scene.room, change);
      const result = refitLayoutToRoom(scene.room, room, objects);
      assert.equal(result.valid, true, JSON.stringify(change));
      assert.deepEqual(result.room, room);
      assert.deepEqual(problems(room, result.objects), [], `layout after ${JSON.stringify(change)}`);
      assert.deepEqual(wiringProblems(result.objects, scene.connections), [], `wiring after ${JSON.stringify(change)}`);
      // Every device keeps its place relative to the others: one shift for all.
      const layout = objects.filter(object => !isOutlet(object));
      const moved = id => result.objects.find(object => object.id === id);
      const [first] = layout;
      const dx = moved(first.id).position.x - first.position.x;
      const dy = moved(first.id).position.y - first.position.y;
      for (const object of layout) {
        assert.ok(Math.abs(moved(object.id).position.x - object.position.x - dx) < 1e-9, `${object.id} x after ${JSON.stringify(change)}`);
        assert.ok(Math.abs(moved(object.id).position.y - object.position.y - dy) < 1e-9, `${object.id} y after ${JSON.stringify(change)}`);
        assert.equal(moved(object.id).position.z, object.position.z);
      }
    }
  });
}

test('a desk against the back wall stays against it, and the outlet stays on that wall', () => {
  const scene = buildTemplateScene('gaming');
  const objects = hydrateProjectObjects(scene.objects);
  const desk = objects.find(object => object.modelId === 'office-desk');
  const outlet = objects.find(isOutlet);
  const gap = scene.room.width / 2 - (desk.position.y + desk.scale.y / 2);
  for (const width of [3, 4.5]) {
    const room = { ...scene.room, width };
    const result = refitLayoutToRoom(scene.room, room, objects);
    const movedDesk = result.objects.find(object => object.id === desk.id);
    const movedOutlet = result.objects.find(object => object.id === outlet.id);
    assert.ok(Math.abs(width / 2 - (movedDesk.position.y + movedDesk.scale.y / 2) - gap) < 1e-9, `same gap behind the desk at ${width} m`);
    assert.ok(Math.abs(movedOutlet.position.y - (outlet.position.y + (width - scene.room.width) / 2)) < 1e-9, `outlet on the back wall at ${width} m`);
    assert.ok(Math.abs(movedOutlet.position.x - outlet.position.x) < 1e-9, 'outlet keeps its place along the wall');
  }
});

const models = DEVICE_CATALOG.flatMap(category => category.models.map(model => ({ model, categoryId: category.category })));
const make = (modelId, objects, room, id = modelId) => {
  const { model, categoryId } = models.find(entry => entry.model.modelId === modelId);
  return placeCatalogObject({ modelTemplate: model, categoryId, room, id, objects }).object;
};

test('a layout in the middle of the room stays where it is while it fits', () => {
  const room = { length: 5, width: 5, height: 2.7 };
  const desk = make('office-desk', [], room);
  const screen = make('monitor-27', [desk], room);
  for (const next of [{ ...room, length: 3 }, { ...room, width: 6 }, { ...room, length: 7, width: 2.5 }]) {
    const result = refitLayoutToRoom(room, next, [desk, screen]);
    assert.deepEqual(result.objects.map(object => object.position), [desk.position, screen.position]);
  }
});

test('a layout across the whole room is pushed in piece by piece, carrying what stands on things', () => {
  const room = { length: 4, width: 3, height: 2.7 };
  const desk = make('office-desk', [], room, 'desk');
  // The desk against the right wall with a screen on it, a router against the left wall.
  const rightDesk = { ...desk, position: { ...desk.position, x: room.length / 2 - desk.scale.x / 2 } };
  const screen = make('monitor-27', [rightDesk], room, 'screen');
  const router = { ...make('router', [], room, 'router'), position: { x: -room.length / 2 + 0.15, y: 0, z: 0.04 } };
  const objects = [rightDesk, screen, router];
  assert.equal(findSupportingObject(screen, objects)?.id, 'desk');
  const next = { ...room, length: 3 };
  const result = refitLayoutToRoom(room, next, objects);
  assert.equal(result.valid, true);
  const [movedDesk, movedScreen, movedRouter] = result.objects;
  assert.ok(movedDesk.position.x + movedDesk.scale.x / 2 <= next.length / 2 + 1e-9, 'desk inside');
  assert.ok(Math.abs((movedScreen.position.x - movedDesk.position.x) - (screen.position.x - rightDesk.position.x)) < 1e-9, 'screen keeps its spot on the desk');
  assert.equal(findSupportingObject(movedScreen, result.objects)?.id, 'desk');
  assert.ok(movedRouter.position.x - movedRouter.scale.x / 2 >= -next.length / 2 - 1e-9, 'router inside');
  assert.deepEqual(problems(next, result.objects), []);
});

test('a room too small for a device is refused with the same reason as before', () => {
  const scene = buildTemplateScene('gaming');
  const objects = hydrateProjectObjects(scene.objects);
  const tiny = { ...scene.room, length: 1 };
  const result = refitLayoutToRoom(scene.room, tiny, objects);
  assert.equal(result.valid, false);
  assert.equal(result.reason, constrainProjectToRoom(tiny, objects).reason);
});
