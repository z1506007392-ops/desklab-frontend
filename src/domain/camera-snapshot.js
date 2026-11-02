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

// How far the view stands back from a desk and above its top, in metres:
// back by the desk's length plus this, up by this.
const DESK_VIEW_MARGIN = 1.4;

/**
 * The view of a desk from its seat side: back from the middle of the desk by
 * its length plus 1.4 m, 1.4 m above its top, looking at the middle of the
 * top. Its screens face the viewer and left and right are the seat's, however
 * the desk is turned. A template or a generated desk opens on this view.
 * Camera poses use three.js axes: y is up and z is the room's y.
 */
export function deskCameraPose(desk) {
  const radians = ((desk.rotation?.z ?? 0) * Math.PI) / 180;
  // The seat is on the desk's own -y side.
  const seat = { x: Math.sin(radians), y: -Math.cos(radians) };
  const top = desk.position.z + desk.scale.z / 2;
  const back = desk.scale.x + DESK_VIEW_MARGIN;
  // Rounded so a quarter turn gives 0, not 6e-17 (or -0).
  const round = value => Math.round(value * 1e9) / 1e9 || 0;
  return {
    position: {
      x: round(desk.position.x + seat.x * back),
      y: round(top + DESK_VIEW_MARGIN),
      z: round(desk.position.y + seat.y * back),
    },
    target: { x: desk.position.x, y: top, z: desk.position.y },
  };
}

/**
 * The view the scene starts from (when no view was saved) and returns to
 * ("重置视角"): the first desk from its seat side, the way a template opens
 * (E63). With no desk, the whole room from high above its -y wall.
 */
export function defaultCameraPose(room, objects = []) {
  const desk = Array.isArray(objects) ? objects.find(isDesk) : null;
  if (desk) return deskCameraPose(desk);
  return {
    position: { x: 0, y: room.height * 1.8, z: -room.width * 1.6 },
    target: { x: 0, y: room.height / 2, z: 0 },
  };
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
