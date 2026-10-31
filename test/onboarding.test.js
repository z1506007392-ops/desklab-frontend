import test from 'node:test';
import assert from 'node:assert/strict';

import { GUIDE_STEPS, hasSeenGuide, markGuideSeen } from '../src/domain/onboarding.js';

test('the first-run guide is five short steps in everyday words', () => {
  assert.equal(GUIDE_STEPS.length, 5);
  const text = GUIDE_STEPS.map(step => `${step.title} ${step.body}`).join('\n');
  assert.match(text, /模板/);
  assert.match(text, /控制柄/);
  assert.match(text, /连接/);
  assert.match(text, /改进建议/);
  assert.match(text, /保存/);
  assert.match(text, /导出备份/);
  assert.doesNotMatch(text, /modelId|fromPortId|desklab\./);
});

test('seeing the guide is remembered separately from the project save', () => {
  const saved = new Map();
  const storage = {
    getItem: key => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
  };
  assert.equal(hasSeenGuide(storage), false);
  assert.equal(markGuideSeen(storage), true);
  assert.equal(hasSeenGuide(storage), true);
  assert.equal(hasSeenGuide({ getItem: () => { throw new Error('blocked'); } }), false);
});
