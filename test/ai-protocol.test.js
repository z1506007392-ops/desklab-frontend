import test from 'node:test';
import assert from 'node:assert/strict';

import { AI_LIMITS, sanitizeAction, sanitizeSuggestions } from '../src/domain/ai-protocol.js';

const move = { type: 'move', objectId: 'monitor-1', x: 0, y: 0.18 };

test('every allowed action keeps exactly its typed fields', () => {
  assert.deepEqual(sanitizeAction({ ...move, z: 0.9, extra: 'dropped' }), { ...move, z: 0.9 });
  assert.deepEqual(sanitizeAction(move), move, 'z is optional for move');
  assert.deepEqual(sanitizeAction({ type: 'rotate', objectId: 'a', rotationZ: 180 }), { type: 'rotate', objectId: 'a', rotationZ: 180 });
  assert.deepEqual(sanitizeAction({ type: 'swap', objectIdA: 'a', objectIdB: 'b' }), { type: 'swap', objectIdA: 'a', objectIdB: 'b' });
  assert.deepEqual(
    sanitizeAction({ type: 'connect', fromObjectId: 'pc', fromPortId: 'hdmi-out', toObjectId: 'm', toPortId: 'hdmi-in' }),
    { type: 'connect', fromObjectId: 'pc', fromPortId: 'hdmi-out', toObjectId: 'm', toPortId: 'hdmi-in' },
  );
  assert.deepEqual(sanitizeAction({ type: 'disconnect', connectionId: 'c1' }), { type: 'disconnect', connectionId: 'c1' });
  assert.deepEqual(sanitizeAction({ type: 'set_cable_length', connectionId: 'c1', length: 1.5 }), { type: 'set_cable_length', connectionId: 'c1', length: 1.5 });
});

test('unknown, destructive, or malformed actions are refused', () => {
  for (const raw of [
    { type: 'remove', objectId: 'desk' },
    { type: 'delete', objectId: 'desk' },
    { type: 'add', modelId: 'router' },
    { ...move, x: '0' },
    { ...move, y: Number.NaN },
    { ...move, objectId: '' },
    { ...move, objectId: 'x'.repeat(AI_LIMITS.maxIdChars + 1) },
    { type: 'move', x: 0, y: 0 },
    null, [], 'move',
  ]) {
    assert.equal(sanitizeAction(raw), null, JSON.stringify(raw));
  }
});

test('suggestions keep clean text, a known category, and only whole action lists', () => {
  const suggestions = sanitizeSuggestions({
    suggestions: [
      { id: 's1', title: '  显示器\n移到正前方 ', reason: '看屏幕不用歪头。', category: 'ergonomics', actions: [move], note: 'x' },
      { title: '没有理由', actions: [move] },
      { title: '坏动作', reason: '有一个动作不对。', actions: [move, { type: 'remove', objectId: 'desk' }] },
      { title: '没有动作', reason: '只是说说。', actions: [] },
      { title: '未知分类', reason: '分类不认识。', category: 'magic', actions: [move] },
    ],
  });
  assert.deepEqual(suggestions, [
    { id: 's1', title: '显示器 移到正前方', reason: '看屏幕不用歪头。', category: 'ergonomics', actions: [move] },
    { id: 's2', title: '未知分类', reason: '分类不认识。', category: 'space', actions: [move] },
  ]);
});

test('lengths and counts are capped', () => {
  const many = Array.from({ length: 9 }, (_, i) => ({
    title: '标'.repeat(100), reason: '因'.repeat(500), actions: Array.from({ length: 10 }, () => move), id: `id-${i}`,
  }));
  const suggestions = sanitizeSuggestions({ suggestions: many });
  assert.equal(suggestions.length, AI_LIMITS.maxSuggestions);
  assert.equal(suggestions[0].title.length, AI_LIMITS.maxTitleChars);
  assert.equal(suggestions[0].reason.length, AI_LIMITS.maxReasonChars);
  assert.equal(suggestions[0].actions.length, AI_LIMITS.maxActionsPerSuggestion);
  assert.deepEqual(sanitizeSuggestions(null), []);
  assert.deepEqual(sanitizeSuggestions({ suggestions: 'no' }), []);
});
