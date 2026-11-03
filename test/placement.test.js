import test from 'node:test';
import assert from 'node:assert/strict';

import { hidesAnotherScreen, lineUpScreens, placeCatalogObject, placeCopy } from '../src/domain/placement.js';
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

// The search on the desk, beside it and along the wall runs in the desk's
// own frame: a turned desk gets the same layout as an unturned one.
test('on a turned desk, screens, laptops, the PC and the outlet go where they would on an unturned one', () => {
  const ids = ['monitor-27', 'laptop-15', 'desktop-pc', 'router', 'power-strip', 'wall-outlet'];
  const layouts = [0, 90, 180, 270, 45].map(turn => {
    const { model, categoryId } = templateFor('office-desk');
    const placedDesk = placeCatalogObject({ modelTemplate: model, categoryId, room: homeRoom, id: 'desk' }).object;
    const desk = { ...placedDesk, rotation: { ...placedDesk.rotation, z: turn } };
    const objects = ids.reduce((current, modelId) => addTo(current, modelId), [desk]);
    const at = modelId => localTo(desk, objects.find(object => object.modelId === modelId));
    const halfY = desk.scale.y / 2;

    assert.ok(Math.abs(at('monitor-27').x) < 1e-6 && at('monitor-27').y > halfY / 2, `${turn}°: screen centred at the back`);
    assert.ok(at('laptop-15').y < 0, `${turn}°: laptop on the seat half`);
    assert.ok(at('desktop-pc').y > halfY, `${turn}°: PC behind the desk`);
    assert.ok(at('wall-outlet').y > halfY, `${turn}°: outlet on the wall behind the desk`);
    for (const modelId of ['desktop-pc', 'router', 'power-strip']) {
      assert.ok(at(modelId).y >= -halfY, `${turn}°: ${modelId} not in front of the desk`);
    }
    const problems = analyzeProjectLayout(homeRoom, objects).filter(issue => issue.severity !== 'info').map(issue => issue.title);
    assert.deepEqual(problems, [], `${turn}°: layout`);
    assert.deepEqual(analyzeLayoutHeuristics(homeRoom, objects, []).map(hint => hint.code), [], `${turn}°: hints`);
    return ['monitor-27', 'laptop-15', 'desktop-pc'].map(modelId => at(modelId));
  });
  for (const layout of layouts.slice(1)) {
    layout.forEach((spot, index) => {
      assert.ok(Math.abs(spot.x - layouts[0][index].x) < 1e-6 && Math.abs(spot.y - layouts[0][index].y) < 1e-6, `${ids[index]} as on the unturned desk`);
    });
  }
});

test('on a desk turned around, screens stay on the desk', () => {
  const { model, categoryId } = templateFor('office-desk');
  const placedDesk = placeCatalogObject({ modelTemplate: model, categoryId, room: homeRoom, id: 'desk' }).object;
  const desk = { ...placedDesk, rotation: { ...placedDesk.rotation, z: 180 } };
  // A centred screen plus a real stand depth fills the desk before a fourth
  // monitor can sit beside it. Three still fit, one behind the other.
  const objects = ['monitor-24', 'monitor-24', 'monitor-27'].reduce((current, modelId, index) => {
    const entry = templateFor(modelId);
    return [...current, placeCatalogObject({ modelTemplate: entry.model, categoryId: entry.categoryId, room: homeRoom, id: `screen-${index}`, objects: current }).object];
  }, [desk]);
  const deskTop = desk.position.z + desk.scale.z / 2;
  for (const screen of objects.slice(1)) {
    assert.ok(Math.abs(screen.position.z - screen.scale.z / 2 - deskTop) < 1e-9, `${screen.id} sits on the desk`);
  }
});

test('when the usual spot is taken an added device still finds a free place on the desk', () => {
  const objects = addInOrder(['office-desk', 'keyboard', 'keyboard', 'desk-lamp', 'desk-lamp']);
  const desk = objects[0];
  const deskTop = desk.position.z + desk.scale.z / 2;
  for (const device of objects.slice(1)) {
    assert.ok(Math.abs(device.position.z - device.scale.z / 2 - deskTop) < 1e-9, `${device.id} sits on the desk`);
  }
});

test('a copy of any template device goes beside it, on the same surface, without overlaps', async () => {
  const { buildTemplateScene } = await import('../src/domain/desk-templates.js');
  const { hydrateProjectObjects } = await import('../src/domain/catalog.js');
  const { findSupportingObject } = await import('../src/domain/layout-analysis.js');
  for (const templateId of ['home-office', 'desktop-dual', 'gaming']) {
    const scene = buildTemplateScene(templateId);
    const objects = hydrateProjectObjects(scene.objects);
    for (const original of objects) {
      const copy = { ...structuredClone(original), id: `${original.id}-copy`, name: `${original.name} 副本` };
      const placed = placeCopy(original, copy, scene.room, objects);
      const label = `${templateId}: ${original.name}`;
      assert.ok(placed, `${label} has a place`);
      const problems = analyzeProjectLayout(scene.room, [...objects, placed]).filter(issue => issue.severity !== 'info').map(issue => issue.title);
      assert.deepEqual(problems, [], label);
      assert.deepEqual(findSupportingObject(placed, objects), findSupportingObject(original, objects), `${label} rests on the same thing`);
      assert.deepEqual(placed.scale, original.scale, `${label} keeps its size`);
      assert.deepEqual(placed.rotation, original.rotation, `${label} keeps its turn`);
    }
  }
});

test('a copy of a screen sits right beside it when the desk has room, else where a second one from the library would', () => {
  const [placedDesk, firstMonitor] = addInOrder(['office-desk', 'monitor-27']);
  const desk = { ...placedDesk, scale: { ...placedDesk.scale, x: 2 } };
  const objects = [desk, firstMonitor];
  const monitor = firstMonitor;
  const placed = placeCopy(monitor, { ...structuredClone(monitor), id: 'copy' }, homeRoom, objects);
  assert.ok(Math.abs(Math.abs(placed.position.x - monitor.position.x) - (monitor.scale.x + 0.05)) < 1e-6, 'one screen width and a gap along');
  assert.equal(placed.position.y, monitor.position.y);
  assert.equal(placed.position.z, monitor.position.z);
  assert.ok(Math.abs(placed.position.x - desk.position.x) + placed.scale.x / 2 <= desk.scale.x / 2 + 1e-6, 'still on the desk');

  // On the 1.4 m desk there is no room beside it: the copy goes where the
  // library would put a second 27-inch screen.
  const narrow = addInOrder(['office-desk', 'monitor-27']);
  const second = placeCopy(narrow[1], { ...structuredClone(narrow[1]), id: 'copy' }, homeRoom, narrow);
  const { model, categoryId } = templateFor('monitor-27');
  const fromLibrary = placeCatalogObject({ modelTemplate: model, categoryId, room: homeRoom, id: 'library', objects: narrow }).object;
  assert.deepEqual(second.position, fromLibrary.position);
});

// Side by side means along the desk's edge, and "on the desk" means on the
// desk itself, not its world box, however the desk is turned.
test('on a turned desk a copy goes beside the original along the desk, wholly on it', () => {
  const { model, categoryId } = templateFor('office-desk');
  const placedDesk = placeCatalogObject({ modelTemplate: model, categoryId, room: homeRoom, id: 'desk' }).object;
  const copyOn = (turn, modelId) => {
    const desk = { ...placedDesk, scale: { ...placedDesk.scale, x: 2 }, rotation: { ...placedDesk.rotation, z: turn } };
    const objects = addTo([desk], modelId);
    const original = objects[1];
    const copy = placeCopy(original, { ...structuredClone(original), id: 'copy' }, homeRoom, objects);
    return { desk, original: localTo(desk, original), copy: localTo(desk, copy), placed: copy, all: [...objects, copy] };
  };
  for (const modelId of ['monitor-27', 'laptop-15', 'desk-lamp', 'speakers']) {
    const flat = copyOn(0, modelId);
    for (const turn of [45, 90, 180]) {
      const { desk, original, copy, placed, all } = copyOn(turn, modelId);
      assert.ok(Math.abs(copy.y - original.y) < 1e-6 && Math.abs(copy.x - original.x) > 0.1, `${modelId} at ${turn}°: beside it along the desk`);
      assert.ok(Math.abs(copy.x - flat.copy.x) < 1e-6 && Math.abs(copy.y - flat.copy.y) < 1e-6, `${modelId} at ${turn}°: as on an unturned desk`);
      const half = { x: placed.scale.x / 2, y: placed.scale.y / 2 }; // turned with the desk, so its own axes
      assert.ok(Math.abs(copy.x) + half.x <= desk.scale.x / 2 + 1e-6 && Math.abs(copy.y) + half.y <= desk.scale.y / 2 + 1e-6, `${modelId} at ${turn}°: wholly on the desk`);
      const problems = analyzeProjectLayout(homeRoom, all).filter(issue => issue.severity !== 'info').map(issue => issue.title);
      assert.deepEqual(problems, [], `${modelId} at ${turn}°`);
    }
  }
});

function deskWithScreen(length, turn = 0) {
  const { model, categoryId } = templateFor('office-desk');
  const placed = placeCatalogObject({ modelTemplate: model, categoryId, room: homeRoom, id: 'desk' }).object;
  const desk = { ...placed, scale: { ...placed.scale, x: length }, rotation: { ...placed.rotation, z: turn } };
  return addTo([desk], 'monitor-27');
}

test('a second screen that would hide the first is lined up beside it when both fit', () => {
  for (const turn of [0, 90]) {
    const objects = deskWithScreen(1.6, turn);
    const [desk, first] = objects;
    // A second screen 10 cm in front of the first, toward the seat (the
    // library puts it there on an unturned desk; see the narrow-desk test).
    const radians = (turn * Math.PI) / 180;
    const second = {
      ...structuredClone(first), id: 'second',
      position: { ...first.position, x: first.position.x + 0.1 * Math.sin(radians), y: first.position.y - 0.1 * Math.cos(radians) },
    };
    assert.equal(hidesAnotherScreen(second, objects), true, `${turn}°: it hides the first`);

    const row = lineUpScreens(second, homeRoom, objects);
    assert.ok(row, `${turn}°: the two fit side by side`);
    const movedFirst = { ...first, position: row.moved.find(entry => entry.id === first.id).position };
    const next = [desk, movedFirst, row.screen];
    assert.equal(hidesAnotherScreen(row.screen, [desk, movedFirst]), false, `${turn}°: neither hides the other`);
    const at = object => localTo(desk, object);
    assert.ok(Math.abs(at(movedFirst).x + at(row.screen).x) < 1e-6, `${turn}°: the row is centred`);
    assert.ok(at(row.screen).x < at(movedFirst).x, `${turn}°: the new one on the seat's right`);
    assert.ok(Math.abs(at(row.screen).y - at(first).y) < 1e-6, `${turn}°: same distance from the back`);
    const problems = analyzeProjectLayout(homeRoom, next).filter(issue => issue.severity !== 'info').map(issue => issue.title);
    assert.deepEqual(problems, []);
  }
});

test('screens are not lined up when they do not fit side by side', () => {
  const objects = deskWithScreen(1.2);
  const { model, categoryId } = templateFor('monitor-27');
  const second = placeCatalogObject({ modelTemplate: model, categoryId, room: homeRoom, id: 'second', objects }).object;
  assert.equal(hidesAnotherScreen(second, objects), true, 'on an unturned desk the library puts it in front of the first');
  assert.equal(lineUpScreens(second, homeRoom, objects), null, 'two 27-inch screens need 1.28 m');
});

test('only cables to moved devices that became short are lengthened', async () => {
  const { lengthenCablesFor, evaluateConnectionLength } = await import('../src/domain/connections.js');
  const objects = [
    { id: 'a', type: 'device', name: 'a', shape: 'box', position: { x: 0, y: 0, z: 0.5 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 0.2, y: 0.2, z: 1 }, ports: [{ id: 'o', name: 'o', type: 'hdmi', direction: 'output' }] },
    { id: 'b', type: 'device', name: 'b', shape: 'box', position: { x: 2, y: 0, z: 0.5 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 0.2, y: 0.2, z: 1 }, ports: [{ id: 'i', name: 'i', type: 'hdmi', direction: 'input' }] },
  ];
  const short = { id: 'c', fromObjectId: 'a', fromPortId: 'o', toObjectId: 'b', toPortId: 'i', cableType: 'hdmi', length: 1, name: 'HDMI' };
  const [lengthened] = lengthenCablesFor([short], objects, new Set(['b']));
  assert.equal(evaluateConnectionLength(lengthened, objects).hasRecommendedSlack, true);
  assert.equal(lengthened.length, 3, 'the next common length');
  assert.deepEqual(lengthenCablesFor([short], objects, new Set(['x'])), [short], 'untouched devices keep their cables');
});
