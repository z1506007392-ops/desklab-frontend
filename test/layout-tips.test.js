import test from 'node:test';
import assert from 'node:assert/strict';

import { applyLayoutTip, buildLayoutTips } from '../src/domain/layout-tips.js';
import { buildTemplateScene, DESK_TEMPLATES } from '../src/domain/desk-templates.js';
import { hydrateProjectObjects } from '../src/domain/catalog.js';
import { analyzeLayoutHeuristics } from '../src/domain/layout-heuristics.js';
import { analyzeProjectLayout } from '../src/domain/layout-analysis.js';
import { scoreLayout } from '../src/domain/layout-score.js';

const projectOf = (id, change = object => object) => {
  const scene = buildTemplateScene(id);
  return { room: scene.room, objects: hydrateProjectObjects(scene.objects).map(change), connections: scene.connections };
};

test('the templates get no tips', () => {
  for (const { id } of DESK_TEMPLATES) assert.deepEqual(buildLayoutTips(projectOf(id)), [], id);
});

test('a screen off to one side gets a tip whose fix centres it, and then the tip is gone', () => {
  const project = projectOf('gaming', object => (object.modelId === 'ultrawide-monitor'
    ? { ...object, position: { ...object.position, x: 0.4 } }
    : object));
  const [tip, ...rest] = buildLayoutTips(project);
  assert.deepEqual(rest, []);
  assert.equal(tip.code, 'monitor_off_center');
  assert.equal(tip.title, '带鱼屏显示器挪到座位正前方');
  assert.equal(tip.description, '带鱼屏显示器偏离了座位正前方。');
  const { project: next } = applyLayoutTip(project, tip);
  assert.equal(next.objects.find(object => object.modelId === 'ultrawide-monitor').position.x, 0);
  assert.deepEqual(buildLayoutTips(next), []);
  assert.deepEqual(analyzeProjectLayout(next.room, next.objects).filter(issue => issue.severity !== 'info'), []);
});

test('a tower under the middle of the desk gets a tip that moves it beside the desk', () => {
  const project = projectOf('gaming', object => (object.modelId === 'desktop-pc'
    ? { ...object, position: { ...object.position, x: 0, y: 1.2 } }
    : object));
  const tip = buildLayoutTips(project).find(item => item.code === 'tower_blocks_legroom');
  assert.ok(tip, JSON.stringify(analyzeLayoutHeuristics(project.room, project.objects, project.connections).map(hint => hint.code)));
  assert.equal(tip.title, '台式主机挪出放腿的地方');
  const { project: next } = applyLayoutTip(project, tip);
  assert.equal(buildLayoutTips(next).some(item => item.code === 'tower_blocks_legroom'), false);
});

test('a cable that is only longer than needed is no tip: fixing it means buying another', () => {
  const scene = projectOf('gaming');
  const connections = scene.connections.map((connection, index) => (index === 0 ? { ...connection, length: 10 } : connection));
  const project = { ...scene, connections };
  assert.ok(analyzeLayoutHeuristics(project.room, project.objects, connections).some(hint => hint.code === 'cable_too_long'));
  assert.deepEqual(buildLayoutTips(project), []);
});

test('a tip that no longer helps is not applied', () => {
  const messy = projectOf('gaming', object => (object.modelId === 'ultrawide-monitor'
    ? { ...object, position: { ...object.position, x: 0.4 } }
    : object));
  const [tip] = buildLayoutTips(messy);
  const { project: fixed } = applyLayoutTip(messy, tip);
  const again = applyLayoutTip(fixed, tip);
  assert.equal(again.project, undefined);
  assert.ok(again.reasons.length > 0);
});

test('an empty desk and a project with no records have no tips', () => {
  assert.deepEqual(buildLayoutTips({ room: { length: 5, width: 4, height: 3 }, objects: [], connections: [] }), []);
  assert.deepEqual(buildLayoutTips({}), []);
});

test('every tip on an off-centre screen strictly improves the score', () => {
  const project = projectOf('gaming', object => (object.modelId === 'ultrawide-monitor'
    ? { ...object, position: { ...object.position, x: 0.4 } }
    : object));
  const before = scoreLayout(project);
  const tips = buildLayoutTips(project);
  assert.ok(tips.length > 0);
  for (const tip of tips) {
    const applied = applyLayoutTip(project, tip);
    assert.ok(applied.project, applied.reasons?.join());
    const after = scoreLayout(applied.project);
    assert.ok(after.total < before.total - 1e-9, `${tip.code} ${before.total} -> ${after.total}`);
    assert.ok(after.errors <= before.errors);
    assert.ok(after.warnings <= before.warnings);
  }
});

test('a tip with a blank title is not applied', () => {
  const project = projectOf('gaming');
  const applied = applyLayoutTip(project, { title: '  ', description: '', actions: [] });
  assert.equal(applied.project, undefined);
  assert.deepEqual(applied.reasons, ['说明不完整']);
});
