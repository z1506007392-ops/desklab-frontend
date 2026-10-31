import test from 'node:test';
import assert from 'node:assert/strict';

import { cameraZoomEnabled } from '../src/domain/view-controls.js';

test('the wheel and a pinch zoom the view even when a device is selected', () => {
  const viewing = { editable: true, connectionMode: false, dragging: false, gizmoDragging: false };
  assert.equal(cameraZoomEnabled(viewing), true);
  assert.equal(cameraZoomEnabled({ ...viewing, selected: true }), true);
});

test('zoom waits while connecting, dragging, or the project cannot be edited', () => {
  const viewing = { editable: true, connectionMode: false, dragging: false, gizmoDragging: false };
  assert.equal(cameraZoomEnabled({ ...viewing, connectionMode: true }), false);
  assert.equal(cameraZoomEnabled({ ...viewing, dragging: true }), false);
  assert.equal(cameraZoomEnabled({ ...viewing, gizmoDragging: true }), false);
  assert.equal(cameraZoomEnabled({ ...viewing, editable: false }), false);
});

test('a read-only share can still zoom the view', () => {
  assert.equal(cameraZoomEnabled({
    editable: false,
    viewOnly: true,
    connectionMode: false,
    dragging: false,
    gizmoDragging: false,
  }), true);
});
