import test from 'node:test';
import assert from 'node:assert/strict';

import { DESK_TEMPLATES, buildTemplateScene } from '../src/domain/desk-templates.js';
import { analyzeLayoutHeuristics } from '../src/domain/layout-heuristics.js';
import { findSupportingObject } from '../src/domain/layout-analysis.js';

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

test('support finder tells desk, floor, wall, and floating apart', () => {
  const { objects } = scene('desktop-dual');
  const desk = byModel(objects, 'office-desk');
  assert.deepEqual(findSupportingObject(byModel(objects, 'monitor-24'), objects), { kind: 'object', id: desk.id });
  assert.deepEqual(findSupportingObject(byModel(objects, 'desktop-pc'), objects), { kind: 'floor' });
  assert.deepEqual(findSupportingObject(byModel(objects, 'wall-outlet'), objects), { kind: 'wall' });
  const floating = { ...byModel(objects, 'router'), position: { x: -0.93, y: 1.6, z: 1.5 } };
  assert.equal(findSupportingObject(floating, objects), null);
});

test('an off-centre single monitor, or a monitor group off to one side, is hinted', () => {
  const { room, objects } = scene('home-office');
  assert.deepEqual(codes(room, moved(objects, 'monitor-27', m => { m.position.x += 0.3; return m; })), ['monitor_off_center']);
  assert.deepEqual(codes(room, moved(objects, 'monitor-27', m => { m.position.x += 0.1; return m; })), []);
  const dual = scene('desktop-dual');
  const shifted = dual.objects.map(o => (o.modelId === 'monitor-24' ? { ...o, position: { ...o.position, x: o.position.x + 0.25 } } : o));
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

test('a laptop at the back of the desk is hinted', () => {
  const { room, objects } = scene('home-office');
  const desk = byModel(objects, 'office-desk');
  assert.deepEqual(codes(room, moved(objects, 'laptop-15', l => { l.position.x = 0.4; l.position.y = desk.position.y + 0.15; return l; })), ['laptop_at_back']);
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
