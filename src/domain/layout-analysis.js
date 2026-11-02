import {
  GEOMETRY_EPSILON,
  getObjectBounds,
  getRotatedFootprint,
  horizontalFootprintsOverlap,
  objectsOverlap,
  safeClamp,
  validateAndConstrainObject,
} from './geometry.js';
import { isDesk } from './desks.js';
import { getRecordItems } from './record-collections.js';

const isWallOutlet = (object) => object.modelId === 'wall-outlet' || object.type === 'outlet';

function touchesRoomWall(bounds, room, tolerance = 0.03) {
  return Math.abs(bounds.minX + room.length / 2) <= tolerance
    || Math.abs(bounds.maxX - room.length / 2) <= tolerance
    || Math.abs(bounds.minY + room.width / 2) <= tolerance
    || Math.abs(bounds.maxY - room.width / 2) <= tolerance;
}

export function snapObjectToSupport(room, object, objects) {
  if (isWallOutlet(object)) return null;
  const bounds = getObjectBounds(object);
  if (!bounds) return null;

  const supportTops = objects
    .filter(candidate => candidate.id !== object.id)
    .map(candidate => ({ candidate, bounds: getObjectBounds(candidate) }))
    .filter(entry => entry.bounds
      && horizontalFootprintsOverlap(object, entry.candidate)
      && entry.bounds.maxZ < bounds.maxZ + GEOMETRY_EPSILON)
    .map(entry => entry.bounds.maxZ)
    .sort((first, second) => second - first);

  for (const supportTop of [...supportTops, 0]) {
    const proposedZ = supportTop + bounds.sizeZ / 2;
    const constrained = validateAndConstrainObject({
      ...object,
      position: { ...object.position, z: proposedZ },
    }, room);
    if (constrained.valid
      && Math.abs(constrained.object.position.z - proposedZ) <= GEOMETRY_EPSILON) {
      return constrained.object;
    }
  }

  return null;
}

/**
 * After a drag that moved `object` away from `startPosition`, the object in
 * its new place if it would otherwise hang in the air: dropped onto the
 * highest surface below it, or the floor (snapObjectToSupport). Null when it
 * did not move, still rests on something, is a wall outlet, or cannot drop.
 * The drag already recorded the undo step, so callers apply this without a
 * new one.
 */
// A point and an object's frame: x along its width, y along its depth.
function toFrameOf(object, point) {
  const radians = ((object.rotation?.z ?? 0) * Math.PI) / 180;
  const dx = point.x - object.position.x;
  const dy = point.y - object.position.y;
  return { x: dx * Math.cos(radians) + dy * Math.sin(radians), y: -dx * Math.sin(radians) + dy * Math.cos(radians) };
}

function fromFrameOf(object, local) {
  const radians = ((object.rotation?.z ?? 0) * Math.PI) / 180;
  return {
    x: object.position.x + local.x * Math.cos(radians) - local.y * Math.sin(radians),
    y: object.position.y + local.x * Math.sin(radians) + local.y * Math.cos(radians),
  };
}

// Whether a point lies over an object's top, in the object's own frame.
function isOverTopOf(point, object) {
  const local = toFrameOf(object, point);
  return Math.abs(local.x) <= object.scale.x / 2 + 1e-3 && Math.abs(local.y) <= object.scale.y / 2 + 1e-3;
}

/**
 * Push an object that hangs mostly off what it stands on back onto it, by
 * the least distance: wholly on top where it fits, otherwise centred on it
 * (a wide screen on a small stand). Null when it does not stand on anything
 * or the spot is taken or outside the room.
 */
export function pushOntoSupport(room, object, objects) {
  const support = findSupportingObject(object, objects);
  if (support?.kind !== 'object') return null;
  const base = objects.find(candidate => candidate.id === support.id);
  if (!base) return null;
  const { sizeX, sizeY } = getRotatedFootprint(object.scale, (object.rotation?.z ?? 0) - (base.rotation?.z ?? 0));
  const local = toFrameOf(base, object.position);
  const onto = (value, half, baseHalf) => (half <= baseHalf ? safeClamp(value, -(baseHalf - half), baseHalf - half) : 0);
  const spot = fromFrameOf(base, { x: onto(local.x, sizeX / 2, base.scale.x / 2), y: onto(local.y, sizeY / 2, base.scale.y / 2) });
  const candidate = { ...object, position: { ...object.position, x: spot.x, y: spot.y } };
  const constrained = validateAndConstrainObject(candidate, room);
  if (!constrained.valid
    || ['x', 'y', 'z'].some(axis => Math.abs(constrained.object.position[axis] - candidate.position[axis]) > GEOMETRY_EPSILON)) {
    return null;
  }
  // What stands on it comes along, so only the rest has to be clear.
  const others = objects.filter(other => other.id !== object.id
    && findSupportingObject(other, objects)?.id !== object.id);
  if (others.some(other => objectsOverlap(candidate, other))) return null;
  return candidate;
}

// What a device can be set down on: a desk, or a monitor stand.
const isSurface = object => object.category === 'furniture' || isDesk(object) || object.modelId === 'monitor-stand';

// A device let go inside a desk or stand, with its middle over the top,
// stands on that top: dragged at floor height onto the desk it would
// otherwise sit inside it. Lifted onto the desk it may now be inside a
// stand on it, so it keeps climbing to the highest such top; then the spot
// must be clear (what stands on the device itself comes along with it).
function liftOntoSurface(room, object, objects) {
  if (isWallOutlet(object) || isSurface(object)) return null;
  const size = getObjectBounds(object)?.sizeZ;
  if (!size) return null;
  const surfaces = objects.filter(other => other.id !== object.id && isSurface(other));
  let current = object;
  for (let step = 0; step < surfaces.length; step += 1) {
    const bottom = current.position.z - size / 2;
    const tops = surfaces
      .filter(other => objectsOverlap(current, other) && isOverTopOf(current.position, other))
      .map(other => getObjectBounds(other)?.maxZ)
      .filter(top => Number.isFinite(top) && top > bottom + GEOMETRY_EPSILON);
    if (tops.length === 0) break;
    current = { ...current, position: { ...current.position, z: Math.max(...tops) + size / 2 } };
  }
  if (current === object) return null;
  const constrained = validateAndConstrainObject(current, room);
  if (!constrained.valid || Math.abs(constrained.object.position.z - current.position.z) > GEOMETRY_EPSILON) return null;
  const others = objects.filter(other => other.id !== object.id
    && findSupportingObject(other, objects)?.id !== object.id);
  return others.some(other => objectsOverlap(current, other)) ? null : current;
}

export function settleAfterDrag(room, object, objects, startPosition) {
  if (!object?.position || !startPosition) return null;
  const moved = ['x', 'y', 'z'].some(axis => Math.abs(object.position[axis] - startPosition[axis]) > GEOMETRY_EPSILON);
  if (!moved) return null;
  const lifted = liftOntoSurface(room, object, objects);
  if (lifted) return lifted;
  if (findSupportingObject(object, objects) !== null) return null;
  return snapObjectToSupport(room, object, objects);
}

export function snapWallOutletToNearestWall(room, object) {
  if (!isWallOutlet(object)) return null;

  const candidates = [
    { axis: 'x', side: -1, rotationZ: 90, distance: Math.abs(object.position.x + room.length / 2) },
    { axis: 'x', side: 1, rotationZ: 270, distance: Math.abs(object.position.x - room.length / 2) },
    { axis: 'y', side: -1, rotationZ: 180, distance: Math.abs(object.position.y + room.width / 2) },
    { axis: 'y', side: 1, rotationZ: 0, distance: Math.abs(object.position.y - room.width / 2) },
  ].sort((first, second) => first.distance - second.distance);

  for (const candidate of candidates) {
    const proposed = {
      ...object,
      position: { ...object.position },
      rotation: { ...object.rotation, z: candidate.rotationZ },
    };
    const bounds = getObjectBounds(proposed);
    if (!bounds) continue;

    const halfSize = candidate.axis === 'x'
      ? (bounds.maxX - bounds.minX) / 2
      : (bounds.maxY - bounds.minY) / 2;
    const roomHalfSize = candidate.axis === 'x' ? room.length / 2 : room.width / 2;
    proposed.position[candidate.axis] = candidate.side * (roomHalfSize - halfSize);

    const constrained = validateAndConstrainObject(proposed, room);
    if (constrained.valid) return constrained.object;
  }

  return null;
}

export function analyzeProjectLayout(room, rawObjects) {
  const objects = getRecordItems(rawObjects);
  const issues = [];
  const validBounds = [];

  for (const object of objects) {
    const bounds = getObjectBounds(object);
    const constrained = validateAndConstrainObject(object, room);

    if (!bounds) {
      issues.push({
        id: `invalid-geometry:${object.id}`,
        code: 'invalid_geometry',
        severity: 'error',
        title: `${object.name} 的空间数据无效`,
        description: '位置或尺寸包含无法计算的值，请在属性面板中修正。',
        objectIds: [object.id],
      });
      continue;
    }

    if (!constrained.valid) {
      issues.push({
        id: `cannot-fit:${object.id}`,
        code: 'cannot_fit',
        severity: 'error',
        title: `${object.name} 无法放入当前房间`,
        description: constrained.reason,
        objectIds: [object.id],
      });
      continue;
    }

    const expected = constrained.object.position;
    const actual = object.position;
    const outside = ['x', 'y', 'z'].some(axis =>
      Math.abs(expected[axis] - actual[axis]) > GEOMETRY_EPSILON
    );
    if (outside) {
      issues.push({
        id: `out-of-bounds:${object.id}`,
        code: 'out_of_bounds',
        severity: 'error',
        title: `${object.name} 超出房间边界`,
        description: `当前位置：左右 ${format(actual.x)}m、前后 ${format(actual.y)}m、高度 ${format(actual.z)}m，需要移回房间内部。`,
        objectIds: [object.id],
      });
    }

    if (!outside && isWallOutlet(object) && !touchesRoomWall(bounds, room)) {
      issues.push({
        id: `outlet-off-wall:${object.id}`,
        code: 'outlet_off_wall',
        severity: 'warning',
        title: `${object.name} 没有贴在墙面上`,
        description: '墙壁插座应移动到房间四周任一墙面，才能正确估算外部供电布线。',
        objectIds: [object.id],
      });
    }

    validBounds.push({ object, bounds });
  }

  for (let firstIndex = 0; firstIndex < validBounds.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < validBounds.length; secondIndex += 1) {
      const first = validBounds[firstIndex];
      const second = validBounds[secondIndex];
      if (!objectsOverlap(first.object, second.object)) continue;
      issues.push({
        id: `overlap:${first.object.id}:${second.object.id}`,
        code: 'object_overlap',
        severity: 'warning',
        title: `${first.object.name} 与 ${second.object.name} 可能互相穿插`,
        description: '基于旋转后的矩形占地与垂直高度检测。复杂模型仍按其整体尺寸近似，请结合 3D 视图确认。',
        objectIds: [first.object.id, second.object.id],
      });
    }
  }

  for (const target of validBounds) {
    if (isWallOutlet(target.object) || target.bounds.minZ <= 0.03) continue;
    const supports = validBounds.filter(candidate =>
      candidate.object.id !== target.object.id
      && horizontalFootprintsOverlap(target.object, candidate.object)
      && Math.abs(target.bounds.minZ - candidate.bounds.maxZ) <= 0.03
    );
    if (supports.length > 0) {
      // Touching is not enough: with its centre past the edge of everything
      // under it, it tips over and falls (more than half hangs off).
      if (!supports.some(candidate => isOverTopOf(target.object.position, candidate.object))) {
        const under = supports.reduce((highest, candidate) => (candidate.bounds.maxZ > highest.bounds.maxZ ? candidate : highest));
        issues.push({
          id: `overhanging:${target.object.id}`,
          code: 'overhanging_object',
          severity: 'warning',
          title: `${target.object.name} 大半悬在${under.object.name}外面，会掉下去`,
          description: '它的中心已经不在下面那件东西上，实际这样放会翻倒。可以自动推回去。',
          objectIds: [target.object.id],
        });
      }
      continue;
    }
    issues.push({
      id: `floating:${target.object.id}`,
      code: 'floating_object',
      severity: 'warning',
      title: `${target.object.name} 处于悬空状态`,
      description: '物体底部没有接触地板或其他物体的上表面。可自动落到下方最近的支撑面。',
      objectIds: [target.object.id],
    });
  }

  const order = { error: 0, warning: 1, info: 2 };
  return issues.sort((first, second) => order[first.severity] - order[second.severity]);
}

export function summarizeLayoutIssues(issues) {
  return issues.reduce((summary, issue) => {
    summary[issue.severity] += 1;
    return summary;
  }, { error: 0, warning: 0, info: 0 });
}

function format(value) {
  return Number.isFinite(value) ? Number(value.toFixed(3)) : '无效';
}

const SUPPORT_TOLERANCE = 0.02;

/**
 * What an object rests on: { kind: 'object', id } for the highest object
 * whose top meets its bottom under its footprint, { kind: 'floor' }, or
 * { kind: 'wall' } for wall outlets; null when it floats or has no geometry.
 */
export function findSupportingObject(object, objects) {
  if (isWallOutlet(object)) return { kind: 'wall' };
  const bounds = getObjectBounds(object);
  if (!bounds) return null;
  const supports = getRecordItems(objects)
    .filter(candidate => candidate.id !== object.id)
    .map(candidate => ({ candidate, top: getObjectBounds(candidate)?.maxZ }))
    .filter(({ candidate, top }) => Number.isFinite(top)
      && Math.abs(top - bounds.minZ) <= SUPPORT_TOLERANCE
      && horizontalFootprintsOverlap(object, candidate))
    .sort((first, second) => second.top - first.top);
  if (supports.length > 0) return { kind: 'object', id: supports[0].candidate.id };
  if (Math.abs(bounds.minZ) <= SUPPORT_TOLERANCE) return { kind: 'floor' };
  return null;
}
