import test from 'node:test';
import assert from 'node:assert/strict';

import {
  captureCameraSnapshot,
  createCameraPoseSynchronizer,
  defaultCameraPose,
} from '../src/domain/camera-snapshot.js';

test('preserves the loaded camera when live canvas controls are unavailable', () => {
  const fallback = {
    position: { x: 1, y: 5, z: -6 },
    target: { x: 0, y: 1.5, z: 0 },
  };

  const snapshot = captureCameraSnapshot(null, null, fallback);
  assert.deepEqual(snapshot, fallback);
  assert.notEqual(snapshot, fallback);
  assert.notEqual(snapshot.position, fallback.position);
  assert.notEqual(snapshot.target, fallback.target);
});

test('prefers finite live camera values over the loaded fallback', () => {
  const snapshot = captureCameraSnapshot(
    { position: { x: 2, y: 6, z: -7 } },
    { target: { x: 1, y: 2, z: 3 } },
    {
      position: { x: 0, y: 5, z: -6 },
      target: { x: 0, y: 1.5, z: 0 },
    }
  );

  assert.deepEqual(snapshot, {
    position: { x: 2, y: 6, z: -7 },
    target: { x: 1, y: 2, z: 3 },
  });
});

test('room changes do not overwrite a camera pose the user has moved', () => {
  const cameraPosition = createMutableVector();
  const controlsTarget = createMutableVector();
  const camera = { position: cameraPosition };
  const controls = { target: controlsTarget, update() {} };
  const loadedCamera = {
    position: { x: 1, y: 5, z: -6 },
    target: { x: 0, y: 1.5, z: 0 },
  };
  const synchronizer = createCameraPoseSynchronizer();

  synchronizer.sync({
    cameraConfig: loadedCamera,
    room: { length: 5, width: 4, height: 3 },
    camera,
    controls,
  });
  cameraPosition.set(8, 7, -9);
  controlsTarget.set(2, 1, 3);

  synchronizer.sync({
    cameraConfig: loadedCamera,
    room: { length: 8, width: 6, height: 4 },
    camera,
    controls,
  });

  assert.deepEqual(vectorValues(cameraPosition), { x: 8, y: 7, z: -9 });
  assert.deepEqual(vectorValues(controlsTarget), { x: 2, y: 1, z: 3 });
});

const vectorValues = vector => ({ x: vector.x, y: vector.y, z: vector.z });

function createMutableVector() {
  return {
    x: 0,
    y: 0,
    z: 0,
    set(x, y, z) {
      this.x = x;
      this.y = y;
      this.z = z;
    },
  };
}

const room = { length: 4, width: 3.5, height: 2.7 };
const deskTurned = z => ({ id: 'desk', modelId: 'office-desk', type: 'office-desk', position: { x: 0, y: 0, z: 0.375 }, rotation: { x: 0, y: 0, z }, scale: { x: 1.4, y: 0.7, z: 0.75 } });

test('the overview looks from behind the seat of the first desk, to the nearest wall', () => {
  const height = room.height * 1.8;
  const target = { x: 0, y: room.height / 2, z: 0 };
  const fromMinusY = { position: { x: 0, y: height, z: -room.width * 1.6 }, target };
  assert.deepEqual(defaultCameraPose(room, []), fromMinusY, 'no desk: as before');
  assert.deepEqual(defaultCameraPose(room, [deskTurned(0)]), fromMinusY, 'unturned desk: as before');
  assert.deepEqual(defaultCameraPose(room, [deskTurned(15)]), fromMinusY, 'a little turned: same wall');
  assert.deepEqual(defaultCameraPose(room, [deskTurned(180)]), { position: { x: 0, y: height, z: room.width * 1.6 }, target });
  // At 90° the seat is on the desk's +x side (its -y axis turned), at 270° on -x.
  assert.deepEqual(defaultCameraPose(room, [deskTurned(90)]), { position: { x: room.length * 1.6, y: height, z: 0 }, target });
  assert.deepEqual(defaultCameraPose(room, [deskTurned(270)]), { position: { x: -room.length * 1.6, y: height, z: 0 }, target });
  // Other devices do not count; the first desk does.
  const screen = { id: 'screen', modelId: 'monitor-27', rotation: { z: 90 }, position: { x: 0, y: 0, z: 1 }, scale: { x: 0.6, y: 0.2, z: 0.4 } };
  assert.deepEqual(defaultCameraPose(room, [screen, deskTurned(180), deskTurned(0)]).position.z, room.width * 1.6);
});

test('a project without a saved view opens on the overview from the seat side', () => {
  const cameraPosition = createMutableVector();
  const controlsTarget = createMutableVector();
  const synchronizer = createCameraPoseSynchronizer();
  synchronizer.sync({
    cameraConfig: null,
    room,
    objects: [deskTurned(180)],
    camera: { position: cameraPosition },
    controls: { target: controlsTarget, update() {} },
  });
  assert.deepEqual(vectorValues(cameraPosition), defaultCameraPose(room, [deskTurned(180)]).position);
  assert.deepEqual(vectorValues(controlsTarget), { x: 0, y: room.height / 2, z: 0 });
});
