import { isDesk } from './desks.js';

export function captureCameraSnapshot(camera, controls, fallback = null) {
  const live = camera && controls
    ? {
        position: {
          x: camera.position?.x,
          y: camera.position?.y,
          z: camera.position?.z,
        },
        target: {
          x: controls.target?.x,
          y: controls.target?.y,
          z: controls.target?.z,
        },
      }
    : null;

  if (isValidCamera(live)) return live;
  return isValidCamera(fallback) ? cloneCamera(fallback) : null;
}

/**
 * The overview the view starts from and returns to ("重置视角"): the whole
 * room from high above the wall behind the seat of the first desk, so its
 * screens face the viewer and left and right are the seat's, whichever way
 * the desk is turned (to the nearest wall). With no desk, or an unturned
 * one, that is the -y wall. Camera poses use three.js axes: y is up and z
 * is the room's y.
 */
export function defaultCameraPose(room, objects = []) {
  const desk = Array.isArray(objects) ? objects.find(isDesk) : null;
  const radians = ((desk?.rotation?.z ?? 0) * Math.PI) / 180;
  // The seat is on the desk's own -y side.
  const seat = { x: Math.sin(radians), y: -Math.cos(radians) };
  const height = room.height * 1.8;
  const target = { x: 0, y: room.height / 2, z: 0 };
  if (Math.abs(seat.x) > Math.abs(seat.y) + 1e-9) {
    return { position: { x: Math.sign(seat.x) * room.length * 1.6, y: height, z: 0 }, target };
  }
  return { position: { x: 0, y: height, z: (seat.y > 0 ? 1 : -1) * room.width * 1.6 }, target };
}

/**
 * Puts the camera at `pose` with nothing left over from an earlier drag. The
 * orbit controls keep easing the last spin or pan for a while (damping); set
 * on top of that, a reset would drift off its pose. Without damping one
 * update spends whatever is left and clears it, so that comes first.
 */
export function applyCameraPose(camera, controls, pose) {
  const damping = controls.enableDamping;
  controls.enableDamping = false;
  controls.update();
  camera.position.set(pose.position.x, pose.position.y, pose.position.z);
  controls.target.set(pose.target.x, pose.target.y, pose.target.z);
  controls.update();
  controls.enableDamping = damping;
}

export function createCameraPoseSynchronizer() {
  let lastCameraConfig = Symbol('unapplied-camera-config');
  let lastCamera = null;
  let lastControls = null;

  return {
    sync({ cameraConfig, room, objects, camera, controls }) {
      if (cameraConfig === undefined || !camera || !controls) return false;
      if (cameraConfig === lastCameraConfig
        && camera === lastCamera
        && controls === lastControls) {
        return false;
      }
      applyCameraPose(camera, controls, cameraConfig || defaultCameraPose(room, objects));
      lastCameraConfig = cameraConfig;
      lastCamera = camera;
      lastControls = controls;
      return true;
    },
  };
}

function isValidCamera(camera) {
  return isFiniteVector(camera?.position) && isFiniteVector(camera?.target);
}

function isFiniteVector(vector) {
  return vector && ['x', 'y', 'z'].every(axis => Number.isFinite(vector[axis]));
}

function cloneCamera(camera) {
  return {
    position: { ...camera.position },
    target: { ...camera.target },
  };
}
