import test from 'node:test';
import assert from 'node:assert/strict';

import { PerspectiveCamera } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  applyCameraPose,
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

test('the view starts from and resets to the first desk, from its seat side, however it is turned', () => {
  // The desk's top is 0.75 m up; the view stands back by its length plus
  // 1.4 m and 1.4 m above the top, looking at the middle of the top (E63).
  const target = { x: 0, y: 0.75, z: 0 };
  const back = 1.4 + 1.4;
  assert.deepEqual(defaultCameraPose(room, [deskTurned(0)]), { position: { x: 0, y: 2.15, z: -back }, target });
  assert.deepEqual(defaultCameraPose(room, [deskTurned(180)]), { position: { x: 0, y: 2.15, z: back }, target });
  // At 90° the seat is on the desk's +x side (its -y axis turned), at 270° on -x.
  assert.deepEqual(defaultCameraPose(room, [deskTurned(90)]), { position: { x: back, y: 2.15, z: 0 }, target });
  assert.deepEqual(defaultCameraPose(room, [deskTurned(270)]), { position: { x: -back, y: 2.15, z: 0 }, target });
  const turned = defaultCameraPose(room, [deskTurned(15)]).position;
  assert.ok(Math.abs(turned.x - back * Math.sin(Math.PI / 12)) < 1e-9 && Math.abs(turned.z + back * Math.cos(Math.PI / 12)) < 1e-9,
    'a little turned: straight from its seat');
  // Wherever the desk stands; a longer desk is seen from further back.
  const moved = { ...deskTurned(0), position: { x: 1, y: 1.2, z: 0.375 }, scale: { x: 1.8, y: 0.8, z: 0.75 } };
  assert.deepEqual(defaultCameraPose(room, [moved]), { position: { x: 1, y: 2.15, z: 1.2 - 3.2 }, target: { x: 1, y: 0.75, z: 1.2 } });
  // Other devices do not count; the first desk does.
  const screen = { id: 'screen', modelId: 'monitor-27', rotation: { z: 90 }, position: { x: 0, y: 0, z: 1 }, scale: { x: 0.6, y: 0.2, z: 0.4 } };
  assert.equal(defaultCameraPose(room, [screen, deskTurned(180), deskTurned(0)]).position.z, back);
});

test('with no desk the view is the whole room from high above its -y wall', () => {
  assert.deepEqual(defaultCameraPose(room, []), {
    position: { x: 0, y: room.height * 1.8, z: -room.width * 1.6 },
    target: { x: 0, y: room.height / 2, z: 0 },
  });
});

test('a generated desk opens on the same view that "重置视角" returns to', async () => {
  const { buildDeskScene } = await import('../src/domain/scene-builder.js');
  const scene = buildDeskScene({ devices: [{ modelId: 'desktop-pc', count: 1 }, { modelId: 'monitor-27', count: 1 }] });
  assert.deepEqual(defaultCameraPose(scene.room, scene.objects), scene.camera);
});

test('a project without a saved view opens on the desk from the seat side', () => {
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
  assert.deepEqual(vectorValues(controlsTarget), { x: 0, y: 0.75, z: 0 });
});

// E62 CI: "重置视角" right after a spin drifted 0.55 m sideways, because the
// orbit controls kept easing the spin on top of the new pose.
test('a pose set right after a spin stays put while the controls ease', () => {
  const pose = { position: { x: 0, y: 4.9, z: 5.6 }, target: { x: 0, y: 1.35, z: 0 } };
  const spunThenSet = apply => {
    const camera = new PerspectiveCamera();
    const controls = new OrbitControls(camera);
    controls.enableDamping = true;
    camera.position.set(3, 3, -5);
    controls.update();
    controls._rotateLeft(0.8); // what a quick drag leaves behind
    controls.update();
    apply(camera, controls);
    for (let frame = 0; frame < 120; frame += 1) controls.update();
    return { camera, controls };
  };

  const naive = spunThenSet((camera, controls) => {
    camera.position.set(pose.position.x, pose.position.y, pose.position.z);
    controls.target.set(pose.target.x, pose.target.y, pose.target.z);
    controls.update();
  });
  assert.ok(Math.abs(naive.camera.position.x) > 0.5, 'without clearing the spin the view drifts');

  const { camera, controls } = spunThenSet((cam, ctl) => applyCameraPose(cam, ctl, pose));
  for (const axis of ['x', 'y', 'z']) {
    assert.ok(Math.abs(camera.position[axis] - pose.position[axis]) < 1e-6, `position ${axis}`);
    assert.ok(Math.abs(controls.target[axis] - pose.target[axis]) < 1e-6, `target ${axis}`);
  }
  assert.equal(controls.enableDamping, true, 'easing stays on for the user\'s next drag');
});
