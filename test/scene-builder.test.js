import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDeskScene,
  DESK_SCENE_DEVICE_LIMITS,
  DESK_SIZE_LIMITS,
  STANDARD_CABLE_LENGTHS,
} from '../src/domain/scene-builder.js';
import { DESK_TEMPLATES, buildTemplateScene } from '../src/domain/desk-templates.js';
import { analyzeProjectLayout } from '../src/domain/layout-analysis.js';
import { analyzeProjectWiring } from '../src/domain/analysis.js';
import { buildRecommendations } from '../src/domain/recommendations.js';
import { isProjectEnvelope } from '../src/domain/project-validation.js';
import { buildCableShoppingList } from '../src/domain/cable-shopping-list.js';
import { evaluateConnectionLength } from '../src/domain/connections.js';

const actionable = issues => issues.filter(issue => issue.severity === 'error' || issue.severity === 'warning');

function assertReadyToUse(scene, label) {
  assert.deepEqual(actionable(analyzeProjectLayout(scene.room, scene.objects)).map(issue => issue.title), [],
    `${label}: layout should be clean`);
  assert.deepEqual(actionable(analyzeProjectWiring(scene.objects, scene.connections)).map(issue => issue.title), [],
    `${label}: wiring should be clean`);
  const recommendations = buildRecommendations(scene);
  assert.deepEqual([...recommendations.freeImprovements, ...recommendations.purchases].map(item => item.title), [],
    `${label}: nothing left to suggest`);
  assert.equal(isProjectEnvelope({ id: 'default', updatedAt: '2026-10-28T00:00:00.000Z', ...scene }, { requireStoredFields: true }), true,
    `${label}: must be a valid project`);
}

const byModel = (scene, modelId) => scene.objects.filter(object => object.modelId === modelId);
const connectionsTo = (scene, objectId) => scene.connections.filter(connection => connection.toObjectId === objectId);

test('every built-in desk template is placed, wired, and clean out of the box', () => {
  assert.ok(DESK_TEMPLATES.length >= 2);
  for (const template of DESK_TEMPLATES) {
    const scene = buildTemplateScene(template.id);
    assertReadyToUse(scene, template.name);
    assert.deepEqual(scene.notes, [], `${template.name}: no placement notes expected`);
  }
});

test('templates have unique ids and describe their devices', () => {
  const ids = DESK_TEMPLATES.map(template => template.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const template of DESK_TEMPLATES) {
    assert.ok(template.name && template.description, `${template.id} needs a name and description`);
    assert.ok(template.devices.length > 0);
  }
  assert.equal(buildTemplateScene('missing-template'), null);
});

test('a desktop with two monitors and a router gets every cable it needs', () => {
  const scene = buildDeskScene({
    devices: [
      { modelId: 'desktop-pc', count: 1 },
      { modelId: 'monitor-27', count: 2 },
      { modelId: 'router', count: 1 },
    ],
  });
  assertReadyToUse(scene, 'desktop dual');

  const [pc] = byModel(scene, 'desktop-pc');
  const monitors = byModel(scene, 'monitor-27');
  const [router] = byModel(scene, 'router');
  const [strip] = byModel(scene, 'power-strip');
  const [outlet] = byModel(scene, 'wall-outlet');
  assert.ok(pc && router && strip && outlet);
  assert.equal(monitors.length, 2);
  assert.deepEqual(monitors.map(monitor => monitor.name), ['27 英寸显示器 1', '27 英寸显示器 2']);

  const displayLinks = scene.connections.filter(connection => ['hdmi', 'displayport'].includes(connection.cableType));
  assert.equal(displayLinks.length, 2);
  assert.deepEqual(new Set(displayLinks.map(connection => connection.toObjectId)), new Set(monitors.map(monitor => monitor.id)),
    'each monitor is fed by a different PC output');

  assert.ok(scene.connections.some(connection => connection.cableType === 'ethernet'
    && connection.fromObjectId === router.id && connection.toObjectId === pc.id));
  assert.ok(connectionsTo(scene, strip.id).some(connection => connection.fromObjectId === outlet.id));
  assert.equal(byModel(scene, 'power-adapter').length, 1, 'the router gets its own adapter');
});

test('a laptop gets its own adapter and shares a single monitor through HDMI', () => {
  const scene = buildDeskScene({
    devices: [{ modelId: 'laptop-15', count: 1 }, { modelId: 'monitor-24', count: 1 }],
  });
  assertReadyToUse(scene, 'laptop single');

  const [laptop] = byModel(scene, 'laptop-15');
  const [adapter] = byModel(scene, 'power-adapter');
  assert.ok(connectionsTo(scene, laptop.id).some(connection => connection.fromObjectId === adapter.id));
  assert.ok(scene.connections.some(connection => connection.fromObjectId === laptop.id && connection.cableType === 'hdmi'));
});

test('monitors face the user and sit on the desk', () => {
  const scene = buildDeskScene({ devices: [{ modelId: 'monitor-27', count: 1 }, { modelId: 'laptop-15', count: 1 }] });
  const [desk] = byModel(scene, 'office-desk');
  const [monitor] = byModel(scene, 'monitor-27');
  assert.equal(monitor.rotation.z, 180, 'screens face the default camera side');
  assert.ok(Math.abs(monitor.position.z - monitor.scale.z / 2 - desk.scale.z) < 1e-9, 'monitor rests on the desk top');
});

test('the scene comes with a camera framed on the desk from the user side', () => {
  const scene = buildDeskScene({ devices: [{ modelId: 'laptop-15', count: 1 }] });
  const [desk] = byModel(scene, 'office-desk');
  // Camera coordinates use the Three.js axes: y is height, z is the room's y axis.
  assert.deepEqual(scene.camera.target, { x: 0, y: desk.scale.z, z: desk.position.y });
  assert.ok(scene.camera.position.z < desk.position.y, 'the camera looks at the desk from the front');
  assert.ok(scene.camera.position.y > desk.scale.z, 'and from above the desk top');
  assert.ok(Math.abs(scene.camera.position.z) <= scene.room.width / 2 + 1.5, 'close enough to see the devices');
});

test('cable lengths come from standard store lengths', () => {
  const scene = buildTemplateScene(DESK_TEMPLATES[0].id);
  for (const connection of scene.connections) {
    assert.ok(STANDARD_CABLE_LENGTHS.includes(connection.length), `${connection.name}: ${connection.length}m`);
  }
});

test('a desk that cannot fit every monitor keeps what fits and explains why', () => {
  const scene = buildDeskScene({
    desk: { length: 1.2 },
    devices: [{ modelId: 'desktop-pc', count: 1 }, { modelId: 'monitor-27', count: 3 }],
  });
  assertReadyToUse(scene, 'narrow desk');
  assert.equal(byModel(scene, 'monitor-27').length, 1);
  assert.equal(scene.notes.length, 1);
  assert.match(scene.notes[0], /桌面宽度/);
});

test('a monitor with no free video output to feed it is called out', () => {
  const scene = buildDeskScene({
    desk: { length: 2.4 },
    devices: [{ modelId: 'desktop-pc', count: 1 }, { modelId: 'monitor-24', count: 3 }],
  });
  assertReadyToUse(scene, 'three monitors');
  const fed = new Set(scene.connections
    .filter(connection => ['hdmi', 'displayport'].includes(connection.cableType))
    .map(connection => connection.toObjectId));
  assert.equal(fed.size, 2, 'the PC has two video outputs');
  assert.deepEqual(scene.notes, ['“24 英寸显示器 3”暂时没有可用的视频输出，可能需要显卡上更多的接口。']);
});

test('unknown or unsupported devices are skipped with a note, and counts are capped', () => {
  const scene = buildDeskScene({
    devices: [
      { modelId: 'ups', count: 1 },
      { modelId: 'desktop-pc', count: 3 },
      { modelId: 'monitor-24', count: 0 },
    ],
  });
  assertReadyToUse(scene, 'sanitized');
  assert.equal(byModel(scene, 'desktop-pc').length, 1);
  assert.equal(byModel(scene, 'monitor-24').length, 0);
  assert.equal(scene.notes.some(note => note.includes('ups')), true);
  assert.equal(scene.notes.some(note => note.includes('台式主机') && note.includes('1')), true);
});

test('an empty device list still yields a clean desk with power ready', () => {
  const scene = buildDeskScene({ devices: [] });
  assertReadyToUse(scene, 'empty');
  assert.equal(byModel(scene, 'office-desk').length, 1);
});

test('desk sizes outside a sensible home range are clamped with a note', () => {
  const tiny = buildDeskScene({ desk: { length: 0.2, depth: 0.1 }, devices: [] });
  const [tinyDesk] = byModel(tiny, 'office-desk');
  assert.deepEqual([tinyDesk.scale.x, tinyDesk.scale.y], [DESK_SIZE_LIMITS.length.min, DESK_SIZE_LIMITS.depth.min]);
  assert.equal(tiny.notes.filter(note => note.includes('书桌')).length, 2);

  const huge = buildDeskScene({ desk: { length: 9, depth: 3 }, devices: [] });
  const [hugeDesk] = byModel(huge, 'office-desk');
  assert.deepEqual([hugeDesk.scale.x, hugeDesk.scale.y], [DESK_SIZE_LIMITS.length.max, DESK_SIZE_LIMITS.depth.max]);
  assertReadyToUse(huge, 'clamped huge desk');
});

test('the device options exposed for forms match what the builder accepts', () => {
  for (const [modelId, limit] of Object.entries(DESK_SCENE_DEVICE_LIMITS)) {
    const scene = buildDeskScene({ desk: { length: DESK_SIZE_LIMITS.length.max }, devices: [{ modelId, count: limit }] });
    assert.equal(byModel(scene, modelId).length, limit, `${modelId} up to ${limit}`);
    assert.deepEqual(scene.notes, [], `${modelId}: the limit itself needs no note`);
  }
});

test('the room grows to fit a long desk with side devices', () => {
  const scene = buildDeskScene({
    desk: { length: 3 },
    devices: [{ modelId: 'desktop-pc', count: 1 }, { modelId: 'router', count: 1 }],
  });
  assertReadyToUse(scene, 'long desk');
  assert.ok(scene.room.length >= 3 + 1);
});

const withPeripherals = (devices, desk) => buildDeskScene({
  devices: [...devices, { modelId: 'keyboard', count: 1 }, { modelId: 'mouse', count: 1 }],
  desk,
});
// From the seat the right hand is -x: the 3D view maps project y to three.js
// z, a mirror image (see planFrontRow in scene-builder.js).
const seatRightOf = (a, b) => a.x < b.x;
const relativeToDesk = (scene, object) => {
  const desk = byModel(scene, 'office-desk')[0];
  return { x: object.position.x - desk.position.x, y: object.position.y - desk.position.y, z: object.position.z - object.scale.z / 2 - desk.scale.z };
};

test('a keyboard sits in front of the seat with the mouse to its right, a laptop beside screens to its left', () => {
  const scene = withPeripherals([{ modelId: 'monitor-27', count: 1 }, { modelId: 'laptop-15', count: 1 }], { length: 1.4, depth: 0.7 });
  const [keyboard] = byModel(scene, 'keyboard');
  const [mouse] = byModel(scene, 'mouse');
  const [laptop] = byModel(scene, 'laptop-15');
  const at = object => relativeToDesk(scene, object);
  assert.ok(Math.abs(at(keyboard).x) < 1e-9, 'the keyboard is in front of the seat');
  assert.ok(at(keyboard).y < -0.2 && at(mouse).y < -0.2, 'both near the front edge');
  assert.ok(Math.abs(at(keyboard).z) < 1e-9 && Math.abs(at(mouse).z) < 1e-9, 'both on the desktop');
  assert.ok(seatRightOf(at(mouse), at(keyboard)) && seatRightOf(at(keyboard), at(laptop)));
  assert.equal(keyboard.rotation.z, 180);
  assert.equal(mouse.rotation.z, 180);
  assertReadyToUse(scene, 'laptop, screen, keyboard and mouse');
  assert.deepEqual(scene.notes, []);
});

test('with no screens the laptop moves behind the keyboard when the desk is deep enough', () => {
  const scene = withPeripherals([{ modelId: 'laptop-15', count: 1 }], { length: 1.2, depth: 0.7 });
  const at = modelId => relativeToDesk(scene, byModel(scene, modelId)[0]);
  assert.ok(Math.abs(at('laptop-15').x) < 1e-9);
  assert.ok(at('laptop-15').y > at('keyboard').y + 0.2, 'the laptop is the screen, behind the keyboard');
  assertReadyToUse(scene, 'laptop with keyboard and mouse');
});

test('every device combination on an ordinary desk takes a keyboard and mouse cleanly', () => {
  const ids = Object.keys(DESK_SCENE_DEVICE_LIMITS).filter(modelId => !['keyboard', 'mouse'].includes(modelId));
  const combos = [[]];
  for (const modelId of ids) {
    const next = [];
    for (const combo of combos) {
      for (let count = 0; count <= DESK_SCENE_DEVICE_LIMITS[modelId]; count += 1) next.push(count ? [...combo, { modelId, count }] : combo);
    }
    combos.splice(0, combos.length, ...next);
  }
  for (const devices of combos) {
    const scene = withPeripherals(devices, { length: 1.4, depth: 0.7 });
    const label = devices.map(({ modelId, count }) => `${modelId}×${count}`).join(' ') || 'nothing else';
    const keyboard = byModel(scene, 'keyboard')[0];
    const mouse = byModel(scene, 'mouse')[0];
    assert.ok(keyboard && mouse, `${label}: both placed`);
    assert.ok(seatRightOf(relativeToDesk(scene, mouse), relativeToDesk(scene, keyboard)), `${label}: mouse on the right`);
    assert.deepEqual(actionable(analyzeProjectLayout(scene.room, scene.objects)).map(issue => issue.title), [], `${label}: layout`);
  }
});

test('a desk too small for the keyboard leaves it out with a note instead of putting it behind the screen', () => {
  const scene = withPeripherals([{ modelId: 'monitor-27', count: 1 }, { modelId: 'laptop-15', count: 1 }], { length: 0.8, depth: 0.6 });
  assert.equal(byModel(scene, 'keyboard').length, 0);
  assert.ok(scene.notes.includes('桌面上放不下键盘，已跳过。'));
  for (const object of [...byModel(scene, 'mouse')]) assert.ok(relativeToDesk(scene, object).y <= 0, 'anything placed is on the seat half');
});

const allExtras = ['keyboard', 'mouse', 'desk-lamp', 'speakers', 'game-console'].map(modelId => ({ modelId, count: 1 }));

test('the lamp takes the back corner on the seat\'s left and the speakers the one on its right', () => {
  const scene = buildDeskScene({ devices: [{ modelId: 'monitor-27', count: 1 }, { modelId: 'desk-lamp', count: 1 }, { modelId: 'speakers', count: 1 }], desk: { length: 1.4, depth: 0.7 } });
  const at = modelId => relativeToDesk(scene, byModel(scene, modelId)[0]);
  assert.ok(seatRightOf(at('speakers'), at('desk-lamp')), 'speakers on the right, lamp on the left');
  for (const modelId of ['desk-lamp', 'speakers']) {
    assert.ok(at(modelId).y > 0.2, `${modelId} at the back`);
    assert.ok(Math.abs(at(modelId).z) < 1e-9, `${modelId} on the desktop`);
    assert.equal(byModel(scene, modelId)[0].rotation.z, 180);
  }
  assertReadyToUse(scene, 'monitor, lamp and speakers');
});

test('when screens fill the back edge the lamp and speakers move to the sides', () => {
  const scene = buildDeskScene({ devices: [{ modelId: 'monitor-24', count: 3 }, { modelId: 'desktop-pc', count: 1 }, ...allExtras], desk: { length: 1.8, depth: 0.7 } });
  for (const modelId of ['desk-lamp', 'speakers']) {
    assert.equal(byModel(scene, modelId).length, 1, `${modelId} placed`);
    assert.ok(Math.abs(relativeToDesk(scene, byModel(scene, modelId)[0]).y) < 1e-9, `${modelId} halfway along a side`);
  }
  assertReadyToUse(scene, 'three screens and every extra');
});

test('a console sits on the floor on the seat\'s right and is powered, wired to a screen and to the router', () => {
  const scene = buildDeskScene({ devices: [{ modelId: 'monitor-27', count: 1 }, { modelId: 'router', count: 1 }, { modelId: 'game-console', count: 1 }], desk: { length: 1.4, depth: 0.7 } });
  const [gameConsole] = byModel(scene, 'game-console');
  const desk = byModel(scene, 'office-desk')[0];
  assert.ok(gameConsole.position.x < desk.position.x - desk.scale.x / 2, 'beside the desk on the seat\'s right');
  assert.ok(Math.abs(gameConsole.position.z - gameConsole.scale.z / 2) < 1e-9, 'on the floor');
  const types = connectionsTo(scene, gameConsole.id).map(connection => connection.cableType)
    .concat(scene.connections.filter(connection => connection.fromObjectId === gameConsole.id).map(connection => connection.cableType));
  assert.deepEqual(types.sort(), ['ethernet', 'hdmi', 'power']);
  assertReadyToUse(scene, 'screen, router and console');
  assert.deepEqual(scene.notes, []);
});

test('a console without a free screen input is noted only when there are screens', () => {
  const noScreens = buildDeskScene({ devices: [{ modelId: 'game-console', count: 1 }] });
  assert.deepEqual(noScreens.notes, [], 'it goes to a TV the desk does not model');
  const busy = buildDeskScene({ devices: [{ modelId: 'monitor-27', count: 1 }, { modelId: 'desktop-pc', count: 1 }, { modelId: 'laptop-15', count: 1 }, { modelId: 'game-console', count: 1 }], desk: { length: 1.6, depth: 0.8 } });
  assert.ok(busy.notes.some(note => note.includes('游戏主机') && note.includes('HDMI')));
});

test('a desk with everything gets a second strip on the wall outlet, never a strip on a strip', () => {
  const scene = buildDeskScene({
    devices: [{ modelId: 'desktop-pc', count: 1 }, { modelId: 'laptop-15', count: 1 }, { modelId: 'monitor-24', count: 3 }, { modelId: 'router', count: 1 }, ...allExtras],
    desk: { length: 2, depth: 0.8 },
  });
  const strips = byModel(scene, 'power-strip');
  assert.equal(strips.length, 2);
  for (const strip of strips) {
    const [feed] = connectionsTo(scene, strip.id);
    assert.equal(byModel(scene, 'wall-outlet')[0].id, feed.fromObjectId, `${strip.name} is fed by the wall outlet`);
  }
  assertReadyToUse(scene, 'everything');
});

test('common setups with every extra stay clean on ordinary desks', () => {
  const computers = [[{ modelId: 'desktop-pc', count: 1 }], [{ modelId: 'laptop-15', count: 1 }], [{ modelId: 'desktop-pc', count: 1 }, { modelId: 'laptop-15', count: 1 }]];
  const screens = [[], [{ modelId: 'monitor-27', count: 1 }], [{ modelId: 'monitor-24', count: 2 }], [{ modelId: 'ultrawide-monitor', count: 1 }]];
  for (const desk of [{ length: 1.4, depth: 0.7 }, { length: 1.6, depth: 0.8 }]) {
    for (const computer of computers) {
      for (const screen of screens) {
        const scene = buildDeskScene({ devices: [...computer, ...screen, { modelId: 'router', count: 1 }, ...allExtras], desk });
        const label = `${desk.length}m ${[...computer, ...screen].map(({ modelId, count }) => `${modelId}×${count}`).join(' ')}`;
        assertReadyToUse(scene, label);
      }
    }
  }
});

test('on the shallowest desk a laptop in front and the screens behind it do not overlap', () => {
  for (const monitorId of ['monitor-24', 'monitor-27', 'ultrawide-monitor']) {
    for (const extras of [[], [{ modelId: 'keyboard', count: 1 }, { modelId: 'mouse', count: 1 }]]) {
      const scene = buildDeskScene({
        devices: [{ modelId: 'laptop-15', count: 1 }, { modelId: monitorId, count: 1 }, ...extras],
        desk: { length: 1.4, depth: DESK_SIZE_LIMITS.depth.min },
      });
      assertReadyToUse(scene, `${monitorId}${extras.length ? ' with keyboard and mouse' : ''}`);
    }
  }
  // Deeper desks keep the screens 15 cm in from the back edge.
  const deep = buildDeskScene({ devices: [{ modelId: 'laptop-15', count: 1 }, { modelId: 'monitor-27', count: 1 }], desk: { length: 1.4, depth: 0.7 } });
  const desk = byModel(deep, 'office-desk')[0];
  const monitor = byModel(deep, 'monitor-27')[0];
  assert.ok(Math.abs(desk.position.y + desk.scale.y / 2 - 0.15 - monitor.position.y) < 1e-9);
});

// E60: the keyboard, mouse and speakers are on the computer like everything else.
const linesBetween = (scene, fromId, toId) => scene.connections.filter(connection =>
  connection.fromObjectId === fromId && connection.toObjectId === toId);

test('the keyboard and mouse go on the tower when there is one, else the laptop, each on its own USB port', () => {
  const ids = Object.keys(DESK_SCENE_DEVICE_LIMITS).filter(modelId => !['keyboard', 'mouse'].includes(modelId));
  const combos = [[]];
  for (const modelId of ids) {
    const next = [];
    for (const combo of combos) {
      for (let count = 0; count <= DESK_SCENE_DEVICE_LIMITS[modelId]; count += 1) next.push(count ? [...combo, { modelId, count }] : combo);
    }
    combos.splice(0, combos.length, ...next);
  }
  for (const devices of combos) {
    const scene = withPeripherals(devices, { length: 1.4, depth: 0.7 });
    const label = devices.map(({ modelId, count }) => `${modelId}×${count}`).join(' ') || 'nothing else';
    const computer = byModel(scene, 'desktop-pc')[0] || byModel(scene, 'laptop-15')[0];
    const peripherals = ['keyboard', 'mouse'].map(modelId => byModel(scene, modelId)[0]);
    const lines = peripherals.flatMap(device => scene.connections.filter(connection => connection.toObjectId === device.id));
    if (!computer) {
      assert.deepEqual(lines, [], `${label}: nothing to plug into`);
      continue;
    }
    assert.deepEqual(lines.map(line => [line.fromObjectId, line.cableType, line.toPortId]),
      [[computer.id, 'usb', 'usb-1'], [computer.id, 'usb', 'usb-1']], `${label}: both on ${computer.id}`);
    assert.notEqual(lines[0].fromPortId, lines[1].fromPortId, `${label}: different ports`);
    assert.deepEqual(actionable(analyzeProjectWiring(scene.objects, scene.connections)).map(issue => issue.title), [], `${label}: wiring`);
  }
});

test('on a laptop the keyboard and mouse take the USB ports that make the shortest cables', () => {
  const scene = withPeripherals([{ modelId: 'laptop-15', count: 1 }, { modelId: 'monitor-27', count: 1 }], { length: 1.4, depth: 0.7 });
  const laptop = byModel(scene, 'laptop-15')[0];
  const [keyboard, mouse] = ['keyboard', 'mouse'].map(modelId => byModel(scene, modelId)[0]);
  const [keyboardLine] = linesBetween(scene, laptop.id, keyboard.id);
  const [mouseLine] = linesBetween(scene, laptop.id, mouse.id);
  const again = withPeripherals([{ modelId: 'laptop-15', count: 1 }, { modelId: 'monitor-27', count: 1 }], { length: 1.4, depth: 0.7 });
  const routeOf = line => evaluateConnectionLength(line, scene.objects).distance;
  const swap = line => ({ ...line, fromPortId: line.fromPortId === 'usb-1' ? 'usb-2' : 'usb-1' });
  assert.ok(routeOf(keyboardLine) + routeOf(mouseLine) <= routeOf(swap(keyboardLine)) + routeOf(swap(mouseLine)) + 1e-9);
  assert.deepEqual(again.connections, scene.connections, 'the same every time');
  assertReadyToUse(scene, 'laptop with keyboard and mouse');
});

test('the speakers take the computer\'s headphone jack, and only their cable goes on the shopping list', () => {
  for (const computer of ['desktop-pc', 'laptop-15']) {
    const scene = buildDeskScene({
      devices: [{ modelId: computer, count: 1 }, { modelId: 'monitor-24', count: 1 }, ...allExtras],
      desk: { length: 1.6, depth: 0.8 },
    });
    const speakers = byModel(scene, 'speakers')[0];
    const pc = byModel(scene, computer)[0];
    assert.deepEqual(linesBetween(scene, pc.id, speakers.id).map(line => [line.fromPortId, line.toPortId, line.cableType]),
      [['audio-out', 'audio-in', 'audio']], computer);
    assertReadyToUse(scene, `${computer} with every extra`);
    const { items } = buildCableShoppingList(scene.connections, scene.objects);
    assert.equal(items.filter(item => item.name.includes('USB-A')).length, 0, `${computer}: a keyboard or mouse cable is built in`);
    assert.equal(items.filter(item => item.name.includes('3.5mm 音频线')).length, 1, `${computer}: the speakers cable is listed`);
  }
});
