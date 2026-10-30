import test from 'node:test';
import assert from 'node:assert/strict';

import { describeKeyTarget, getObjectKeyboardUpdate, shouldIgnoreDeviceShortcut } from '../src/domain/keyboard-controls.js';

const object = {
  position: { x: 1, y: 2, z: 3 },
  rotation: { x: 0, y: 0, z: 45 },
};

test('modifier shortcuts never move or rotate the selected object', () => {
  assert.equal(getObjectKeyboardUpdate(object, {
    key: 'Control',
    code: 'ControlLeft',
    ctrlKey: true,
  }), null);
  assert.equal(getObjectKeyboardUpdate(object, {
    key: 'z',
    code: 'KeyZ',
    ctrlKey: true,
  }), null);
});

test('Space and Shift+Space move vertically in opposite directions', () => {
  assert.deepEqual(getObjectKeyboardUpdate(object, {
    key: ' ',
    code: 'Space',
    shiftKey: false,
  }), { position: { x: 1, y: 2, z: 3.1 } });
  assert.deepEqual(getObjectKeyboardUpdate(object, {
    key: ' ',
    code: 'Space',
    shiftKey: true,
  }), { position: { x: 1, y: 2, z: 2.9 } });
});

test('direction and rotation shortcuts keep their existing behavior', () => {
  assert.deepEqual(getObjectKeyboardUpdate(object, {
    key: 'ArrowLeft',
    code: 'ArrowLeft',
  }), { position: { x: 1.1, y: 2, z: 3 } });
  assert.deepEqual(getObjectKeyboardUpdate(object, {
    key: 'e',
    code: 'KeyE',
  }), { rotation: { z: 30 } });
});

test('device shortcuts stay out of text fields, dialogs and button presses', () => {
  const arrow = { key: 'ArrowRight', code: 'ArrowRight' };
  const space = { key: ' ', code: 'Space' };
  const enter = { key: 'Enter', code: 'Enter' };

  assert.equal(shouldIgnoreDeviceShortcut(arrow, {}), false, 'canvas or page: the device moves');
  assert.equal(shouldIgnoreDeviceShortcut(space, {}), false, 'Space on the page still lifts the device');
  assert.equal(shouldIgnoreDeviceShortcut(arrow, { pressable: true }), false, 'arrows after clicking a toolbar button still move it');
  assert.equal(shouldIgnoreDeviceShortcut(space, { pressable: true }), true, 'Space presses the focused button');
  assert.equal(shouldIgnoreDeviceShortcut(enter, { pressable: true }), true, 'Enter presses the focused button');
  assert.equal(shouldIgnoreDeviceShortcut(arrow, { typing: true }), true);
  assert.equal(shouldIgnoreDeviceShortcut(arrow, { inOverlay: true }), true, 'inside a dialog or menu');
  assert.equal(shouldIgnoreDeviceShortcut({ key: 'Delete', code: 'Delete' }, {}, { dialogOpen: true }), true, 'a dialog is open');
});

test('key targets are described from the element and its ancestors', () => {
  const element = matches => ({ closest: selector => (selector.split(', ').some(part => matches.includes(part)) ? {} : null) });
  assert.deepEqual(describeKeyTarget(null), {});
  assert.deepEqual(describeKeyTarget(element(['input'])), { typing: true, inOverlay: false, pressable: false });
  assert.deepEqual(describeKeyTarget(element(['button', '[role="dialog"]'])), { typing: false, inOverlay: true, pressable: true });
});

