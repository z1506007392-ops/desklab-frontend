import test from 'node:test';
import assert from 'node:assert/strict';

import { defaultCameraPose } from '../src/domain/camera-snapshot.js';
import { roomWallsFacingCamera } from '../src/domain/room-shell.js';

const room = { length: 5, width: 4, height: 3 };

test('the default empty-room camera leaves the near wall open and keeps the other three', () => {
  const pose = defaultCameraPose(room, []);
  const walls = roomWallsFacingCamera(room, pose.position);
  assert.equal(walls.minZ, false, 'near wall, the one in front of the camera');
  assert.equal(walls.maxZ, true, 'far wall');
  assert.equal(walls.minX, true);
  assert.equal(walls.maxX, true);
});

test('a wall the camera has walked outside of drops out so it cannot block the view', () => {
  assert.deepEqual(roomWallsFacingCamera(room, { x: -4, y: 2, z: -4 }), {
    minX: false,
    maxX: true,
    minZ: false,
    maxZ: true,
  });
  assert.deepEqual(roomWallsFacingCamera(room, { x: 0, y: 1.2, z: 0 }), {
    minX: true,
    maxX: true,
    minZ: true,
    maxZ: true,
  });
});
