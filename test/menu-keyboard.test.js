import test from 'node:test';
import assert from 'node:assert/strict';

import { menuClosesOnKey, nextMenuIndex } from '../src/domain/menu-keyboard.js';

test('arrow keys walk the more menu and wrap, Home and End jump', () => {
  assert.equal(nextMenuIndex({ key: 'ArrowDown', index: -1, count: 3 }), 0);
  assert.equal(nextMenuIndex({ key: 'ArrowDown', index: 0, count: 3 }), 1);
  assert.equal(nextMenuIndex({ key: 'ArrowDown', index: 2, count: 3 }), 0);
  assert.equal(nextMenuIndex({ key: 'ArrowUp', index: -1, count: 3 }), 2);
  assert.equal(nextMenuIndex({ key: 'ArrowUp', index: 0, count: 3 }), 2);
  assert.equal(nextMenuIndex({ key: 'ArrowUp', index: 2, count: 3 }), 1);
  assert.equal(nextMenuIndex({ key: 'Home', index: 2, count: 3 }), 0);
  assert.equal(nextMenuIndex({ key: 'End', index: 0, count: 3 }), 2);
  assert.equal(nextMenuIndex({ key: 'Enter', index: 0, count: 3 }), null);
  assert.equal(nextMenuIndex({ key: 'ArrowDown', index: 0, count: 0 }), null);
});

test('Escape and Tab leave the more menu, arrows do not', () => {
  assert.equal(menuClosesOnKey('Escape'), true);
  assert.equal(menuClosesOnKey('Tab'), true);
  assert.equal(menuClosesOnKey('ArrowDown'), false);
});
