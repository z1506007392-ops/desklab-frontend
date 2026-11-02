import { validateAndConstrainObject } from './geometry.js';
import { findSupportingObject } from './layout-analysis.js';

/**
 * Everything resting on `base`, and on those in turn: the screen, laptop
 * and keyboard on a desk, the screen on a stand on that desk. "Resting on"
 * is findSupportingObject's: the highest thing whose top meets the bottom.
 */
export function findRiders(base, objects) {
  const supportOf = new Map(objects.map(object => [object.id, findSupportingObject(object, objects)]));
  const carried = new Set([base.id]);
  const riders = [];
  for (let added = true; added;) {
    added = false;
    for (const object of objects) {
      if (carried.has(object.id)) continue;
      const support = supportOf.get(object.id);
      if (support?.kind === 'object' && carried.has(support.id)) {
        carried.add(object.id);
        riders.push(object);
        added = true;
      }
    }
  }
  return riders;
}

const normalizeTurn = degrees => ((degrees % 360) + 360) % 360;

/**
 * `objects` with `before` replaced by `after` and everything resting on it
 * carried along the same way: turned about its centre by the change in its
 * turn, shifted with it, and raised or lowered with its top (a taller desk
 * lifts what stands on it). Riders stay inside the room.
 */
export function moveWithRiders(objects, before, after, room) {
  const riders = new Map(findRiders(before, objects).map(rider => [rider.id, rider]));
  if (riders.size === 0) return objects.map(object => (object.id === after.id ? after : object));

  const turn = (after.rotation?.z ?? 0) - (before.rotation?.z ?? 0);
  const radians = (turn * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const lift = (after.position.z + after.scale.z / 2) - (before.position.z + before.scale.z / 2);
  const carry = rider => {
    const dx = rider.position.x - before.position.x;
    const dy = rider.position.y - before.position.y;
    const moved = {
      ...rider,
      position: {
        x: after.position.x + dx * cos - dy * sin,
        y: after.position.y + dx * sin + dy * cos,
        z: rider.position.z + lift,
      },
      rotation: { ...rider.rotation, z: turn === 0 ? rider.rotation?.z ?? 0 : normalizeTurn((rider.rotation?.z ?? 0) + turn) },
    };
    const constrained = room ? validateAndConstrainObject(moved, room) : null;
    return constrained?.valid ? constrained.object : moved;
  };
  return objects.map(object => {
    if (object.id === after.id) return after;
    const rider = riders.get(object.id);
    return rider ? carry(rider) : object;
  });
}

/**
 * `objects` with the object of `next`'s id replaced by `next`, carrying
 * what rests on it (see moveWithRiders). Unchanged when it is not there.
 */
export function updateWithRiders(objects, next, room) {
  const current = objects.find(object => object.id === next.id);
  return current ? moveWithRiders(objects, current, next, room) : objects;
}
