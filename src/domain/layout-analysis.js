import {
  GEOMETRY_EPSILON,
  getObjectBounds,
  horizontalFootprintsOverlap,
  objectsOverlap,
  validateAndConstrainObject,
} from './geometry.js';
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
    const supported = validBounds.some(candidate =>
      candidate.object.id !== target.object.id
      && horizontalFootprintsOverlap(target.object, candidate.object)
      && Math.abs(target.bounds.minZ - candidate.bounds.maxZ) <= 0.03
    );
    if (supported) continue;
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
