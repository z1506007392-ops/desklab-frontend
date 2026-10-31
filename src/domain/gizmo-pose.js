// DeskLab stores position as { x: left-right, y: depth, z: height } and yaw in
// degrees around the vertical axis. three.js is Y-up, so the vertical axis is
// three's Y and depth is three's Z. The gizmo speaks three.js; these convert
// one pose both ways so a handle drag can go through the same update as a
// pointer drag.

export function deskPositionToThree(position = {}) {
  return {
    x: Number(position.x) || 0,
    y: Number(position.z) || 0,
    z: Number(position.y) || 0,
  };
}

export function threePositionToDesk(position = {}) {
  return {
    x: Number(position.x) || 0,
    y: Number(position.z) || 0,
    z: Number(position.y) || 0,
  };
}

export function deskRotationToThreeY(rotationZDegrees = 0) {
  const degrees = Number.isFinite(rotationZDegrees) ? rotationZDegrees : 0;
  return -degrees * Math.PI / 180;
}

export function threeYToDeskRotation(radians) {
  if (!Number.isFinite(radians)) return 0;
  const degrees = -radians * 180 / Math.PI;
  return ((degrees % 360) + 360) % 360;
}

// Rotate mode only offers the vertical ring: the project stores yaw, not tilt.
export function gizmoAxisVisibility(mode) {
  if (mode === 'rotate') return { showX: false, showY: true, showZ: false };
  return { showX: true, showY: true, showZ: true };
}

// Corner axes are X red (left-right), Y green (depth), Z blue (up). three.js
// calls up Y and depth Z, so those two handles swap color to match the corner.
export function gizmoHandleColor(handleName) {
  switch (handleName) {
    case 'X': return '#ff0000';
    case 'Y': return '#0000ff';
    case 'Z': return '#00ff00';
    case 'XY': return '#ff00ff';
    case 'YZ': return '#00ffff';
    case 'XZ': return '#ffff00';
    default: return null;
  }
}

export const GIZMO_ROTATION_SNAP_RADIANS = Math.PI / 12;
