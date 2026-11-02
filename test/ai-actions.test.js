import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyAiActions,
  applySuggestionsInOrder,
  evaluateSuggestion,
  evaluateSuggestions,
  parseAiResponse,
} from '../src/domain/ai-actions.js';
import { buildTemplateScene } from '../src/domain/desk-templates.js';
import { scoreLayout } from '../src/domain/layout-score.js';

const gaming = () => buildTemplateScene('gaming');
const find = (project, modelId) => project.objects.find(object => object.modelId === modelId);
const deskTop = project => { const desk = find(project, 'office-desk'); return desk.position.z + desk.scale.z / 2; };
const suggestion = (actions, extra = {}) => ({ id: 's1', title: '调整一下', reason: '这样更舒服。', category: 'space', actions, ...extra });

// A desk with the ultrawide pushed 0.4 m to the right: one hint to fix.
function messyGaming() {
  const project = gaming();
  return {
    ...project,
    objects: project.objects.map(object => (object.modelId === 'ultrawide-monitor'
      ? { ...object, position: { ...object.position, x: object.position.x + 0.4 } }
      : object)),
  };
}

test('moving the off-centre monitor back in front of the seat is accepted', () => {
  const project = messyGaming();
  const monitor = find(project, 'ultrawide-monitor');
  const result = evaluateSuggestion(project, suggestion([{ type: 'move', objectId: monitor.id, x: 0, y: monitor.position.y }]));
  assert.equal(result.accepted, true, result.reasons.join());
  assert.equal(result.scoreBefore.hints, 1);
  assert.equal(result.scoreAfter.hints, 0);
  const moved = find(result.nextProject, 'ultrawide-monitor');
  assert.equal(moved.position.x, 0);
  assert.ok(Math.abs(moved.position.z - moved.scale.z / 2 - deskTop(project)) < 1e-6, 'without z it lands on the desk');
  assert.equal(find(project, 'ultrawide-monitor').position.x, monitor.position.x, 'the input project is untouched');
});

test('a change that does not improve the layout is not shown', () => {
  const project = gaming();
  const monitor = find(project, 'ultrawide-monitor');
  const same = evaluateSuggestion(project, suggestion([{ type: 'move', objectId: monitor.id, x: monitor.position.x, y: monitor.position.y }]));
  assert.equal(same.accepted, false);
  assert.deepEqual(same.reasons, ['没有让布局变得更好']);
  const worse = evaluateSuggestion(project, suggestion([{ type: 'move', objectId: monitor.id, x: 0.5, y: monitor.position.y }]));
  assert.equal(worse.accepted, false);
});

test('a change that fixes one thing but breaks another is refused', () => {
  const project = messyGaming();
  const monitor = find(project, 'ultrawide-monitor');
  const laptop = find(project, 'laptop-15');
  // Centre the monitor (fixes the hint) but drop it onto the laptop's spot.
  const result = evaluateSuggestion(project, suggestion([
    { type: 'move', objectId: monitor.id, x: 0, y: monitor.position.y },
    { type: 'move', objectId: laptop.id, x: 0, y: monitor.position.y, z: deskTop(project) + laptop.scale.z / 2 },
  ]));
  assert.equal(result.accepted, false);
  assert.ok(result.reasons.includes('会产生新的提醒'), result.reasons.join());
});

test('monitors and laptops must stay on a desk', () => {
  const project = gaming();
  const monitor = find(project, 'ultrawide-monitor');
  const toFloor = applyAiActions(project, [{ type: 'move', objectId: monitor.id, x: 1.5, y: 0 }]);
  assert.equal(toFloor.project, null);
  assert.deepEqual(toFloor.rejected.map(item => item.reason), ['显示器和笔记本要放在桌面上']);
  const explicitFloor = applyAiActions(project, [{ type: 'move', objectId: monitor.id, x: 0, y: 1.2, z: monitor.scale.z / 2 }]);
  assert.equal(explicitFloor.project, null);
});

test('things on the floor stay on the floor when moved without z', () => {
  const project = gaming();
  const pc = find(project, 'desktop-pc');
  const { project: next } = applyAiActions(project, [{ type: 'move', objectId: pc.id, x: -0.98, y: pc.position.y }]);
  assert.equal(find(next, 'desktop-pc').position.z, pc.scale.z / 2);
});

test('unknown devices, outside the room, outlets and unsupported changes are refused', () => {
  const project = gaming();
  const outlet = find(project, 'wall-outlet');
  const router = find(project, 'router');
  for (const [action, reason] of [
    [{ type: 'move', objectId: 'ghost', x: 0, y: 0 }, '找不到设备 ghost'],
    [{ type: 'move', objectId: router.id, x: 5, y: 0 }, '位置超出房间'],
    [{ type: 'move', objectId: outlet.id, x: 0, y: 1.74 }, '墙壁插座不能移动'],
    [{ type: 'remove', objectId: router.id }, '不支持的改动'],
    [{ type: 'add', modelId: 'router' }, '不支持的改动'],
  ]) {
    const result = applyAiActions(project, [action]);
    assert.equal(result.project, null, JSON.stringify(action));
    assert.equal(result.rejected[0].reason, reason);
  }
});

test('a clamp stand holds the monitor, and moving the stand takes the monitor along', () => {
  const project = gaming();
  const monitor = find(project, 'ultrawide-monitor');
  const top = deskTop(project);
  const standHeight = 0.45;
  const stand = {
    id: 'stand', name: '显示器支架', type: 'monitor-stand', modelId: 'monitor-stand',
    shape: 'box', category: 'accessory',
    position: { x: monitor.position.x, y: monitor.position.y, z: top + standHeight / 2 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 0.18, y: 0.28, z: standHeight },
    ports: [],
  };
  const raised = { ...monitor, position: { ...monitor.position, z: top + standHeight + monitor.scale.z / 2 } };
  const withStand = {
    ...project,
    objects: project.objects.map(object => (object.id === monitor.id ? raised : object)).concat(stand),
  };
  const pulled = applyAiActions(withStand, [{ type: 'move', objectId: 'stand', x: stand.position.x + 0.4, y: stand.position.y }]);
  assert.notEqual(pulled.project, null, pulled.rejected.map(item => item.reason).join());
  const movedMonitor = find(pulled.project, monitor.modelId);
  assert.ok(Math.abs(movedMonitor.position.x - (raised.position.x + 0.4)) < 1e-9, 'the monitor went with the stand');
  assert.equal(movedMonitor.position.z, raised.position.z, 'still on the stand');
  const stayed = applyAiActions(withStand, [{ type: 'move', objectId: monitor.id, x: monitor.position.x + 0.02, y: monitor.position.y, z: raised.position.z }]);
  assert.notEqual(stayed.project, null, stayed.rejected.map(item => item.reason).join());
});

test('one refused action voids the whole suggestion', () => {
  const project = messyGaming();
  const monitor = find(project, 'ultrawide-monitor');
  const result = evaluateSuggestion(project, suggestion([
    { type: 'move', objectId: monitor.id, x: 0, y: monitor.position.y },
    { type: 'remove', objectId: 'desk' },
  ]));
  assert.equal(result.accepted, false);
  assert.deepEqual(result.reasons, ['不支持的改动']);
});

test('rotate normalizes the angle and turning a monitor away is refused by the score', () => {
  const project = gaming();
  const monitor = find(project, 'ultrawide-monitor');
  const { project: next } = applyAiActions(project, [{ type: 'rotate', objectId: monitor.id, rotationZ: -180 }]);
  assert.equal(find(next, 'ultrawide-monitor').rotation.z, 180);
  assert.equal(evaluateSuggestion(project, suggestion([{ type: 'rotate', objectId: monitor.id, rotationZ: 0 }])).accepted, false);

  const turned = { ...project, objects: project.objects.map(o => (o.id === monitor.id ? { ...o, rotation: { ...o.rotation, z: 0 } } : o)) };
  assert.equal(evaluateSuggestion(turned, suggestion([{ type: 'rotate', objectId: monitor.id, rotationZ: 180 }])).accepted, true);
});

test('swap exchanges two devices, each keeping its own level', () => {
  // Bring the router forward so the deeper tower fits where it was.
  const base = gaming();
  const project = { ...base, objects: base.objects.map(o => (o.modelId === 'router' ? { ...o, position: { ...o.position, y: 1.2 } } : o)) };
  const pc = find(project, 'desktop-pc');
  const router = find(project, 'router');
  const { project: next, rejected } = applyAiActions(project, [{ type: 'swap', objectIdA: pc.id, objectIdB: router.id }]);
  assert.deepEqual(rejected, []);
  const nextPc = find(next, 'desktop-pc');
  const nextRouter = find(next, 'router');
  assert.deepEqual([nextPc.position.x, nextPc.position.y], [router.position.x, router.position.y]);
  assert.deepEqual([nextRouter.position.x, nextRouter.position.y], [pc.position.x, pc.position.y]);
  assert.equal(nextPc.position.z, pc.scale.z / 2);
  const walls = applyAiActions(base, [{ type: 'swap', objectIdA: pc.id, objectIdB: router.id }]);
  assert.equal(walls.rejected[0].reason, '位置超出房间', 'the tower would stick through the wall');
  for (const action of [
    { type: 'swap', objectIdA: pc.id, objectIdB: pc.id },
    { type: 'swap', objectIdA: pc.id, objectIdB: find(project, 'office-desk').id },
    { type: 'swap', objectIdA: pc.id, objectIdB: find(project, 'wall-outlet').id },
  ]) assert.equal(applyAiActions(project, [action]).project, null, JSON.stringify(action));
});

test('connect checks ports and picks the cable type and a store length', () => {
  const project = gaming();
  const pc = find(project, 'desktop-pc');
  const monitor = find(project, 'ultrawide-monitor');
  const freed = { ...project, connections: project.connections.filter(c => !(c.fromObjectId === pc.id && c.fromPortId === 'dp-out')) };
  const { project: next } = applyAiActions(freed, [{ type: 'connect', fromObjectId: pc.id, fromPortId: 'dp-out', toObjectId: monitor.id, toPortId: 'dp-in' }]);
  const added = next.connections.at(-1);
  assert.equal(added.cableType, 'displayport');
  assert.equal(added.name, '台式主机DP 线');
  assert.ok([0.5, 1, 1.5, 1.8, 2, 3, 5, 10].includes(added.length));
  assert.ok(added.id.startsWith('c-ai-'));

  for (const [state, action, reason] of [
    [freed, { type: 'connect', fromObjectId: pc.id, fromPortId: 'hdmi-out', toObjectId: monitor.id, toPortId: 'dp-in' }, '这两个接口接不到一起'],
    [freed, { type: 'connect', fromObjectId: monitor.id, fromPortId: 'dp-in', toObjectId: pc.id, toPortId: 'dp-out' }, '这两个接口接不到一起'],
    [project, { type: 'connect', fromObjectId: pc.id, fromPortId: 'dp-out', toObjectId: monitor.id, toPortId: 'dp-in' }, '接口已经接了线'],
    [freed, { type: 'connect', fromObjectId: pc.id, fromPortId: 'usb-9', toObjectId: monitor.id, toPortId: 'dp-in' }, '台式主机 没有这个接口'],
    [freed, { type: 'connect', fromObjectId: pc.id, fromPortId: 'dp-out', toObjectId: pc.id, toPortId: 'ac-in' }, '不能自己连自己'],
  ]) {
    assert.equal(applyAiActions(state, [action]).rejected[0]?.reason, reason, JSON.stringify(action));
  }
});

test('disconnect never removes power lines; cable length cannot go below what is needed', () => {
  const project = gaming();
  const power = project.connections.find(c => c.cableType === 'power');
  const video = project.connections.find(c => c.cableType === 'displayport' || c.cableType === 'hdmi');
  assert.equal(applyAiActions(project, [{ type: 'disconnect', connectionId: power.id }]).rejected[0].reason, '不拔电源线');
  assert.equal(applyAiActions(project, [{ type: 'disconnect', connectionId: video.id }]).project.connections.length, project.connections.length - 1);
  assert.equal(applyAiActions(project, [{ type: 'set_cable_length', connectionId: video.id, length: 0.1 }]).rejected[0].reason, '线会不够长');

  const long = { ...project, connections: project.connections.map(c => (c.id === video.id ? { ...c, length: 10 } : c)) };
  const shorter = evaluateSuggestion(long, suggestion([{ type: 'set_cable_length', connectionId: video.id, length: video.length }]));
  assert.equal(shorter.accepted, true, shorter.reasons.join());
  assert.equal(shorter.nextProject.connections.find(c => c.id === video.id).length, video.length);
});

test('titles or reasons with internal ids are not shown', () => {
  const project = messyGaming();
  const monitor = find(project, 'ultrawide-monitor');
  const action = { type: 'move', objectId: monitor.id, x: 0, y: monitor.position.y };
  for (const text of [{ title: '把 ultrawide-monitor-1 居中' }, { reason: '端口 ac_input 已连接。' }]) {
    const result = evaluateSuggestion(project, suggestion([action], text));
    assert.deepEqual(result.reasons, ['说明里有内部编号'], JSON.stringify(text));
  }
  assert.equal(evaluateSuggestion(project, suggestion([action], { title: '用 USB-C 和 HDMI 连接' })).accepted, true);
});

test('suggestions are ranked by improvement and can be applied one after another', () => {
  const base = gaming();
  const monitor = find(base, 'ultrawide-monitor');
  const router = find(base, 'router');
  const desk = find(base, 'office-desk');
  const messy = {
    ...base,
    objects: base.objects.map(object => {
      if (object.id === monitor.id) return { ...object, position: { ...object.position, x: 0.4 } };
      if (object.id === router.id) return { ...object, position: { ...object.position, x: 0.2, y: desk.position.y } };
      return object;
    }),
  };
  const fixMonitor = suggestion([{ type: 'move', objectId: monitor.id, x: 0, y: monitor.position.y }], { id: 'monitor' });
  const fixRouter = suggestion([{ type: 'move', objectId: router.id, x: router.position.x, y: router.position.y }], { id: 'router' });
  const useless = suggestion([{ type: 'move', objectId: monitor.id, x: 0.4, y: monitor.position.y }], { id: 'useless' });
  const ranked = evaluateSuggestions(messy, [useless, fixMonitor, fixRouter]);
  assert.deepEqual(ranked.map(result => result.suggestion.id).sort(), ['monitor', 'router']);

  const { project, applied, skipped } = applySuggestionsInOrder(messy, [fixMonitor, fixRouter, fixMonitor]);
  assert.deepEqual(applied, ['monitor', 'router']);
  assert.deepEqual(skipped, ['monitor'], 'applying the same fix twice does nothing the second time');
  assert.deepEqual(scoreLayout(project).codes.hints, []);
});

test('parseAiResponse uses the shared structural filter', () => {
  assert.deepEqual(parseAiResponse({ suggestions: [{ title: 'x', reason: 'y', actions: [{ type: 'remove', objectId: 'a' }] }] }), []);
});

test('summary, mock model, and validation fit together end to end', async () => {
  const { buildSceneSummary } = await import('../src/domain/ai-scene-summary.js');
  const { mockSuggestions } = await import('../server/ai/mock-model.js');
  const project = messyGaming();
  const answer = { suggestions: mockSuggestions(buildSceneSummary(project)) };
  const accepted = evaluateSuggestions(project, parseAiResponse(answer));
  assert.equal(accepted.length, 1);
  assert.deepEqual(scoreLayout(accepted[0].nextProject).codes.hints, []);
});

test('changed devices are listed for highlighting', async () => {
  const { changedObjectIds } = await import('../src/domain/ai-actions.js');
  const project = gaming();
  const monitor = find(project, 'ultrawide-monitor');
  const video = project.connections.find(c => c.cableType === 'displayport');
  const { project: moved } = applyAiActions(project, [{ type: 'rotate', objectId: monitor.id, rotationZ: 170 }]);
  assert.deepEqual(changedObjectIds(project, moved), [monitor.id]);
  const { project: shorter } = applyAiActions(
    { ...project, connections: project.connections.map(c => (c.id === video.id ? { ...c, length: 10 } : c)) },
    [{ type: 'set_cable_length', connectionId: video.id, length: video.length }],
  );
  assert.deepEqual(changedObjectIds({ ...project, connections: project.connections.map(c => (c.id === video.id ? { ...c, length: 10 } : c)) }, shorter).sort(),
    [video.fromObjectId, video.toObjectId].sort());
  assert.deepEqual(changedObjectIds(project, project), []);
});

// Since E48 what stands on a desk goes along when it moves; the AI's moves
// and turns do the same instead of refusing a loaded desk.
test('moving or turning a loaded desk takes what stands on it along', () => {
  const project = gaming();
  const desk = find(project, 'office-desk');
  const monitor = find(project, 'ultrawide-monitor');
  const laptop = find(project, 'laptop-15');
  const moved = applyAiActions(project, [{ type: 'move', objectId: desk.id, x: desk.position.x, y: desk.position.y - 0.3 }]);
  assert.notEqual(moved.project, null, moved.rejected.map(item => item.reason).join());
  for (const device of [monitor, laptop]) {
    const after = find(moved.project, device.modelId);
    assert.ok(Math.abs(after.position.y - (device.position.y - 0.3)) < 1e-9, `${device.id} moved with the desk`);
    assert.equal(after.position.z, device.position.z, `${device.id} still on the desk`);
  }
  const pc = find(project, 'desktop-pc');
  assert.deepEqual(find(moved.project, pc.modelId).position, pc.position, 'the tower on the floor stays');

  const turned = applyAiActions(moved.project, [{ type: 'rotate', objectId: desk.id, rotationZ: 15 }]);
  assert.notEqual(turned.project, null, turned.rejected.map(item => item.reason).join());
  assert.equal(find(turned.project, monitor.modelId).rotation.z, (monitor.rotation.z + 15) % 360, 'the screen turns with the desk');
});
