import test from 'node:test';
import assert from 'node:assert/strict';

import { DESK_TEMPLATES, buildTemplateScene } from '../src/domain/desk-templates.js';
import { analyzeLayoutHeuristics } from '../src/domain/layout-heuristics.js';
import { findSupportingObject, snapObjectToSupport } from '../src/domain/layout-analysis.js';

const scene = id => buildTemplateScene(id);
const codes = (room, objects, connections = []) => analyzeLayoutHeuristics(room, objects, connections).map(h => h.code).sort();
const byModel = (objects, modelId) => objects.find(object => object.modelId === modelId);
const moved = (objects, modelId, change) => objects.map(object => (object.modelId === modelId ? change(structuredClone(object)) : object));

test('every built-in template is a good desk with no hints', () => {
  for (const template of DESK_TEMPLATES) {
    const { room, objects, connections } = scene(template.id);
    assert.deepEqual(analyzeLayoutHeuristics(room, objects, connections), [], template.id);
  }
});

test('support finder tells desk, floor, wall, under-desk, and floating apart', () => {
  const { objects } = scene('desktop-dual');
  const desk = byModel(objects, 'office-desk');
  assert.deepEqual(findSupportingObject(byModel(objects, 'monitor-27'), objects), { kind: 'object', id: desk.id });
  assert.deepEqual(findSupportingObject(byModel(objects, 'power-strip'), objects), { kind: 'under-desk', id: desk.id });
  assert.deepEqual(findSupportingObject(byModel(objects, 'desktop-pc'), objects), { kind: 'floor' });
  assert.deepEqual(findSupportingObject(byModel(objects, 'wall-outlet'), objects), { kind: 'wall' });
  const floating = { ...byModel(objects, 'keyboard'), id: 'up-in-the-air', position: { x: 0, y: 0, z: 1.5 } };
  assert.equal(findSupportingObject(floating, objects), null);
});

test('a monitor resting on a clamp stand is held up and still counts as on the desk', () => {
  const { room, objects } = scene('home-office');
  const desk = byModel(objects, 'office-desk');
  const monitor = byModel(objects, 'monitor-27');
  const deskTop = desk.position.z + desk.scale.z / 2;
  const standHeight = 0.45;
  const stand = {
    ...monitor,
    id: 'stand',
    name: '显示器支架',
    type: 'monitor-stand',
    modelId: 'monitor-stand',
    scale: { x: 0.18, y: 0.28, z: standHeight },
    position: { x: monitor.position.x, y: monitor.position.y, z: deskTop + standHeight / 2 },
    ports: [],
  };
  const raised = { ...monitor, position: { ...monitor.position, z: deskTop + standHeight + monitor.scale.z / 2 } };
  const withStand = objects.map(object => (object.id === monitor.id ? raised : object)).concat(stand);
  assert.deepEqual(findSupportingObject(raised, withStand), { kind: 'object', id: 'stand' });
  assert.deepEqual(findSupportingObject(stand, withStand), { kind: 'object', id: desk.id });
  assert.ok(!codes(room, withStand).includes('monitor_not_on_desk'));
  const floating = { ...raised, position: { ...raised.position, z: 2 } };
  const settled = snapObjectToSupport(room, floating, withStand.filter(object => object.id !== raised.id));
  assert.ok(Math.abs(settled.position.z - raised.position.z) < 1e-6);
});

test('an off-centre single monitor, or a monitor group off to one side, is hinted', () => {
  const { room, objects } = scene('home-office');
  assert.deepEqual(codes(room, moved(objects, 'monitor-27', m => { m.position.x += 0.3; return m; })), ['monitor_off_center']);
  assert.deepEqual(codes(room, moved(objects, 'monitor-27', m => { m.position.x += 0.1; return m; })), []);
  const dual = scene('desktop-dual');
  const shifted = dual.objects.map(o => (o.modelId === 'monitor-27' ? { ...o, position: { ...o.position, x: o.position.x + 0.25 } } : o));
  assert.deepEqual(codes(dual.room, shifted), ['monitor_off_center']);
});

test('a monitor too close, turned away, or off the desk is hinted', () => {
  const { room, objects } = scene('home-office');
  const desk = byModel(objects, 'office-desk');
  const close = moved(objects, 'monitor-27', m => { m.position.y = desk.position.y - desk.scale.y / 2 + 0.05; return m; });
  assert.ok(codes(room, close).includes('monitor_too_close'));
  assert.deepEqual(codes(room, moved(objects, 'monitor-27', m => { m.rotation.z = 0; return m; })), ['monitor_facing_away']);
  assert.deepEqual(codes(room, moved(objects, 'monitor-27', m => { m.rotation.z = 160; return m; })), []);
  const onFloor = moved(objects, 'monitor-27', m => { m.position = { x: 1.5, y: 0, z: m.scale.z / 2 }; return m; });
  assert.deepEqual(codes(room, onFloor), ['monitor_not_on_desk']);
});

test('a laptop at the back of the desk is hinted', async () => {
  const { buildDeskScene } = await import('../src/domain/scene-builder.js');
  const built = buildDeskScene({
    devices: [{ modelId: 'laptop-15', count: 1 }],
    desk: { length: 1.4, depth: 0.75 },
  });
  const desk = byModel(built.objects, 'office-desk');
  const atBack = moved(built.objects, 'laptop-15', laptop => {
    laptop.position.x = 0.4;
    laptop.position.y = desk.position.y + 0.15;
    return laptop;
  });
  assert.deepEqual(codes(built.room, atBack), ['laptop_at_back']);
});

test('a laptop at the back is fine when a keyboard on the same desk does the typing', async () => {
  const { buildDeskScene } = await import('../src/domain/scene-builder.js');
  const built = buildDeskScene({
    devices: [{ modelId: 'laptop-15', count: 1 }, { modelId: 'keyboard', count: 1 }],
    desk: { length: 1.2, depth: 0.7 },
  });
  const laptop = byModel(built.objects, 'laptop-15');
  const desk = byModel(built.objects, 'office-desk');
  assert.ok(laptop.position.y > desk.position.y, 'the builder put the laptop at the back');
  assert.deepEqual(codes(built.room, built.objects), []);
  const withoutKeyboard = built.objects.filter(object => object.modelId !== 'keyboard');
  assert.deepEqual(codes(built.room, withoutKeyboard), ['laptop_at_back']);
});

test('a tower in the middle of the desk, or under it where the legs go, is hinted', () => {
  const { room, objects } = scene('desktop-dual');
  const desk = byModel(objects, 'office-desk');
  const deskTop = desk.position.z + desk.scale.z / 2;
  const onDesk = moved(objects, 'desktop-pc', pc => { pc.position = { x: 0, y: desk.position.y - 0.1, z: deskTop + pc.scale.z / 2 }; return pc; });
  assert.ok(codes(room, onDesk).includes('tower_on_desk_center'));
  const legroom = moved(objects, 'desktop-pc', pc => { pc.position.x = 0; pc.position.y = desk.position.y; return pc; });
  assert.deepEqual(codes(room, legroom), ['tower_blocks_legroom']);
  const desktopEnd = moved(objects, 'desktop-pc', pc => { pc.position = { x: 0.55, y: desk.position.y, z: deskTop + pc.scale.z / 2 }; return pc; });
  assert.ok(!codes(room, desktopEnd).includes('tower_on_desk_center'), 'the end of the desk is fine');
});

test('a power strip on the desk and a router buried under it are hinted', () => {
  const { room, objects } = scene('gaming');
  const desk = byModel(objects, 'office-desk');
  const deskTop = desk.position.z + desk.scale.z / 2;
  const strip = moved(objects, 'power-strip', s => { s.position = { x: 0, y: desk.position.y - 0.25, z: deskTop + s.scale.z / 2 }; return s; });
  assert.ok(codes(room, strip).includes('strip_on_desk'));
  const router = moved(objects, 'router', r => { r.position.x = 0.2; r.position.y = desk.position.y; return r; });
  assert.deepEqual(codes(room, router), ['router_buried']);
});

test('a cable far longer than needed is hinted, a little spare is fine', () => {
  const { room, objects, connections } = scene('gaming');
  const hdmi = connections.find(c => c.cableType === 'hdmi' || c.cableType === 'displayport');
  const long = connections.map(c => (c.id === hdmi.id ? { ...c, length: 10 } : c));
  const hints = analyzeLayoutHeuristics(room, objects, long);
  assert.deepEqual(hints.map(h => h.code), ['cable_too_long']);
  assert.deepEqual(hints[0].connectionIds, [hdmi.id]);
  assert.deepEqual(codes(room, objects, connections.map(c => (c.id === hdmi.id ? { ...c, length: c.length + 0.5 } : c))), []);
});

test('hint messages name devices the user way, never by internal ids', () => {
  const { room, objects } = scene('home-office');
  const [hint] = analyzeLayoutHeuristics(room, moved(objects, 'monitor-27', m => { m.rotation.z = 0; return m; }));
  assert.equal(hint.severity, 'hint');
  assert.match(hint.message, /^27 英寸显示器/);
  assert.doesNotMatch(hint.message, /monitor|[a-z]+-\d/);
});

test('desks generated from a device list are good desks too', async () => {
  const { buildDeskScene } = await import('../src/domain/scene-builder.js');
  const samples = [
    [{ modelId: 'desktop-pc', count: 1 }, { modelId: 'monitor-24', count: 3 }, { modelId: 'router', count: 1 }],
    [{ modelId: 'laptop-15', count: 1 }, { modelId: 'monitor-27', count: 2 }],
    [{ modelId: 'desktop-pc', count: 1 }, { modelId: 'laptop-15', count: 1 }, { modelId: 'ultrawide-monitor', count: 2 }],
    [],
  ];
  for (const devices of samples) {
    for (const desk of [{ length: 0.8, depth: 0.5 }, { length: 1.4, depth: 0.7 }, { length: 3, depth: 1.2 }]) {
      const { room, objects, connections } = buildDeskScene({ devices, desk });
      assert.deepEqual(analyzeLayoutHeuristics(room, objects, connections), [], JSON.stringify({ devices, desk }));
    }
  }
});

test('the seat is in front of the desk, following its rotation', async () => {
  const { getDeskSeat } = await import('../src/domain/layout-heuristics.js');
  const desk = { position: { x: 0, y: 1, z: 0.375 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1.4, y: 0.7, z: 0.75 } };
  const seat = getDeskSeat(desk);
  assert.ok(Math.abs(seat.x) < 1e-9 && Math.abs(seat.y - (1 - 0.35 - 0.35)) < 1e-9);
  const turned = getDeskSeat({ ...desk, rotation: { x: 0, y: 0, z: 90 } });
  // Local -y turned by 90 degrees points along +x.
  assert.ok(Math.abs(turned.x - 0.7) < 1e-9 && Math.abs(turned.y - 1) < 1e-9);
});

test('every hint carries a fix that the AI checks would accept', async () => {
  const { evaluateSuggestion } = await import('../src/domain/ai-actions.js');
  const cases = [];
  const add = (name, project) => cases.push([name, project]);
  const withObjects = (id, objects) => ({ ...scene(id), objects });
  const base = id => scene(id);

  add('monitor too close', withObjects('home-office', moved(base('home-office').objects, 'monitor-27', m => {
    const desk = byModel(base('home-office').objects, 'office-desk');
    m.position.y = desk.position.y - desk.scale.y / 2 + m.scale.y / 2 + 0.01;
    return m;
  })));
  add('monitor off centre', withObjects('home-office', moved(base('home-office').objects, 'monitor-27', m => { m.position.x += 0.3; return m; })));
  add('monitor turned away', withObjects('gaming', moved(base('gaming').objects, 'ultrawide-monitor', m => { m.rotation.z = 90; return m; })));
  const { buildDeskScene } = await import('../src/domain/scene-builder.js');
  const typing = buildDeskScene({
    devices: [{ modelId: 'laptop-15', count: 1 }],
    desk: { length: 1.4, depth: 0.75 },
  });
  const typingDesk = byModel(typing.objects, 'office-desk');
  add('laptop at back', {
    ...typing,
    objects: moved(typing.objects, 'laptop-15', laptop => {
      laptop.position.y = typingDesk.position.y + 0.15;
      laptop.position.x = 0.4;
      return laptop;
    }),
  });
  const dual = base('desktop-dual');
  const dualDesk = byModel(dual.objects, 'office-desk');
  const dualTop = dualDesk.position.z + dualDesk.scale.z / 2;
  add('tower in legroom', withObjects('desktop-dual', moved(dual.objects, 'desktop-pc', pc => { pc.position.x = 0; pc.position.y = dualDesk.position.y; return pc; })));
  add('tower on desk', withObjects('desktop-dual', moved(dual.objects, 'desktop-pc', pc => { pc.position = { x: 0.05, y: dualDesk.position.y - 0.1, z: dualTop + pc.scale.z / 2 }; return pc; })));
  const gaming = base('gaming');
  const gamingDesk = byModel(gaming.objects, 'office-desk');
  const gamingTop = gamingDesk.position.z + gamingDesk.scale.z / 2;
  add('strip on desk', withObjects('gaming', moved(gaming.objects, 'power-strip', st => { st.position = { x: 0, y: gamingDesk.position.y - 0.25, z: gamingTop + st.scale.z / 2 }; return st; })));
  add('strip on floor', withObjects('gaming', moved(gaming.objects, 'power-strip', st => {
    st.position = { x: 0, y: gamingDesk.position.y - gamingDesk.scale.y / 2 - 0.2, z: st.scale.z / 2 };
    return st;
  })));
  add('router buried', withObjects('gaming', moved(gaming.objects, 'router', r => { r.position.x = 0.2; r.position.y = gamingDesk.position.y; return r; })));
  const hdmi = gaming.connections.find(c => c.cableType !== 'power');
  add('cable too long', { ...gaming, connections: gaming.connections.map(c => (c.id === hdmi.id ? { ...c, length: 10 } : c)) });

  const blocking = buildDeskScene({
    devices: [
      { modelId: 'monitor-27', count: 1 },
      { modelId: 'laptop-15', count: 1 },
      { modelId: 'keyboard', count: 1 },
    ],
    desk: { length: 1.6, depth: 0.8 },
  });
  const blockingMonitor = byModel(blocking.objects, 'monitor-27');
  const blockingLaptop = byModel(blocking.objects, 'laptop-15');
  add('laptop in front of the screen', {
    ...blocking,
    objects: blocking.objects.map(object => (object.id === blockingLaptop.id ? {
      ...object,
      position: {
        x: blockingMonitor.position.x,
        y: blockingMonitor.position.y - 0.28,
        z: blockingLaptop.position.z,
      },
    } : object)),
  });

  const furnished = extras => buildDeskScene({
    devices: [{ modelId: 'monitor-24', count: 1 }, ...extras],
    desk: { length: 1.6, depth: 0.8 },
  });
  const place = (project, modelId, position) => ({
    ...project,
    connections: [],
    objects: project.objects.map(object => (object.modelId === modelId ? { ...object, position } : object)),
  });
  const consoleScene = furnished([{ modelId: 'game-console', count: 1 }]);
  const consoleDesk = byModel(consoleScene.objects, 'office-desk');
  const game = byModel(consoleScene.objects, 'game-console');
  const consoleTop = consoleDesk.position.z + consoleDesk.scale.z / 2;
  add('console on desk', place(consoleScene, 'game-console', {
    x: consoleDesk.position.x, y: consoleDesk.position.y, z: consoleTop + game.scale.z / 2,
  }));
  add('console in legroom', place(consoleScene, 'game-console', {
    x: consoleDesk.position.x, y: consoleDesk.position.y, z: game.scale.z / 2,
  }));
  const lampScene = furnished([{ modelId: 'desk-lamp', count: 1 }]);
  const lampDesk = byModel(lampScene.objects, 'office-desk');
  const lamp = byModel(lampScene.objects, 'desk-lamp');
  add('lamp in front', place(lampScene, 'desk-lamp', {
    x: lampDesk.position.x + 0.2,
    y: lampDesk.position.y - lampDesk.scale.y / 2 + lamp.scale.y / 2 + 0.02,
    z: lampDesk.position.z + lampDesk.scale.z / 2 + lamp.scale.z / 2,
  }));
  const speakerScene = furnished([{ modelId: 'speakers', count: 1 }]);
  const speakerDesk = byModel(speakerScene.objects, 'office-desk');
  const speakers = byModel(speakerScene.objects, 'speakers');
  add('speakers in front', place(speakerScene, 'speakers', {
    x: speakerDesk.position.x - 0.2,
    y: speakerDesk.position.y - speakerDesk.scale.y / 2 + speakers.scale.y / 2 + 0.02,
    z: speakerDesk.position.z + speakerDesk.scale.z / 2 + speakers.scale.z / 2,
  }));
  const mouseScene = furnished([{ modelId: 'keyboard', count: 1 }, { modelId: 'mouse', count: 1 }]);
  const mouseDesk = byModel(mouseScene.objects, 'office-desk');
  const mouse = byModel(mouseScene.objects, 'mouse');
  add('mouse far from keyboard', place(mouseScene, 'mouse', {
    x: mouseDesk.position.x + mouseDesk.scale.x / 2 - mouse.scale.x / 2 - 0.04,
    y: mouseDesk.position.y,
    z: mouseDesk.position.z + mouseDesk.scale.z / 2 + mouse.scale.z / 2,
  }));
  const expectCode = (name, code) => {
    const project = cases.find(([label]) => label === name)[1];
    assert.ok(analyzeLayoutHeuristics(project.room, project.objects, project.connections).some(item => item.code === code), name);
  };
  expectCode('console on desk', 'console_on_desk');
  expectCode('console in legroom', 'console_blocks_legroom');
  expectCode('lamp in front', 'lamp_blocks_work');
  expectCode('speakers in front', 'speakers_block_seat');
  expectCode('mouse far from keyboard', 'mouse_far_from_keyboard');
  expectCode('strip on floor', 'strip_on_floor');
  expectCode('laptop in front of the screen', 'laptop_blocks_screen');

  for (const [name, project] of cases) {
    const hints = analyzeLayoutHeuristics(project.room, project.objects, project.connections);
    assert.ok(hints.length > 0, `${name} has a hint`);
    for (const item of hints) {
      assert.ok(Array.isArray(item.fix) && item.fix.length > 0, `${name}: ${item.code} has a fix`);
      const result = evaluateSuggestion(project, { id: 'fix', title: '调整', reason: '这样更好。', actions: item.fix });
      assert.equal(result.accepted, true, `${name}: ${item.code} fix rejected (${result.reasons.join('；')})`);
      assert.doesNotMatch(item.message, /[a-z]+-\d|[a-z]+_[a-z]+/i, `${name}: ${item.code} message`);
    }
  }
});

test('a generated desk with a lamp, speakers, console and mouse has no comfort hints', async () => {
  const { buildDeskScene } = await import('../src/domain/scene-builder.js');
  const extras = ['keyboard', 'mouse', 'desk-lamp', 'speakers', 'game-console'].map(modelId => ({ modelId, count: 1 }));
  const computers = [
    [{ modelId: 'laptop-15', count: 1 }, { modelId: 'monitor-27', count: 1 }],
    [{ modelId: 'desktop-pc', count: 1 }, { modelId: 'monitor-24', count: 2 }],
    [{ modelId: 'desktop-pc', count: 1 }, { modelId: 'laptop-15', count: 1 }, { modelId: 'ultrawide-monitor', count: 1 }],
  ];
  for (const devices of computers) {
    for (const desk of [{ length: 1.4, depth: 0.7 }, { length: 1.6, depth: 0.6 }, { length: 2, depth: 0.7 }]) {
      const built = buildDeskScene({ devices: [...devices, ...extras], desk });
      assert.deepEqual(
        analyzeLayoutHeuristics(built.room, built.objects, built.connections),
        [],
        JSON.stringify({ devices, desk }),
      );
    }
  }
});
