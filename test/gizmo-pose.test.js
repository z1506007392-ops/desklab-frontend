import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GIZMO_ROTATION_SNAP_RADIANS,
  deskPositionToThree,
  deskRotationToThreeY,
  gizmoAxisVisibility,
  gizmoHandleColor,
  threePositionToDesk,
  threeYToDeskRotation,
} from '../src/domain/gizmo-pose.js';

test('a desk position round-trips through three.js Y-up', () => {
  const desk = { x: 1.25, y: -0.4, z: 0.75 };
  assert.deepEqual(threePositionToDesk(deskPositionToThree(desk)), desk);
  assert.deepEqual(deskPositionToThree(desk), { x: 1.25, y: 0.75, z: -0.4 });
});

test('yaw round-trips and stays within a full turn', () => {
  for (const degrees of [0, 15, 90, 180, 270, 359]) {
    const back = threeYToDeskRotation(deskRotationToThreeY(degrees));
    assert.ok(Math.abs(back - degrees) < 1e-9, `${degrees} came back as ${back}`);
  }
  assert.equal(threeYToDeskRotation(deskRotationToThreeY(360)), 0);
  assert.equal(threeYToDeskRotation(deskRotationToThreeY(-15)), 345);
  assert.equal(threeYToDeskRotation(Number.NaN), 0);
});

test('rotate mode keeps only the vertical ring', () => {
  assert.deepEqual(gizmoAxisVisibility('translate'), { showX: true, showY: true, showZ: true });
  assert.deepEqual(gizmoAxisVisibility('rotate'), { showX: false, showY: true, showZ: false });
  assert.equal(GIZMO_ROTATION_SNAP_RADIANS, Math.PI / 12);
});

test('handle colors match the corner axes for the same desk direction', () => {
  assert.equal(gizmoHandleColor('X'), '#ff0000');
  assert.equal(gizmoHandleColor('Z'), '#00ff00');
  assert.equal(gizmoHandleColor('Y'), '#0000ff');
  assert.equal(gizmoHandleColor('E'), null);
});
