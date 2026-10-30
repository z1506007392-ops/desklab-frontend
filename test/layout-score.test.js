import test from 'node:test';
import assert from 'node:assert/strict';

import { buildTemplateScene } from '../src/domain/desk-templates.js';
import { SCORE_WEIGHTS, scoreLayout } from '../src/domain/layout-score.js';

const gaming = () => buildTemplateScene('gaming');
const withObject = (project, modelId, change) => ({
  ...project,
  objects: project.objects.map(object => (object.modelId === modelId ? change(structuredClone(object)) : object)),
});

test('a template scores only its cable length', () => {
  const project = gaming();
  const score = scoreLayout(project);
  assert.deepEqual([score.errors, score.warnings, score.hints], [0, 0, 0]);
  const cable = project.connections.reduce((sum, c) => sum + c.length, 0);
  assert.equal(score.cableMeters, Math.round(cable * 100) / 100);
  assert.equal(score.total, score.cableMeters);
});

test('real problems outweigh hints, and hints outweigh cable length', () => {
  const base = scoreLayout(gaming());
  const offCentre = scoreLayout(withObject(gaming(), 'ultrawide-monitor', m => { m.position.x += 0.4; return m; }));
  assert.deepEqual(offCentre.codes.hints, ['monitor_off_center']);
  assert.equal(offCentre.total, base.total + SCORE_WEIGHTS.hint);

  const floating = scoreLayout(withObject(gaming(), 'router', r => { r.position.z = 1.2; return r; }));
  assert.ok(floating.codes.warnings.includes('floating_object'));
  assert.ok(floating.total >= base.total + SCORE_WEIGHTS.warning);

  const outside = scoreLayout(withObject(gaming(), 'router', r => { r.position.x = 9; return r; }));
  assert.ok(outside.codes.errors.includes('out_of_bounds'));
  assert.ok(outside.total > floating.total);
});

test('a power line that is simply not drawn costs nothing', () => {
  const project = gaming();
  const withoutPower = { ...project, connections: project.connections.filter(c => c.cableType !== 'power') };
  const score = scoreLayout(withoutPower);
  assert.deepEqual([score.errors, score.warnings, score.hints], [0, 0, 0]);
});

test('scoring is stable and tolerates partial projects', () => {
  const project = gaming();
  assert.deepEqual(scoreLayout(project), scoreLayout(structuredClone(project)));
  assert.deepEqual(scoreLayout({}), { total: 0, errors: 0, warnings: 0, hints: 0, cableMeters: 0, codes: { errors: [], warnings: [], hints: [] } });
});
