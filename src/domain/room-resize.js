import { constrainProjectToRoom, getObjectBounds, validateAndConstrainObject } from './geometry.js';
import { findSupportingObject, snapWallOutletToNearestWall } from './layout-analysis.js';
import { updateWithRiders } from './riders.js';

const isWallOutlet = object => object.modelId === 'wall-outlet' || object.type === 'outlet';
// A layout this close to a wall stands against it and keeps that gap when
// the wall moves (the templates leave 15 cm behind the desk).
const AGAINST_WALL = 0.3;
const ON_WALL = 0.03;

const AXES = [
  { axis: 'x', size: 'length', min: 'minX', max: 'maxX' },
  { axis: 'y', size: 'width', min: 'minY', max: 'maxY' },
];

// Which wall an outlet is on: { axis, side } with side -1 or 1, or null.
function wallOf(outlet, room) {
  const bounds = getObjectBounds(outlet);
  if (!bounds) return null;
  for (const { axis, size, min, max } of AXES) {
    if (Math.abs(bounds[max] - room[size] / 2) <= ON_WALL) return { axis, side: 1 };
    if (Math.abs(bounds[min] + room[size] / 2) <= ON_WALL) return { axis, side: -1 };
  }
  return null;
}

// How far the layout moves along one axis: with the wall it stands against,
// keeping the gap, then as little as it takes to stay inside.
function layoutShift(span, oldHalf, newHalf) {
  const nearMax = oldHalf - span.max <= AGAINST_WALL;
  const nearMin = span.min + oldHalf <= AGAINST_WALL;
  let shift = 0;
  if (nearMax && !nearMin) shift = newHalf - oldHalf;
  else if (nearMin && !nearMax) shift = oldHalf - newHalf;
  if (span.max - span.min <= 2 * newHalf) {
    if (span.max + shift > newHalf) shift = newHalf - span.max;
    if (span.min + shift < -newHalf) shift = -newHalf - span.min;
  }
  return shift;
}

/**
 * Fit a layout into a resized room the way the room changes around it: the
 * whole layout moves as one piece, along each axis with the wall it stands
 * against (keeping its gap) or by the least that keeps it inside, so every
 * device keeps its place relative to the others and every cable its length.
 * Wall outlets stay on their wall. Whatever still does not fit is pushed in
 * on its own, carrying what stands on it. Same result shape as
 * constrainProjectToRoom, which also decides when the room is too small.
 */
export function refitLayoutToRoom(oldRoom, newRoom, objects) {
  const check = constrainProjectToRoom(newRoom, objects);
  if (!check.valid) return check;

  const outletWalls = new Map(objects.filter(isWallOutlet).map(object => [object.id, wallOf(object, oldRoom)]));
  const layout = objects.filter(object => !outletWalls.get(object.id));
  const shift = { x: 0, y: 0 };
  for (const { axis, size, min, max } of AXES) {
    const bounds = layout.map(getObjectBounds).filter(Boolean);
    if (bounds.length === 0 || oldRoom[size] === newRoom[size]) continue;
    const span = { min: Math.min(...bounds.map(item => item[min])), max: Math.max(...bounds.map(item => item[max])) };
    shift[axis] = layoutShift(span, oldRoom[size] / 2, newRoom[size] / 2);
  }

  let fitted = objects.map(object => {
    const wall = outletWalls.get(object.id);
    if (!wall) {
      return { ...object, position: { ...object.position, x: object.position.x + shift.x, y: object.position.y + shift.y } };
    }
    // Along its wall it follows the layout; across, it moves with the wall.
    const size = wall.axis === 'x' ? 'length' : 'width';
    const across = wall.side * (newRoom[size] - oldRoom[size]) / 2;
    const moved = {
      ...object,
      position: {
        ...object.position,
        x: object.position.x + (wall.axis === 'x' ? across : shift.x),
        y: object.position.y + (wall.axis === 'y' ? across : shift.y),
      },
    };
    return snapWallOutletToNearestWall(newRoom, moved) ?? moved;
  });

  // What still sticks out is pushed in, things on the floor first so what
  // stands on them comes along; then anything left over on its own.
  const bases = fitted.filter(object => findSupportingObject(object, fitted)?.kind !== 'object');
  for (const base of bases) {
    const current = fitted.find(object => object.id === base.id);
    const constrained = validateAndConstrainObject(current, newRoom);
    if (constrained.valid && constrained.object !== current
      && ['x', 'y', 'z'].some(axis => constrained.object.position[axis] !== current.position[axis])) {
      fitted = updateWithRiders(fitted, constrained.object, newRoom);
    }
  }
  fitted = fitted.map(object => {
    const constrained = validateAndConstrainObject(object, newRoom);
    return constrained.valid ? constrained.object : object;
  });
  return { valid: true, reason: '', room: { ...newRoom }, objects: fitted };
}
