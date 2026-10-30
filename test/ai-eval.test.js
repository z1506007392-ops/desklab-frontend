import test from 'node:test';
import assert from 'node:assert/strict';

import { buildEvalScenes, runEval, summarize } from '../tools/ai-eval/lib.mjs';
import { createLayoutHandler } from '../server/ai/layout-handler.js';
import { createMockFetch } from '../server/ai/mock-model.js';
import { scoreLayout } from '../src/domain/layout-score.js';
import { isProjectEnvelope } from '../src/domain/project-validation.js';

test('the evaluation set has at least 15 scenes and each kind is what it claims', () => {
  const scenes = buildEvalScenes();
  assert.ok(scenes.length >= 15, `${scenes.length} scenes`);
  assert.equal(new Set(scenes.map(scene => scene.id)).size, scenes.length, 'ids are unique');
  for (const scene of scenes) {
    assert.ok(isProjectEnvelope(scene.project), scene.id);
    const score = scoreLayout(scene.project);
    if (scene.kind === 'good') assert.equal(score.hints + score.warnings + score.errors, 0, `${scene.id} should be a good desk`);
    if (scene.kind === 'messy') assert.ok(score.hints + score.warnings > 0, `${scene.id} should have something to fix`);
    assert.ok(scene.goals.length >= 1);
  }
  assert.ok(scenes.filter(scene => scene.kind === 'messy').length >= 9);
});

test('a run through the mock model produces sound metrics', async () => {
  const handler = createLayoutHandler({ fetchImpl: createMockFetch({ delayMs: 0 }), logger: { log() {} } });
  const post = async body => {
    const response = await handler({
      request: new Request('https://desklab.test/api/ai/layout', { method: 'POST', body: JSON.stringify(body) }),
      env: { DEEPSEEK_API_KEY: 'mock' },
    });
    return { status: response.status, json: await response.json() };
  };
  const results = await runEval({ post });
  const { metrics, checks } = summarize(results);
  assert.equal(metrics.parseRate, 1);
  assert.equal(metrics.newErrors, 0, 'validation never lets a suggestion add errors');
  assert.equal(metrics.jargonRate, 0);
  assert.ok(metrics.acceptedSuggestions > 0, 'the mock fixes at least the off-centre monitors');
  assert.ok(metrics.averageImprovement > 0);
  assert.equal(checks.parseRate, true);
  // The mock only knows two tricks, so it is not expected to reach 80%.
  assert.ok(metrics.messyHelpedRate > 0 && metrics.messyHelpedRate < 1);
});
