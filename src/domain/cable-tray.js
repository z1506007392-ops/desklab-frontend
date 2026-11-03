import { isDesk } from './desks.js';
import { getRotatedFootprint, objectsOverlap, validateAndConstrainObject } from './geometry.js';
import { getRecordItems } from './record-collections.js';

// A plain under-desk channel. It has no ports and uses no power. The mesh is
// a generic tray, not a branded product. Cables that already leave over the
// back edge are drawn through it; routeCable's length is not changed here.
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
  return !objects.some(other => other.id !== candidate.id
    && other.id !== desk.id
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

function backExitLocal(point, desk) {
  const frame = frameOf(desk);
  const local = frame.toLocal(point);
  const past = local.y - frame.halfY;
  if (past < BACK_EDGE_CLEARANCE - 0.004 || past > BACK_EDGE_CLEARANCE + 0.015) return null;
  if (Math.abs(point.z - frame.top) > 0.004) return null;
  if (Math.abs(local.x) > frame.halfX + 0.05) return null;
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

function channelPoints(desk, tray, entryX, leaveX) {
  const frame = frameOf(desk);
  const center = frame.toLocal(tray.position).x;
  const half = Math.max(0.01, halfAlong(tray, desk).x - 0.02);
  const clamp = value => Math.min(center + half, Math.max(center - half, value));
  const y = frame.toLocal(tray.position).y;
  const z = tray.position.z - tray.scale.z * 0.2;
  const at = x => ({ ...frame.toWorld(x, y), z });
  const out = { ...frame.toWorld(clamp(leaveX), frame.halfY + BACK_EDGE_CLEARANCE), z };
  return [at(clamp(entryX)), at(clamp(leaveX)), out];
}

function tuckBackEdge(points, index, items) {
  const exit = points[index + 1];
  if (!exit) return null;
  const desks = getRecordItems(items).filter(isDesk);
  for (const desk of desks) {
    const local = backExitLocal(exit, desk);
    if (!local) continue;
    const tray = trayForExit(desk, items, local.x);
    if (!tray) continue;
    const drop = points[index + 2];
    const drops = Boolean(drop
      && Math.abs(drop.x - exit.x) < 1e-4
      && Math.abs(drop.y - exit.y) < 1e-4
      && drop.z < exit.z - 0.01);
    const after = drops ? points[index + 3] : drop;
    const leaveX = after ? frameOf(desk).toLocal(after).x : local.x;
    return { points: [exit, ...channelPoints(desk, tray, local.x, leaveX)], skip: drops ? 1 : 0 };
  }
  return null;
}

/**
 * The points to draw. Same as the measured route unless a mounted tray sits
 * under a desk whose back edge the cable already crosses: then the picture
 * drops into that tray and comes out again. The shop length still uses the
 * route from routeCable, so hiding the cable does not make it shorter.
 */
export function drawCablePoints(points, objects) {
  if (!Array.isArray(points) || points.length < 2) return points;
  const items = getRecordItems(objects);
  if (!items.some(object => findHostDesk(object, items))) return points;
  const drawn = [points[0]];
  for (let index = 0; index < points.length - 1; index += 1) {
    const tuck = tuckBackEdge(points, index, items);
    if (tuck) {
      drawn.push(...tuck.points);
      index += tuck.skip;
      continue;
    }
    drawn.push(points[index + 1]);
  }
  return drawn;
}
