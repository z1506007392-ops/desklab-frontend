import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import { evaluateSuggestions, parseAiResponse } from '../src/domain/ai-actions.js';
import { buildEvalScenes } from '../tools/ai-eval/lib.mjs';

// Real DeepSeek answers recorded during the first evaluation (2026-10-30).
// Replaying them catches changes to validation or scoring that would start
// showing a suggestion the rules rejected before, or hide one they accepted.
const dir = new URL('./fixtures/ai/recorded/', import.meta.url);
const scenes = new Map(buildEvalScenes().map(scene => [scene.id, scene]));

for (const file of readdirSync(dir).filter(name => name.endsWith('.json'))) {
  test(`recorded answer ${file} validates as it did when recorded`, () => {
    const recorded = JSON.parse(readFileSync(new URL(file, dir), 'utf8'));
    const scene = scenes.get(recorded.scene);
    assert.ok(scene, `scene ${recorded.scene} still exists`);
    const accepted = evaluateSuggestions(scene.project, parseAiResponse(recorded.response));
    assert.equal(accepted.length, recorded.acceptedCount);
    for (const result of accepted) {
      assert.ok(result.scoreAfter.total < result.scoreBefore.total);
      assert.ok(result.scoreAfter.errors <= result.scoreBefore.errors);
      assert.ok(result.scoreAfter.warnings <= result.scoreBefore.warnings);
    }
  });
}
