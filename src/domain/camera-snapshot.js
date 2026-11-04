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

// Same vertical field of view as the default react-three-fiber camera.
const EMPTY_ROOM_FOV = 75;
// Keep the room inside this fraction of the frame so the walls are not cut off.
const EMPTY_ROOM_FRAME = 0.86;

/**
 * The view the scene starts from (when no view was saved) and returns to
 * ("重置视角"): the first desk from its seat side, the way a template opens
 * (E63). With no desk, the whole room from high above its -y wall. Pass the
 * canvas aspect (width / height) to stand far enough back that the room fits
 * that frame; without it, the historical distance is kept.
 */
export function defaultCameraPose(room, objects = [], aspect = null) {
  const desk = Array.isArray(objects) ? objects.find(isDesk) : null;
  if (desk) return deskCameraPose(desk);
  if (Number.isFinite(aspect) && aspect > 0) return emptyRoomViewPose(room, aspect);
  return emptyRoomDirection(room);
}

// Head-on from outside the -y wall (three.js -z), the view an empty room
// has always opened on. Distance is the old one: high by 1.8 × height,
// back by 1.6 × width.
function emptyRoomDirection(room) {
  return {
    position: { x: 0, y: room.height * 1.8, z: -room.width * 1.6 },
    target: { x: 0, y: room.height / 2, z: 0 },
  };
}

/**
 * The empty-room view, pulled back along the same ray until every corner of
 * the room sits inside the frame. Never closer than the historical view, so
 * a wide desktop stays where it was and a narrow phone steps back.
 */
export function emptyRoomViewPose(room, aspect, fovDegrees = EMPTY_ROOM_FOV) {
  const base = emptyRoomDirection(room);
  const target = base.target;
  const offset = {
    x: base.position.x - target.x,
    y: base.position.y - target.y,
    z: base.position.z - target.z,
  };
  const historical = Math.hypot(offset.x, offset.y, offset.z) || 1;
  const direction = {
    x: offset.x / historical,
    y: offset.y / historical,
    z: offset.z / historical,
  };
  const distance = Math.max(historical, distanceToFrameRoom(room, target, direction, aspect, fovDegrees));
  const round = value => Math.round(value * 1e6) / 1e6 || 0;
  return {
    position: {
      x: round(target.x + direction.x * distance),
      y: round(target.y + direction.y * distance),
      z: round(target.z + direction.z * distance),
    },
    target: { x: round(target.x), y: round(target.y), z: round(target.z) },
  };
}

function distanceToFrameRoom(room, target, backward, aspect, fovDegrees) {
  const vertical = (fovDegrees * Math.PI) / 180 / 2;
  const tanV = Math.tan(vertical);
  const tanH = tanV * Math.max(aspect, 0.2);
  const corners = roomCorners(room);
  const maxNdc = distance => {
    const eye = {
      x: target.x + backward.x * distance,
      y: target.y + backward.y * distance,
      z: target.z + backward.z * distance,
    };
    // three.js lookAt: z axis points from the target back to the eye.
    const right = normalize(cross({ x: 0, y: 1, z: 0 }, backward));
    const up = normalize(cross(backward, right));
    let max = 0;
    for (const corner of corners) {
      const delta = { x: corner.x - eye.x, y: corner.y - eye.y, z: corner.z - eye.z };
      const depth = -(delta.x * backward.x + delta.y * backward.y + delta.z * backward.z);
      if (depth <= 0.05) return Infinity;
      const ndcX = (delta.x * right.x + delta.y * right.y + delta.z * right.z) / (depth * tanH);
      const ndcY = (delta.x * up.x + delta.y * up.y + delta.z * up.z) / (depth * tanV);
      max = Math.max(max, Math.abs(ndcX), Math.abs(ndcY));
    }
    return max;
  };

  let low = 0.25;
  let high = Math.max(room.length, room.width, room.height, 1) * 16;
  if (maxNdc(high) > EMPTY_ROOM_FRAME) return high;
  for (let step = 0; step < 28; step += 1) {
    const mid = (low + high) / 2;
    if (maxNdc(mid) <= EMPTY_ROOM_FRAME) high = mid;
    else low = mid;
  }
  return high;
}

function roomCorners(room) {
  const corners = [];
  for (const x of [-room.length / 2, room.length / 2]) {
    for (const y of [0, room.height]) {
      for (const z of [-room.width / 2, room.width / 2]) corners.push({ x, y, z });
    }
  }
  return corners;
}

function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function normalize(vector) {
  const length = Math.hypot(vector.x, vector.y, vector.z) || 1;
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
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
