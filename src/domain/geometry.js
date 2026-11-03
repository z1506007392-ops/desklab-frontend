import { isDesk } from './desks.js';

export const GEOMETRY_EPSILON = 1e-5;

// The desk's bounding box fills the leg space. A strip or adapter hung just
// under the board, in the back half, is in that empty space: it is not
// inside the desktop, and it is not on the floor where a bare foot can kick it.
const UNDER_DESK_MODELS = new Set(['power-strip', 'power-adapter']);

function isUnderDeskDevice(object) {
  return UNDER_DESK_MODELS.has(object?.modelId)
    || object?.type === 'power_strip'
    || object?.type === 'power-adapter';
}

function deskLocalPoint(desk, point) {
  const radians = ((desk.rotation?.z ?? 0) * Math.PI) / 180;
  const dx = point.x - desk.position.x;
  const dy = point.y - desk.position.y;
  return {
    x: dx * Math.cos(radians) + dy * Math.sin(radians),
    y: -dx * Math.sin(radians) + dy * Math.cos(radians),
  };
}

// Centre height for a device hung just under the desktop board. The generic
// desk draws that board as the top 12% of the box.
export function underDeskHangZ(desk, object) {
  const deskTop = desk.position.z + desk.scale.z / 2;
  return deskTop - desk.scale.z * 0.12 - 0.015 - object.scale.z / 2;
}

export function hungUnderDeskPosition(desk, localX, localY, object) {
  const radians = ((desk.rotation?.z ?? 0) * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: desk.position.x + localX * cos - localY * sin,
    y: desk.position.y + localX * sin + localY * cos,
    z: underDeskHangZ(desk, object),
  };
}

export function isHungUnderDesk(object, desk) {
  if (!isDesk(desk) || !isUnderDeskDevice(object)) return false;
  const values = [object.position?.x, object.position?.y, object.position?.z, object.scale?.x, object.scale?.y, object.scale?.z,
    desk.position?.x, desk.position?.y, desk.position?.z, desk.scale?.x, desk.scale?.y, desk.scale?.z];
  if (!values.every(Number.isFinite)) return false;
  const top = object.position.z + object.scale.z / 2;
  const bottom = object.position.z - object.scale.z / 2;
  const deskTop = desk.position.z + desk.scale.z / 2;
  const gap = deskTop - top;
  if (gap < 0.005 || gap > 0.14) return false;
  if (bottom < 0.25) return false;
  const local = deskLocalPoint(desk, object.position);
  const { sizeX, sizeY } = getRotatedFootprint(object.scale, (object.rotation?.z ?? 0) - (desk.rotation?.z ?? 0));
  const inside = Math.abs(local.x) + sizeX / 2 <= desk.scale.x / 2 + 0.02
    && Math.abs(local.y) + sizeY / 2 <= desk.scale.y / 2 + 0.02;
  return inside && local.y > desk.scale.y * 0.08;
}

export function safeClamp(value, min, max) {
  if (min > max) return 0;
  return Math.max(min, Math.min(value, max));
}

export function getRotatedFootprint(scale, rotationZDegrees) {
  const rotation = Number.isFinite(rotationZDegrees) ? rotationZDegrees : 0;
  const radians = rotation * Math.PI / 180;
  const cosine = normalizeTrig(Math.abs(Math.cos(radians)));
  const sine = normalizeTrig(Math.abs(Math.sin(radians)));
  const scaleX = finitePositive(scale?.x, 1);
  const scaleY = finitePositive(scale?.y, 1);

  return {
    sizeX: finitePositive(scaleX * cosine + scaleY * sine, 1),
    sizeY: finitePositive(scaleX * sine + scaleY * cosine, 1),
  };
}

export function getObjectBounds(object) {
  const { sizeX, sizeY } = getRotatedFootprint(object?.scale, object?.rotation?.z);
  const sizeZ = finitePositive(object?.scale?.z, 1);
  const x = finiteNumber(object?.position?.x);
  const y = finiteNumber(object?.position?.y);
  const z = finiteNumber(object?.position?.z);
  if (x === null || y === null || z === null) return null;

  return {
    minX: x - sizeX / 2,
    maxX: x + sizeX / 2,
    minY: y - sizeY / 2,
    maxY: y + sizeY / 2,
    minZ: z - sizeZ / 2,
    maxZ: z + sizeZ / 2,
    sizeX,
    sizeY,
    sizeZ,
  };
}

export function boundsOverlap(first, second, epsilon = GEOMETRY_EPSILON) {
  if (!first || !second) return false;
  return first.minX < second.maxX - epsilon
    && first.maxX > second.minX + epsilon
    && first.minY < second.maxY - epsilon
    && first.maxY > second.minY + epsilon
    && first.minZ < second.maxZ - epsilon
    && first.maxZ > second.minZ + epsilon;
}

export function horizontalFootprintsOverlap(firstObject, secondObject, epsilon = GEOMETRY_EPSILON) {
  const first = getOrientedFootprint(firstObject);
  const second = getOrientedFootprint(secondObject);
  if (!first || !second) return false;

  const centerDelta = {
    x: second.center.x - first.center.x,
    y: second.center.y - first.center.y,
  };
  const axes = [first.axisX, first.axisY, second.axisX, second.axisY];

  return axes.every(axis => {
    const centerDistance = Math.abs(dot(centerDelta, axis));
    const firstRadius = projectionRadius(first, axis);
    const secondRadius = projectionRadius(second, axis);
    return centerDistance < firstRadius + secondRadius - epsilon;
  });
}

export function objectsOverlap(firstObject, secondObject, epsilon = GEOMETRY_EPSILON) {
  if (isHungUnderDesk(firstObject, secondObject) || isHungUnderDesk(secondObject, firstObject)) return false;
  const firstBounds = getObjectBounds(firstObject);
  const secondBounds = getObjectBounds(secondObject);
  if (!firstBounds || !secondBounds) return false;

  const verticallyOverlapping = firstBounds.minZ < secondBounds.maxZ - epsilon
    && firstBounds.maxZ > secondBounds.minZ + epsilon;
  return verticallyOverlapping
    && horizontalFootprintsOverlap(firstObject, secondObject, epsilon);
}

export function validateAndConstrainObject(proposedObject, room) {
  const scaleValues = [proposedObject.scale?.x, proposedObject.scale?.y, proposedObject.scale?.z];
  if (!scaleValues.every(value => Number.isFinite(value) && value > 0)) {
    return { valid: false, reason: '物体尺寸必须是大于 0 的数字', object: null };
  }

  const { sizeX, sizeY } = getRotatedFootprint(proposedObject.scale, proposedObject.rotation?.z);
  const sizeZ = finitePositive(proposedObject.scale?.z, 1);

  if (sizeX > room.length + GEOMETRY_EPSILON
    || sizeY > room.width + GEOMETRY_EPSILON
    || sizeZ > room.height + GEOMETRY_EPSILON) {
    return { valid: false, reason: '当前尺寸旋转/缩放后会超出房间', object: null };
  }

  const minX = -room.length / 2 + sizeX / 2;
  const maxX = room.length / 2 - sizeX / 2;
  const minY = -room.width / 2 + sizeY / 2;
  const maxY = room.width / 2 - sizeY / 2;
  const minZ = sizeZ / 2;
  const maxZ = room.height - sizeZ / 2;
  const x = safeClamp(proposedObject.position?.x, minX, maxX);
  const y = safeClamp(proposedObject.position?.y, minY, maxY);
  const z = safeClamp(proposedObject.position?.z, minZ, maxZ);

  if (![x, y, z].every(Number.isFinite)) {
    return { valid: false, reason: '位置数值无效', object: null };
  }

  return {
    valid: true,
    object: {
      ...proposedObject,
      position: { ...proposedObject.position, x, y, z },
      scale: { ...proposedObject.scale },
      rotation: { ...proposedObject.rotation },
    },
  };
}

export function constrainProjectToRoom(proposedRoom, objects) {
  for (const dimension of ['length', 'width', 'height']) {
    if (!Number.isFinite(proposedRoom?.[dimension]) || proposedRoom[dimension] <= 0) {
      return {
        valid: false,
        reason: `房间${dimension === 'length' ? '长度' : dimension === 'width' ? '宽度' : '高度'}必须是大于 0 的数字`,
        room: null,
        objects: null,
      };
    }
  }

  const constrainedObjects = [];
  for (const object of objects) {
    const constrained = validateAndConstrainObject(object, proposedRoom);
    if (!constrained.valid) {
      return {
        valid: false,
        reason: `${object.name || object.id || '设备'}无法放入新房间：${constrained.reason}`,
        room: null,
        objects: null,
      };
    }
    constrainedObjects.push(constrained.object);
  }

  return {
    valid: true,
    reason: '',
    room: { ...proposedRoom },
    objects: constrainedObjects,
  };
}

function normalizeTrig(value) {
  if (Math.abs(value) < 1e-10) return 0;
  if (Math.abs(value - 1) < 1e-10) return 1;
  return value;
}

function getOrientedFootprint(object) {
  const x = finiteNumber(object?.position?.x);
  const y = finiteNumber(object?.position?.y);
  const scaleX = object?.scale?.x;
  const scaleY = object?.scale?.y;
  if (x === null || y === null
    || !Number.isFinite(scaleX) || scaleX <= 0
    || !Number.isFinite(scaleY) || scaleY <= 0) {
    return null;
  }

  const rotation = Number.isFinite(object?.rotation?.z) ? object.rotation.z : 0;
  const radians = rotation * Math.PI / 180;
  const cosine = normalizeTrig(Math.cos(radians));
  const sine = normalizeTrig(Math.sin(radians));
  return {
    center: { x, y },
    halfX: scaleX / 2,
    halfY: scaleY / 2,
    axisX: { x: cosine, y: sine },
    axisY: { x: -sine, y: cosine },
  };
}

function projectionRadius(footprint, axis) {
  return footprint.halfX * Math.abs(dot(footprint.axisX, axis))
    + footprint.halfY * Math.abs(dot(footprint.axisY, axis));
}

function dot(first, second) {
  return first.x * second.x + first.y * second.y;
}

function finitePositive(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function finiteNumber(value) {
  return Number.isFinite(value) ? value : null;
}
