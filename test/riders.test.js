import test from 'node:test';
import assert from 'node:assert/strict';

import { findRiders, moveWithRiders, removeAndDropRiders, updateWithRiders } from '../src/domain/riders.js';
import { buildTemplateScene } from '../src/domain/desk-templates.js';
import { hydrateProjectObjects, DEVICE_CATALOG } from '../src/domain/catalog.js';
import { analyzeProjectLayout, findSupportingObject } from '../src/domain/layout-analysis.js';
import { applyImprovement } from '../src/domain/recommendations.js';
import { placeCatalogObject } from '../src/domain/placement.js';

const room = { length: 4, width: 3.5, height: 2.7 };
const gaming = () => {
  const scene = buildTemplateScene('gaming');
  return { room: scene.room ?? room, objects: hydrateProjectObjects(scene.objects) };
};
const deskOf = objects => objects.find(object => object.modelId === 'office-desk' || /desk$/.test(object.type ?? ''));
const supportId = (object, objects) => findSupportingObject(object, objects)?.id ?? null;
const problemsIn = (project, objects) => analyzeProjectLayout(project.room, objects)
  .filter(issue => issue.severity !== 'info').map(issue => issue.title);

test('what stands on the desk rides it; what is on the floor does not', () => {
  const { objects } = gaming();
  const desk = deskOf(objects);
  const riders = findRiders(desk, objects).map(object => object.id);
  const onDesk = objects.filter(object => supportId(object, objects) === desk.id).map(object => object.id);
  assert.ok(onDesk.length >= 2, 'the template has things on the desk');
  assert.deepEqual([...riders].sort(), [...onDesk].sort());
  for (const object of objects.filter(item => findSupportingObject(item, objects)?.kind === 'floor')) {
    assert.ok(!riders.includes(object.id), `${object.id} stays on the floor`);
  }
});

test('a desk moved along the room takes what stands on it the same way', () => {
  const project = gaming();
  const { objects } = project;
  const desk = deskOf(objects);
  const moved = { ...desk, position: { ...desk.position, x: desk.position.x + 0.3, y: desk.position.y - 0.2 } };
  const next = moveWithRiders(objects, desk, moved, project.room);
  for (const before of objects) {
    const after = next.find(object => object.id === before.id);
    const rides = supportId(before, objects) === desk.id || before.id === desk.id;
    const shift = rides ? { x: 0.3, y: -0.2 } : { x: 0, y: 0 };
    assert.ok(Math.abs(after.position.x - before.position.x - shift.x) < 1e-9, `${before.id} x`);
    assert.ok(Math.abs(after.position.y - before.position.y - shift.y) < 1e-9, `${before.id} y`);
    assert.equal(after.position.z, before.position.z, `${before.id} z`);
    if (rides && before.id !== desk.id) assert.equal(supportId(after, next), desk.id, `${before.id} still on the desk`);
  }
});

test('a desk turned in place turns what stands on it about its centre', () => {
  const project = gaming();
  const { objects } = project;
  const desk = deskOf(objects);
  const riders = findRiders(desk, objects);
  for (const turn of [15, 90, 180]) {
    const turned = { ...desk, rotation: { ...desk.rotation, z: (desk.rotation.z + turn) % 360 } };
    const next = moveWithRiders(objects, desk, turned, null);
    const radians = (turn * Math.PI) / 180;
    for (const rider of riders) {
      const after = next.find(object => object.id === rider.id);
      const dx = rider.position.x - desk.position.x;
      const dy = rider.position.y - desk.position.y;
      assert.ok(Math.abs(after.position.x - (desk.position.x + dx * Math.cos(radians) - dy * Math.sin(radians))) < 1e-9, `${rider.id} x at ${turn}°`);
      assert.ok(Math.abs(after.position.y - (desk.position.y + dx * Math.sin(radians) + dy * Math.cos(radians))) < 1e-9, `${rider.id} y at ${turn}°`);
      assert.equal(after.rotation.z, (rider.rotation.z + turn) % 360, `${rider.id} turns with the desk`);
      assert.equal(supportId(after, next), desk.id, `${rider.id} still on the desk at ${turn}°`);
    }
    // Turned on its own, nothing on top overlaps anything or floats.
    const onTop = new Set([desk.id, ...riders.map(rider => rider.id)]);
    const problems = analyzeProjectLayout({ length: 20, width: 20, height: 3 }, next.filter(object => onTop.has(object.id)))
      .filter(issue => issue.severity !== 'info').map(issue => issue.title);
    assert.deepEqual(problems, [], `at ${turn}°`);
  }
});

test('a desk made taller or lifted raises what stands on it with its top', () => {
  const { objects, room: templateRoom } = gaming();
  const desk = deskOf(objects);
  const riders = findRiders(desk, objects);
  const taller = { ...desk, scale: { ...desk.scale, z: desk.scale.z + 0.1 }, position: { ...desk.position, z: desk.position.z + 0.05 } };
  const next = moveWithRiders(objects, desk, taller, templateRoom);
  for (const rider of riders) {
    const after = next.find(object => object.id === rider.id);
    assert.ok(Math.abs(after.position.z - rider.position.z - 0.1) < 1e-9, `${rider.id} rises 10 cm`);
    assert.equal(supportId(after, next), desk.id, `${rider.id} still on the desk`);
  }
});

test('a screen on a stand rides the stand, and the stand rides the desk', () => {
  const models = DEVICE_CATALOG.flatMap(category => category.models.map(model => ({ model, categoryId: category.category })));
  const add = (modelId, objects) => {
    const { model, categoryId } = models.find(entry => entry.model.modelId === modelId);
    return [...objects, placeCatalogObject({ modelTemplate: model, categoryId, room, id: modelId, objects }).object];
  };
  const objects = ['office-desk', 'monitor-stand', 'monitor-27'].reduce((current, modelId) => add(modelId, current), []);
  const [desk, stand, screen] = objects;
  assert.equal(supportId(stand, objects), desk.id);
  assert.equal(supportId(screen, objects), stand.id);
  assert.deepEqual(findRiders(desk, objects).map(object => object.id).sort(), ['monitor-27', 'monitor-stand']);
  const moved = moveWithRiders(objects, desk, { ...desk, position: { ...desk.position, x: desk.position.x - 0.5 } }, room);
  assert.equal(supportId(moved[2], moved), stand.id);
  assert.equal(supportId(moved[1], moved), desk.id);
  assert.ok(Math.abs(moved[2].position.x - screen.position.x + 0.5) < 1e-9);
});

test('a carried device stays inside the room', () => {
  const models = DEVICE_CATALOG.flatMap(category => category.models.map(model => ({ model, categoryId: category.category })));
  const make = (modelId, objects) => {
    const { model, categoryId } = models.find(entry => entry.model.modelId === modelId);
    return placeCatalogObject({ modelTemplate: model, categoryId, room, id: modelId, objects }).object;
  };
  const desk = make('office-desk', []);
  const laptop = make('laptop-15', [desk]);
  // The laptop pokes 10 cm past the desk's left end, still standing on it.
  const overhanging = { ...laptop, position: { ...laptop.position, x: desk.position.x - desk.scale.x / 2 - 0.1 + laptop.scale.x / 2 } };
  const objects = [desk, overhanging];
  assert.equal(supportId(overhanging, objects), desk.id);
  // Pushed against the left wall, the laptop would go 10 cm through it.
  const moved = { ...desk, position: { ...desk.position, x: -room.length / 2 + desk.scale.x / 2 } };
  const unbounded = moveWithRiders(objects, desk, moved, null)[1];
  assert.ok(unbounded.position.x - unbounded.scale.x / 2 < -room.length / 2 - 0.05, 'without the room it would poke through');
  const next = moveWithRiders(objects, desk, moved, room)[1];
  assert.ok(next.position.x - next.scale.x / 2 >= -room.length / 2 - 1e-9, 'kept inside the room');
  assert.equal(supportId(next, [moved, next]), desk.id, 'and still on the desk');
});

test('updateWithRiders replaces by id and leaves a missing object alone', () => {
  const { objects } = gaming();
  const desk = deskOf(objects);
  const moved = { ...desk, position: { ...desk.position, x: desk.position.x + 0.1 } };
  assert.deepEqual(updateWithRiders(objects, moved, room), moveWithRiders(objects, desk, moved, room));
  assert.equal(updateWithRiders(objects, { ...moved, id: 'missing' }, room), objects);
});

test('a floating stand that drops to the desk takes its screen down with it', () => {
  const models = DEVICE_CATALOG.flatMap(category => category.models.map(model => ({ model, categoryId: category.category })));
  const make = (modelId, objects) => {
    const { model, categoryId } = models.find(entry => entry.model.modelId === modelId);
    return placeCatalogObject({ modelTemplate: model, categoryId, room, id: modelId, objects }).object;
  };
  const desk = make('office-desk', []);
  const placedStand = make('monitor-stand', [desk]);
  const screenOnStand = make('monitor-27', [desk, placedStand]);
  // Both lifted 20 cm: the stand floats with the screen still on it.
  const lift = object => ({ ...object, position: { ...object.position, z: object.position.z + 0.2 } });
  const project = { room, objects: [desk, lift(placedStand), lift(screenOnStand)], connections: [] };
  const fixed = applyImprovement(project, {
    patch: { objectId: placedStand.id, position: { ...placedStand.position } },
  });
  const [, stand, screen] = fixed.objects;
  assert.equal(supportId(stand, fixed.objects), desk.id);
  assert.equal(supportId(screen, fixed.objects), stand.id);
  assert.deepEqual(problemsIn(project, fixed.objects), []);
});

test('taking away the desk drops what stood on it to the floor, and leaves the rest alone', () => {
  const project = gaming();
  const { objects } = project;
  const desk = deskOf(objects);
  const onDesk = findRiders(desk, objects).map(object => object.id);
  const { objects: next, dropped } = removeAndDropRiders(objects, desk.id, project.room);
  assert.equal(next.some(object => object.id === desk.id), false);
  assert.deepEqual([...dropped].sort(), [...onDesk].sort());
  for (const object of next) {
    const before = objects.find(item => item.id === object.id);
    assert.equal(object.position.x, before.position.x, `${object.id} keeps its place in plan`);
    assert.equal(object.position.y, before.position.y, `${object.id} keeps its place in plan`);
    if (!onDesk.includes(object.id)) assert.deepEqual(object, before, `${object.id} untouched`);
  }
  assert.deepEqual(problemsIn(project, next), [], 'nothing left floating');
});

test('taking away a stand drops its screen onto the desk; a missing id changes nothing', () => {
  const models = DEVICE_CATALOG.flatMap(category => category.models.map(model => ({ model, categoryId: category.category })));
  const make = (modelId, objects) => {
    const { model, categoryId } = models.find(entry => entry.model.modelId === modelId);
    return placeCatalogObject({ modelTemplate: model, categoryId, room, id: modelId, objects }).object;
  };
  const desk = make('office-desk', []);
  const stand = make('monitor-stand', [desk]);
  const screen = make('monitor-27', [desk, stand]);
  const { objects: next, dropped } = removeAndDropRiders([desk, stand, screen], stand.id, room);
  assert.deepEqual(dropped, ['monitor-27']);
  assert.equal(supportId(next[1], next), desk.id);
  assert.ok(Math.abs(next[1].position.z - (desk.scale.z + screen.scale.z / 2)) < 1e-9);
  assert.deepEqual(removeAndDropRiders([desk], 'missing', room), { objects: [desk], dropped: [] });
});
