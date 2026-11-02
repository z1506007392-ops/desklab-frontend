import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeProjectLayout, findSupportingObject, pushOntoSupport } from '../src/domain/layout-analysis.js';
import { applyImprovement, buildFreeImprovements } from '../src/domain/recommendations.js';
import { DEVICE_CATALOG } from '../src/domain/catalog.js';
import { placeCatalogObject } from '../src/domain/placement.js';

const room = { length: 4, width: 3.5, height: 2.7 };
const models = DEVICE_CATALOG.flatMap(category => category.models.map(model => ({ model, categoryId: category.category })));
const make = (modelId, objects, id = modelId) => {
  const { model, categoryId } = models.find(entry => entry.model.modelId === modelId);
  return placeCatalogObject({ modelTemplate: model, categoryId, room, id, objects }).object;
};
const at = (object, x, y = object.position.y) => ({ ...object, position: { ...object.position, x, y } });
const codes = objects => analyzeProjectLayout(room, objects).filter(issue => issue.severity !== 'info').map(issue => issue.code);
const deskWithScreen = (turn = 0) => {
  const placed = make('office-desk', [], 'desk');
  const desk = { ...placed, rotation: { ...placed.rotation, z: turn } };
  return [desk, make('monitor-27', [desk], 'screen')];
};

test('a screen with its centre past the desk edge is reported; one still mostly on the desk is not', () => {
  const [desk, screen] = deskWithScreen();
  const edge = desk.position.x + desk.scale.x / 2;
  // A third over the edge: stable.
  assert.deepEqual(codes([desk, at(screen, edge - screen.scale.x / 6)]), []);
  // Centre 5 cm past the edge: it tips over.
  const hanging = at(screen, edge + 0.05);
  const issues = analyzeProjectLayout(room, [desk, hanging]).filter(issue => issue.code === 'overhanging_object');
  assert.equal(issues.length, 1);
  assert.deepEqual(issues[0].objectIds, ['screen']);
  assert.match(issues[0].title, /27 英寸显示器 大半悬在书桌外面，会掉下去/);
  assert.equal(issues[0].severity, 'warning');
  // Wholly off the desk it floats instead, as before.
  assert.deepEqual(codes([desk, at(screen, edge + screen.scale.x)]), ['floating_object']);
});

test('on a turned desk the edge is the desk\'s own, not its world box', () => {
  const [desk, screen] = deskWithScreen(45);
  // Along the desk's own x axis, 5 cm past its end: inside the world box of
  // the turned desk, but off the desk itself.
  const along = desk.scale.x / 2 + 0.05;
  const radians = Math.PI / 4;
  const hanging = at(screen, desk.position.x + along * Math.cos(radians), desk.position.y + along * Math.sin(radians));
  assert.ok(findSupportingObject(hanging, [desk, hanging])?.id === 'desk', 'still touches the desk');
  assert.ok(codes([desk, hanging]).includes('overhanging_object'));
});

test('a laptop across two desks pushed together stands on them', () => {
  const placed = make('office-desk', [], 'left');
  const left = at(placed, -placed.scale.x / 2);
  const right = at({ ...placed, id: 'right' }, placed.scale.x / 2);
  const laptop = make('laptop-15', [left], 'laptop');
  const seam = left.position.x + left.scale.x / 2;
  assert.deepEqual(codes([left, right, at(laptop, seam + 0.01)]), []);
  assert.deepEqual(codes([left, right, at(laptop, seam)]), []);
});

test('pushing back moves the least: the screen ends wholly on the desk at its edge', () => {
  const [desk, screen] = deskWithScreen();
  const edge = desk.position.x + desk.scale.x / 2;
  const hanging = at(screen, edge + 0.05);
  const pushed = pushOntoSupport(room, hanging, [desk, hanging]);
  assert.ok(Math.abs(pushed.position.x + screen.scale.x / 2 - edge) < 1e-9, 'its edge on the desk edge');
  assert.equal(pushed.position.y, hanging.position.y);
  assert.equal(pushed.position.z, hanging.position.z);
  assert.deepEqual(codes([desk, pushed]), []);
});

test('a wide screen hanging off a small stand is pushed back to the stand\'s middle', () => {
  const desk = make('office-desk', [], 'desk');
  const stand = make('monitor-stand', [desk], 'stand');
  const screen = make('monitor-27', [desk, stand], 'screen');
  assert.equal(findSupportingObject(screen, [desk, stand, screen])?.id, 'stand');
  assert.deepEqual(codes([desk, stand, screen]), []);
  const hanging = at(screen, stand.position.x + stand.scale.x / 2 + 0.03);
  assert.ok(codes([desk, stand, hanging]).includes('overhanging_object'));
  const pushed = pushOntoSupport(room, hanging, [desk, stand, hanging]);
  assert.ok(Math.abs(pushed.position.x - stand.position.x) < 1e-9);
  assert.deepEqual(codes([desk, stand, pushed]), []);
});

test('no push back when the spot is taken', () => {
  const [desk, screen] = deskWithScreen();
  const edge = desk.position.x + desk.scale.x / 2;
  const hanging = at(screen, edge + 0.05);
  const lamp = { ...make('desk-lamp', [desk], 'lamp') };
  const inTheWay = at(lamp, edge - 0.1, hanging.position.y);
  assert.equal(pushOntoSupport(room, hanging, [desk, hanging, inTheWay]), null);
  assert.equal(buildFreeImprovements(room, [desk, hanging, inTheWay]).some(item => item.code === 'push_onto_support'), false);
});

test('the free fix pushes it back, and what stands on it comes along', () => {
  const desk = make('office-desk', [], 'desk');
  const stand = make('monitor-stand', [desk], 'stand');
  const screen = make('monitor-27', [desk, stand], 'screen');
  const edge = desk.position.x + desk.scale.x / 2;
  const shift = edge + 0.03 - stand.position.x;
  const objects = [desk, at(stand, stand.position.x + shift), at(screen, screen.position.x + shift)];
  assert.ok(codes(objects).includes('overhanging_object'));
  const fix = buildFreeImprovements(room, objects).find(item => item.code === 'push_onto_support');
  assert.ok(fix, 'offered as a free fix');
  assert.deepEqual(fix.objectIds, ['stand']);
  const fixed = applyImprovement({ room, objects, connections: [] }, fix).objects;
  assert.deepEqual(codes(fixed), []);
  assert.equal(findSupportingObject(fixed[2], fixed)?.id, 'stand', 'the screen is still on the stand');
});
