import test from 'node:test';
import assert from 'node:assert/strict';

import { placeCatalogObject } from '../src/domain/placement.js';
import { DEVICE_CATALOG } from '../src/domain/catalog.js';
import { isPortDirectionConsistent } from '../src/domain/connections.js';
import { analyzeProjectLayout } from '../src/domain/layout-analysis.js';
import { analyzeLayoutHeuristics } from '../src/domain/layout-heuristics.js';

const isNonBlankString = (value) => typeof value === 'string' && value.trim().length > 0;
const VALID_PORT_DIRECTIONS = new Set(['input', 'output', 'bidirectional']);

const officeDesk = {
  type: 'office-desk',
  modelId: 'office-desk',
  displayName: '办公桌',
  shape: 'rect',
  assetUrl: null,
  defaultScale: { x: 1.4, y: 0.7, z: 0.75 },
  color: '#1e88e5',
};

test('rejects a catalog object that cannot fit inside the room', () => {
  const result = placeCatalogObject({
    modelTemplate: officeDesk,
    categoryId: 'furniture',
    room: { length: 0.1, width: 0.1, height: 0.1 },
    id: 'desk-1',
  });

  assert.equal(result.valid, false);
  assert.equal(result.object, null);
  assert.match(result.reason, /房间/);
});

test('creates a constrained catalog object with independent port data', () => {
  const template = {
    ...officeDesk,
    ports: [{ id: 'power-in', name: '电源', type: 'ac_input', direction: 'input' }],
  };
  const result = placeCatalogObject({
    modelTemplate: template,
    categoryId: 'furniture',
    room: { length: 5, width: 4, height: 3 },
    id: 'desk-2',
  });

  assert.equal(result.valid, true);
  assert.equal(result.object.id, 'desk-2');
  assert.deepEqual(result.object.position, { x: 0, y: 0, z: 0.375 });
  assert.equal(result.object.ports[0].anchor.y, 0.5);

  result.object.ports[0].name = '已修改';
  assert.equal(template.ports[0].name, '电源');
});

test('every catalog template places into a structurally valid object', () => {
  const room = { length: 100, width: 100, height: 100 };

  for (const category of DEVICE_CATALOG) {
    for (const model of category.models) {
      const result = placeCatalogObject({ modelTemplate: model, categoryId: category.category, room });
      assert.equal(result.valid, true, `${model.modelId} should place validly`);

      const object = result.object;
      assert.ok(isNonBlankString(object.id), `${model.modelId} id`);
      assert.ok(isNonBlankString(object.type), `${model.modelId} type`);
      assert.ok(isNonBlankString(object.name), `${model.modelId} name`);
      assert.ok(isNonBlankString(object.shape), `${model.modelId} shape`);
      for (const axis of ['x', 'y', 'z']) {
        assert.ok(Number.isFinite(object.position[axis]), `${model.modelId} position.${axis}`);
        assert.ok(Number.isFinite(object.scale[axis]) && object.scale[axis] > 0, `${model.modelId} scale.${axis}`);
        assert.ok(Number.isFinite(object.rotation[axis]), `${model.modelId} rotation.${axis}`);
      }

      const portIds = object.ports.map(port => port.id);
      assert.equal(new Set(portIds).size, portIds.length, `${model.modelId} duplicate port id`);
      for (const port of object.ports) {
        assert.ok(VALID_PORT_DIRECTIONS.has(port.direction), `${model.modelId}.${port.id} direction`);
        assert.ok(isPortDirectionConsistent(port), `${model.modelId}.${port.id} direction consistency`);
        for (const axis of ['x', 'y', 'z']) {
          assert.ok(
            port.anchor[axis] >= -0.5 && port.anchor[axis] <= 0.5,
            `${model.modelId}.${port.id} anchor.${axis} normalized`
          );
        }
      }
    }
  }
});

test('generates a unique id when callers create objects without supplying one', () => {
  const ids = Array.from({ length: 25 }, () => placeCatalogObject({
    modelTemplate: officeDesk,
    categoryId: 'furniture',
    room: { length: 5, width: 4, height: 3 },
  }).object.id);

  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every(id => id.startsWith('office-desk-')));
});

const homeRoom = { length: 4, width: 3.5, height: 2.7 };
const templateFor = modelId => {
  for (const category of DEVICE_CATALOG) {
    const model = category.models.find(candidate => candidate.modelId === modelId);
    if (model) return { model, categoryId: category.category };
  }
  throw new Error(`missing ${modelId}`);
};
const addInOrder = (modelIds, room = homeRoom) => modelIds.reduce((objects, modelId, index) => {
  const { model, categoryId } = templateFor(modelId);
  const result = placeCatalogObject({ modelTemplate: model, categoryId, room, id: `${modelId}-${index}`, objects });
  assert.equal(result.valid, true, `${modelId} should find a place`);
  const next = [...objects, result.object];
  const problems = analyzeProjectLayout(room, next)
    .filter(issue => issue.severity !== 'info')
    .map(issue => issue.title);
  assert.deepEqual(problems, [], `after adding ${modelId}`);
  return next;
}, []);

test('devices added to a desk scene land in free, supported spots', () => {
  const objects = addInOrder([
    'office-desk', 'monitor-27', 'monitor-24', 'laptop-15',
    'desktop-pc', 'router', 'power-strip', 'power-adapter', 'wall-outlet',
  ]);
  const byId = Object.fromEntries(objects.map(object => [object.modelId, object]));
  const deskTop = byId['office-desk'].position.z + byId['office-desk'].scale.z / 2;

  for (const modelId of ['monitor-27', 'monitor-24', 'laptop-15']) {
    const object = byId[modelId];
    assert.ok(Math.abs(object.position.z - object.scale.z / 2 - deskTop) < 1e-9, `${modelId} sits on the desk`);
  }
  for (const modelId of ['desktop-pc', 'router', 'power-strip', 'power-adapter']) {
    assert.ok(Math.abs(byId[modelId].position.z - byId[modelId].scale.z / 2) < 1e-9, `${modelId} sits on the floor`);
  }
});

test('the first device in an empty room still goes to the room center', () => {
  const [desk] = addInOrder(['office-desk']);
  assert.deepEqual(desk.position, { x: 0, y: 0, z: 0.375 });
});

test('desk-top devices fall back to the floor when there is no desk', () => {
  const [monitor] = addInOrder(['monitor-27']);
  assert.ok(Math.abs(monitor.position.z - monitor.scale.z / 2) < 1e-9);
});

test('a second desk does not overlap the first', () => {
  addInOrder(['office-desk', 'office-desk']);
});

test('many monitors fill the desk and then spill to the floor without overlapping', () => {
  addInOrder(['office-desk', 'monitor-27', 'monitor-27', 'monitor-27', 'monitor-27']);
});

const boundsOf = object => {
  const half = { x: object.scale.x / 2, y: object.scale.y / 2 };
  return { minX: object.position.x - half.x, maxX: object.position.x + half.x, minY: object.position.y - half.y, maxY: object.position.y + half.y };
};

test('a second monitor goes beside the first when it fits, otherwise in front, never hidden behind', () => {
  const sharesColumn = (first, second) => first.minX < second.maxX - 1e-9 && first.maxX > second.minX + 1e-9;

  const narrowDeskScreens = addInOrder(['office-desk', 'monitor-24', 'monitor-24'], { ...homeRoom, length: 5 })
    .filter(object => object.category === 'display');
  // A 1.4m desk cannot fit a 0.54m screen beside a centered one, so widen it.
  const wideDeskObjects = (() => {
    const { model, categoryId } = templateFor('office-desk');
    const wideDesk = { ...model, defaultScale: { ...model.defaultScale, x: 1.8 } };
    const desk = placeCatalogObject({ modelTemplate: wideDesk, categoryId, room: homeRoom, id: 'wide-desk' }).object;
    return ['monitor-24', 'monitor-24'].reduce((current, modelId, index) => {
      const entry = templateFor(modelId);
      return [...current, placeCatalogObject({ modelTemplate: entry.model, categoryId: entry.categoryId, room: homeRoom, id: `m${index}`, objects: current }).object];
    }, [desk]);
  })();
  const [wideFirst, wideSecond] = wideDeskObjects.slice(1).map(boundsOf);
  assert.equal(sharesColumn(wideFirst, wideSecond), false, 'side by side on a wide desk');

  const [first, second] = narrowDeskScreens.map(boundsOf);
  if (sharesColumn(first, second)) {
    assert.ok(narrowDeskScreens[1].position.y < narrowDeskScreens[0].position.y, 'a screen that cannot fit beside goes in front, not behind');
  }
});

test('floor devices stay out of the space in front of the desk', () => {
  // Desk against the back wall, like the templates build it.
  const { model, categoryId } = templateFor('office-desk');
  const desk = {
    ...placeCatalogObject({ modelTemplate: model, categoryId, room: homeRoom, id: 'desk' }).object,
    position: { x: 0, y: homeRoom.width / 2 - 0.15 - 0.35, z: 0.375 },
  };
  const objects = ['desktop-pc', 'router', 'power-strip', 'power-adapter'].reduce((current, modelId) => {
    const entry = templateFor(modelId);
    const result = placeCatalogObject({ modelTemplate: entry.model, categoryId: entry.categoryId, room: homeRoom, id: modelId, objects: current });
    return [...current, result.object];
  }, [desk]);

  const deskFront = boundsOf(desk).minY;
  for (const object of objects.slice(1)) {
    assert.ok(boundsOf(object).minY >= deskFront - 1e-9, `${object.modelId} should not sit in front of the desk`);
  }
  const strip = objects.find(object => object.modelId === 'power-strip');
  assert.ok(boundsOf(strip).minY >= boundsOf(desk).maxY - 1e-9, 'a small strip tucks in behind the desk');
});

test('keyboards, mice, lamps and speakers are added on the desk top', () => {
  const [desk, ...devices] = addInOrder(['office-desk', 'keyboard', 'mouse', 'desk-lamp', 'speakers']);
  const deskTop = desk.position.z + desk.scale.z / 2;
  for (const device of devices) {
    assert.ok(Math.abs(device.position.z - device.scale.z / 2 - deskTop) < 1e-9, `${device.modelId} sits on the desk`);
  }
  for (const device of devices.filter(item => ['keyboard', 'mouse'].includes(item.modelId))) {
    assert.ok(device.position.y < desk.position.y, `${device.modelId} is on the half nearer the seat`);
  }
});

test('devices with a front are added facing the seat, like the templates build them', () => {
  const objects = addInOrder([
    'office-desk', 'monitor-27', 'laptop-15', 'desktop-pc', 'game-console',
    'keyboard', 'mouse', 'speakers', 'desk-lamp', 'router', 'power-strip',
  ]);
  const rotation = Object.fromEntries(objects.map(object => [object.modelId, object.rotation.z]));
  for (const modelId of ['monitor-27', 'laptop-15', 'desktop-pc', 'game-console', 'keyboard', 'mouse', 'speakers', 'desk-lamp']) {
    assert.equal(rotation[modelId], 180, `${modelId} faces the seat`);
  }
  for (const modelId of ['office-desk', 'router', 'power-strip']) {
    assert.equal(rotation[modelId], 0, `${modelId} keeps its own orientation`);
  }
  const hints = analyzeLayoutHeuristics(homeRoom, objects, []).map(hint => hint.code);
  assert.equal(hints.includes('monitor_facing_away'), false);
});

test('on a turned desk, added devices face that desk\'s seat', () => {
  const { model, categoryId } = templateFor('office-desk');
  const desk = placeCatalogObject({ modelTemplate: model, categoryId, room: homeRoom, id: 'desk' }).object;
  const turnedDesk = { ...desk, rotation: { ...desk.rotation, z: 90 } };
  const entry = templateFor('monitor-27');
  const monitor = placeCatalogObject({ modelTemplate: entry.model, categoryId: entry.categoryId, room: homeRoom, id: 'monitor', objects: [turnedDesk] }).object;
  assert.equal(monitor.rotation.z, 270);
  const hints = analyzeLayoutHeuristics(homeRoom, [turnedDesk, monitor], []).map(hint => hint.code);
  assert.equal(hints.includes('monitor_facing_away'), false);
});


// In the desk's own frame. From the seat the right hand is the desk's -x:
// the 3D view mirrors project x (see placement.js).
function localTo(desk, object) {
  const radians = ((desk.rotation?.z ?? 0) * Math.PI) / 180;
  const dx = object.position.x - desk.position.x;
  const dy = object.position.y - desk.position.y;
  return { x: dx * Math.cos(radians) + dy * Math.sin(radians), y: -dx * Math.sin(radians) + dy * Math.cos(radians) };
}

function addTo(objects, modelId, room = homeRoom) {
  const { model, categoryId } = templateFor(modelId);
  const result = placeCatalogObject({ modelTemplate: model, categoryId, room, id: modelId, objects });
  assert.equal(result.valid, true, `${modelId} should find a place`);
  return [...objects, result.object];
}

for (const turn of [0, 90]) {
  test(`added peripherals go where the generator puts them, on a desk turned ${turn}°`, () => {
    const { model, categoryId } = templateFor('office-desk');
    const placedDesk = placeCatalogObject({ modelTemplate: model, categoryId, room: homeRoom, id: 'desk' }).object;
    const desk = { ...placedDesk, rotation: { ...placedDesk.rotation, z: turn } };
    let objects = addTo([desk], 'monitor-27');
    for (const modelId of ['keyboard', 'mouse', 'desk-lamp', 'speakers', 'game-console']) objects = addTo(objects, modelId);
    const at = modelId => localTo(desk, objects.find(object => object.modelId === modelId));
    const halfX = desk.scale.x / 2;
    const halfY = desk.scale.y / 2;

    assert.ok(Math.abs(at('keyboard').x) < 1e-6, 'keyboard in front of the seat');
    assert.ok(at('keyboard').y < -halfY + 0.2, 'keyboard near the front edge');
    assert.ok(at('mouse').x < at('keyboard').x && Math.abs(at('mouse').y - at('keyboard').y) < 1e-6, 'mouse to the keyboard\'s right');
    assert.ok(at('desk-lamp').x > halfX / 2 && at('desk-lamp').y > halfY / 2, 'lamp in the back corner on the left');
    assert.ok(at('speakers').x < -halfX / 2 && at('speakers').y > halfY / 2, 'speakers in the back corner on the right');
    const console_ = objects.find(object => object.modelId === 'game-console');
    assert.ok(at('game-console').x < -halfX, 'console beside the desk on the right');
    assert.ok(Math.abs(console_.position.z - console_.scale.z / 2) < 1e-9, 'console on the floor');
    for (const object of objects.slice(1)) assert.equal(object.rotation.z, (turn + 180) % 360, `${object.modelId} faces the seat`);
    const problems = analyzeProjectLayout(homeRoom, objects).filter(issue => issue.severity !== 'info').map(issue => issue.title);
    assert.deepEqual(problems, []);
  });
}

test('when the usual spot is taken an added device still finds a free place on the desk', () => {
  const objects = addInOrder(['office-desk', 'keyboard', 'keyboard', 'desk-lamp', 'desk-lamp']);
  const desk = objects[0];
  const deskTop = desk.position.z + desk.scale.z / 2;
  for (const device of objects.slice(1)) {
    assert.ok(Math.abs(device.position.z - device.scale.z / 2 - deskTop) < 1e-9, `${device.id} sits on the desk`);
  }
});
