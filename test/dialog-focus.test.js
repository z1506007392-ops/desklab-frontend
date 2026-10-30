import test from 'node:test';
import assert from 'node:assert/strict';

import { dialogTabTarget } from '../src/components/useDialogFocus.js';

test('Tab stays inside a dialog, including when focus is still on the dialog itself', () => {
  assert.equal(dialogTabTarget({
    shiftKey: false, activeIsDialog: true, activeIsFirst: false, activeIsLast: false, inside: true,
  }), 'first');
  assert.equal(dialogTabTarget({
    shiftKey: true, activeIsDialog: true, activeIsFirst: false, activeIsLast: false, inside: true,
  }), 'last');
  assert.equal(dialogTabTarget({
    shiftKey: false, activeIsDialog: false, activeIsFirst: false, activeIsLast: true, inside: true,
  }), 'first');
  assert.equal(dialogTabTarget({
    shiftKey: true, activeIsDialog: false, activeIsFirst: true, activeIsLast: false, inside: true,
  }), 'last');
  assert.equal(dialogTabTarget({
    shiftKey: false, activeIsDialog: false, activeIsFirst: true, activeIsLast: false, inside: true,
  }), null);
  assert.equal(dialogTabTarget({
    shiftKey: false, activeIsDialog: false, activeIsFirst: false, activeIsLast: false, inside: false,
  }), 'first');
});
