import { isDesk } from './desks.js';
import { getRotatedFootprint, isHungUnderDesk, objectsOverlap, validateAndConstrainObject } from './geometry.js';
import { getRecordItems } from './record-collections.js';

// A plain under-desk channel. It has no ports and uses no power. The mesh is
// a generic tray, not a branded product. Cables that leave a desk over the
// back or a side edge are drawn down into it, so the desktop stays clear.
// routeCable's length is not changed here.
export const CABLE_TRAY_MODEL_ID = 'cable-tray';

// The tray's top sits this far under the desktop top, in the knee space.
export const DESKTOP_UNDERSIDE_GAP = 0.03;
const BACK_INSET = 0.01;
const MOUNT_Z_TOLERANCE = 0.02;
const SEARCH_STEP = 0.05;

// routeCable places the back-edge point this far outside the desk
// (CABLE_EDGE_CLEARANCE in cable-route.js). Kept here so the drawing pass
// does not import the router and change the measured length.
const BACK_EDGE_CLEARANCE = 0.02;

export function isCableTray(object) {
  return object?.modelId === CABLE_TRAY_MODEL_ID || object?.type === CABLE_TRAY_MODEL_ID;
}

function frameOf(desk) {
  const radians = ((desk.rotation?.z ?? 0) * Math.PI) / 180;
  const axisX = { x: Math.cos(radians), y: Math.sin(radians) };
  const axisY = { x: -Math.sin(radians), y: Math.cos(radians) };
  return {
    halfX: desk.scale.x / 2,
    halfY: desk.scale.y / 2,
    top: desk.position.z + desk.scale.z / 2,
    toWorld: (x, y) => ({
      x: desk.position.x + axisX.x * x + axisY.x * y,
      y: desk.position.y + axisX.y * x + axisY.y * y,
    }),
    toLocal: point => {
      const dx = point.x - desk.position.x;
      const dy = point.y - desk.position.y;
      return { x: dx * axisX.x + dy * axisX.y, y: dx * axisY.x + dy * axisY.y };
    },
  };
}

function halfAlong(object, desk) {
  const { sizeX, sizeY } = getRotatedFootprint(object.scale, (object.rotation?.z ?? 0) - (desk.rotation?.z ?? 0));
  return { x: sizeX / 2, y: sizeY / 2 };
}

export function trayMountHeight(desk, tray) {
  return frameOf(desk).top - DESKTOP_UNDERSIDE_GAP - tray.scale.z / 2;
}

function poseOnDesk(tray, desk, localX) {
  const frame = frameOf(desk);
  const aligned = { ...tray, rotation: { x: 0, y: 0, z: desk.rotation?.z ?? 0 } };
  const half = { x: aligned.scale.x / 2, y: aligned.scale.y / 2 };
  const y = frame.halfY - half.y - BACK_INSET;
  const maxX = frame.halfX - half.x;
  if (maxX < -1e-6 || y < -frame.halfY + half.y - 1e-6) return null;
  const x = Math.min(maxX, Math.max(-maxX, localX));
  return {
    ...aligned,
    position: { ...frame.toWorld(x, y), z: trayMountHeight(desk, aligned) },
  };
}

function fits(candidate, room, objects, desk) {
  const constrained = validateAndConstrainObject(candidate, room);
  if (!constrained.valid) return false;
  const moved = ['x', 'y', 'z'].some(axis => Math.abs(constrained.object.position[axis] - candidate.position[axis]) > 1e-4);
  if (moved) return false;
  // A strip or adapter already hung under this desk shares the channel.
  // It must not push the tray onto the floor.
  return !objects.some(other => other.id !== candidate.id
    && other.id !== desk.id
    && !isHungUnderDesk(other, desk)
    && objectsOverlap(candidate, other));
}

function firstFreeOnDesk(tray, desk, room, objects, preferredX) {
  const frame = frameOf(desk);
  const offsets = [preferredX];
  for (let offset = 0; offset <= frame.halfX + 1e-9; offset += SEARCH_STEP) {
    offsets.push(offset, -offset);
  }
  const seen = new Set();
  for (const x of offsets) {
    const key = x.toFixed(3);
    if (seen.has(key)) continue;
    seen.add(key);
    const candidate = poseOnDesk(tray, desk, x);
    if (candidate && fits(candidate, room, objects, desk)) return candidate;
  }
  return null;
}

function deskUnderCenter(tray, objects) {
  return getRecordItems(objects).find(desk => {
    if (!isDesk(desk) || desk.id === tray.id) return false;
    const frame = frameOf(desk);
    const local = frame.toLocal(tray.position);
    return Math.abs(local.x) <= frame.halfX + 1e-6 && Math.abs(local.y) <= frame.halfY + 1e-6;
  }) || null;
}

/**
 * True when the tray hangs under this desk's back edge, at the mount height.
 * A tray on the floor, or up on the desktop, is not mounted.
 */
export function isTrayMountedOn(tray, desk) {
  if (!isCableTray(tray) || !isDesk(desk)) return false;
  const frame = frameOf(desk);
  const local = frame.toLocal(tray.position);
  const half = halfAlong(tray, desk);
  const inside = Math.abs(local.x) + half.x <= frame.halfX + 0.03
    && Math.abs(local.y) + half.y <= frame.halfY + 0.03;
  const nearBack = local.y > -0.02;
  const atHeight = Math.abs(tray.position.z - trayMountHeight(desk, tray)) <= MOUNT_Z_TOLERANCE;
  return inside && nearBack && atHeight;
}

/** The desk this tray is mounted under, or null. */
export function findHostDesk(tray, objects) {
  if (!isCableTray(tray)) return null;
  return getRecordItems(objects).find(desk => isTrayMountedOn(tray, desk)) || null;
}

/**
 * Where a new tray goes: under the back edge of the first desk that has
 * room, centred, then stepped sideways. Null when no desk can hold it.
 */
export function placeCableTray(tray, room, objects) {
  for (const desk of getRecordItems(objects).filter(isDesk)) {
    const placed = firstFreeOnDesk(tray, desk, room, objects, 0);
    if (placed) return placed;
  }
  return null;
}

/**
 * After a drag, snap a tray whose centre is over a desk back under that
 * desk's back edge. Null when it was let go clear of every desk.
 */
export function remountCableTray(room, tray, objects) {
  if (!isCableTray(tray)) return null;
  const host = deskUnderCenter(tray, objects);
  if (!host) return null;
  const localX = frameOf(host).toLocal(tray.position).x;
  return firstFreeOnDesk(tray, host, room, objects, localX);
}

function nearEdge(past) {
  return past >= BACK_EDGE_CLEARANCE - 0.004 && past <= BACK_EDGE_CLEARANCE + 0.015;
}

// Just outside the back or a side edge, on the desktop. The seat edge is not
// a way off the desk (cable-route.js), so it is not an exit.
function edgeExitLocal(point, desk) {
  const frame = frameOf(desk);
  if (Math.abs(point.z - frame.top) > 0.004) return null;
  const local = frame.toLocal(point);
  const withinX = Math.abs(local.x) <= frame.halfX + 0.05;
  const withinY = Math.abs(local.y) <= frame.halfY + 0.05;
  if (nearEdge(local.y - frame.halfY) && withinX) return local;
  if (nearEdge(-frame.halfX - local.x) && withinY) return local;
  if (nearEdge(local.x - frame.halfX) && withinY) return local;
  return null;
}

function onDesktopLocal(point, desk) {
  const frame = frameOf(desk);
  if (Math.abs(point.z - frame.top) > 0.004) return null;
  const local = frame.toLocal(point);
  if (Math.abs(local.x) > frame.halfX + 0.004 || Math.abs(local.y) > frame.halfY + 0.004) return null;
  return local;
}

function trayForExit(desk, items, localX) {
  const frame = frameOf(desk);
  const trays = getRecordItems(items).filter(tray => findHostDesk(tray, items)?.id === desk.id);
  if (trays.length === 0) return null;
  const spans = trays.map(tray => {
    const center = frame.toLocal(tray.position).x;
    const half = halfAlong(tray, desk).x;
    return { tray, center, min: center - half, max: center + half };
  });
  return (spans.find(span => localX >= span.min - 1e-6 && localX <= span.max + 1e-6) || spans
    .slice()
    .sort((first, second) => Math.abs(first.center - localX) - Math.abs(second.center - localX))[0]).tray;
}

function dedupePoints(points) {
  const kept = [];
  for (const point of points) {
    const last = kept[kept.length - 1];
    if (last && Math.hypot(last.x - point.x, last.y - point.y, last.z - point.z) < 1e-4) continue;
    kept.push(point);
  }
  return kept;
}

// Along the tray, clamped to the channel. The rise or drop at the device is
// added by the caller, at the device's own x, so a short run under the top
// can reach a device the 0.70 m tray does not span.
function trayChannel(desk, tray, fromX, toX) {
  const frame = frameOf(desk);
  const center = frame.toLocal(tray.position).x;
  const half = Math.max(0.01, halfAlong(tray, desk).x - 0.02);
  const clamp = value => Math.min(center + half, Math.max(center - half, value));
  const y = frame.toLocal(tray.position).y;
  const z = tray.position.z - tray.scale.z * 0.2;
  const at = x => ({ ...frame.toWorld(clamp(x), y), z });
  return [at(fromX), at(toX)];
}

// Replace the on-desktop run between a device and the edge it leaves by.
// `index` is the last point already drawn. skip 1 drops the point after the
// one the loop would otherwise add next, which this tuck already consumed.
function tuckLeavingCable(points, index, items) {
  const next = points[index + 1];
  const after = points[index + 2];
  if (!next || !after) return null;
  for (const desk of getRecordItems(items).filter(isDesk)) {
    const exitNext = edgeExitLocal(next, desk);
    const exitAfter = edgeExitLocal(after, desk);
    const inNext = onDesktopLocal(next, desk);
    const inAfter = onDesktopLocal(after, desk);
    let exitLocal;
    let insidePoint;
    let insideLocal;
    let towardDevice = false;
    if (exitNext && inAfter) {
      exitLocal = exitNext;
      insidePoint = after;
      insideLocal = inAfter;
      towardDevice = true;
    } else if (inNext && exitAfter) {
      exitLocal = exitAfter;
      insidePoint = next;
      insideLocal = inNext;
    } else continue;
    const tray = trayForExit(desk, items, exitLocal.x);
    if (!tray) continue;
    const grommet = { x: insidePoint.x, y: insidePoint.y, z: tray.position.z - tray.scale.z * 0.2 };
    const channel = trayChannel(
      desk,
      tray,
      towardDevice ? exitLocal.x : insideLocal.x,
      towardDevice ? insideLocal.x : exitLocal.x,
    );
    const inserted = towardDevice ? [...channel, grommet, insidePoint] : [grommet, ...channel];
    return { points: dedupePoints(inserted), skip: 1 };
  }
  return null;
}

/**
 * The points to draw. Same as the measured route unless a mounted tray sits
 * under a desk the cable leaves over the back or a side: then the picture
 * drops at the device into that tray instead of running across the top.
 * The shop length still uses the route from routeCable, so hiding the cable
 * does not make it shorter. Two devices on the same desk still join on top.
 * A cable with both ends off the desktop (tower to router, tower to the hung
 * strip) keeps the measured chord: pulling that chord down through the knee
 * opening made a worse picture.
 */
export function drawCablePoints(points, objects) {
  if (!Array.isArray(points) || points.length < 2) return points;
  const items = getRecordItems(objects);
  if (!items.some(object => findHostDesk(object, items))) return points;
  const drawn = [points[0]];
  for (let index = 0; index < points.length - 1; index += 1) {
    const tuck = tuckLeavingCable(points, index, items);
    if (tuck) {
      drawn.push(...tuck.points);
      index += tuck.skip;
      continue;
    }
    drawn.push(points[index + 1]);
  }
  return drawn;
}
