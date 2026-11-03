import { isDesk } from './desks.js';
import { findSupportingObject } from './layout-analysis.js';
import { getRecordItems } from './record-collections.js';

// Where a cable really runs, in project metres. A cable cannot pass through
// a desktop: from a device on a desk it lies on the desktop, and to reach
// anything off that desk it goes over the desk's back or side edge, never the
// seat side. Two devices on the same desk are joined across its top. Two
// devices that are not on a desk are joined straight, as before; on the
// floor that is close to how the cable lies.
//
// Desk frame: the person sits on the desk's local -y side (see
// layout-heuristics.js), so the back edge is local +y.

// The cable clears the edge by this much, and drops this far below the
// desktop before heading off, so it does not cut through the board.
export const CABLE_EDGE_CLEARANCE = 0.02;
export const CABLE_UNDER_DESKTOP = 0.06;

/**
 * The desk a device stands on, directly or on something on the desk (a
 * monitor on a stand), or null when it is not on a desk.
 */
export function findCableDesk(object, objects) {
  const items = getRecordItems(objects);
  const seen = new Set();
  let current = object;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    const support = findSupportingObject(current, items);
    if (support?.kind !== 'object') return null;
    const supporter = items.find(candidate => candidate.id === support.id);
    if (!supporter) return null;
    if (isDesk(supporter)) return supporter;
    current = supporter;
  }
  return null;
}

function deskTop(desk) {
  return desk.position.z + desk.scale.z / 2;
}

function deskAxes(desk) {
  const radians = ((desk.rotation?.z ?? 0) * Math.PI) / 180;
  return { axisX: { x: Math.cos(radians), y: Math.sin(radians) }, axisY: { x: -Math.sin(radians), y: Math.cos(radians) } };
}

const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);

export function pathLength(points) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) total += distance(points[index - 1], points[index]);
  return total;
}

// The point on segment start→end (in the desk's local plane) that makes the
// way from `inside` to `other` over that line shortest: straight across if
// `other` is beyond the line, else via the mirror image of `other`.
function bestPointOnEdge(edge, inside, other) {
  const { start, end, outward } = edge;
  const side = point => (point.x - start.x) * outward.x + (point.y - start.y) * outward.y;
  const otherSide = side(other);
  const target = otherSide > 0 ? other : { x: other.x - 2 * otherSide * outward.x, y: other.y - 2 * otherSide * outward.y };
  const along = { x: end.x - start.x, y: end.y - start.y };
  const insideSide = side(inside);
  const targetSide = side(target);
  // inside is on the desk (side <= 0), target beyond the line (side > 0).
  const share = insideSide === targetSide ? 0.5 : insideSide / (insideSide - targetSide);
  const crossing = { x: inside.x + (target.x - inside.x) * share, y: inside.y + (target.y - inside.y) * share };
  const lengthSquared = along.x * along.x + along.y * along.y;
  const t = Math.min(1, Math.max(0, ((crossing.x - start.x) * along.x + (crossing.y - start.y) * along.y) / lengthSquared));
  return { x: start.x + along.x * t, y: start.y + along.y * t };
}

// From a port on `desk` down onto the desktop and over the edge that makes
// the way to `other` (a point in the room) shortest. Returns the points from
// the port to just under the desktop past the edge.
function wayOffDesk(port, desk, other) {
  const top = deskTop(desk);
  const { axisX, axisY } = deskAxes(desk);
  const halfLength = desk.scale.x / 2;
  const halfDepth = desk.scale.y / 2;
  const toLocal = point => {
    const dx = point.x - desk.position.x;
    const dy = point.y - desk.position.y;
    return { x: dx * axisX.x + dy * axisX.y, y: dx * axisY.x + dy * axisY.y };
  };
  const toWorld = local => ({
    x: desk.position.x + axisX.x * local.x + axisY.x * local.y,
    y: desk.position.y + axisX.y * local.x + axisY.y * local.y,
  });
  const onTop = { x: port.x, y: port.y, z: top };
  const inside = toLocal(onTop);
  const target = toLocal(other);
  const edges = [
    { start: { x: -halfLength, y: halfDepth }, end: { x: halfLength, y: halfDepth }, outward: { x: 0, y: 1 } },
    { start: { x: -halfLength, y: -halfDepth }, end: { x: -halfLength, y: halfDepth }, outward: { x: -1, y: 0 } },
    { start: { x: halfLength, y: -halfDepth }, end: { x: halfLength, y: halfDepth }, outward: { x: 1, y: 0 } },
  ];
  let best = null;
  for (const edge of edges) {
    const point = bestPointOnEdge(edge, inside, target);
    const out = toWorld({ x: point.x + edge.outward.x * CABLE_EDGE_CLEARANCE, y: point.y + edge.outward.y * CABLE_EDGE_CLEARANCE });
    const way = [port, onTop, { ...out, z: top }, { ...out, z: top - CABLE_UNDER_DESKTOP }];
    const length = pathLength(way) + distance(way[way.length - 1], other);
    if (!best || length < best.length - 1e-9) best = { way, length };
  }
  return best.way;
}

/**
 * The points a cable passes from port `from` (on fromObject) to port `to`
 * (on toObject), and its length. `objects` is the whole room, so the desks
 * the devices stand on can be found.
 */
// The length returned here is what the shop list and the "too short" check
// use. A mounted cable tray changes only the drawn points (cable-tray.js);
// it must not shorten this path.
export function routeCable(from, to, fromObject, toObject, objects) {
  const fromDesk = fromObject ? findCableDesk(fromObject, objects) : null;
  const toDesk = toObject ? findCableDesk(toObject, objects) : null;
  let points;
  if (!fromDesk && !toDesk) {
    points = [from, to];
  } else if (fromDesk && toDesk && fromDesk.id === toDesk.id) {
    const top = deskTop(fromDesk);
    points = [from, { x: from.x, y: from.y, z: top }, { x: to.x, y: to.y, z: top }, to];
  } else {
    const head = fromDesk ? wayOffDesk(from, fromDesk, to) : [from];
    const tail = toDesk ? wayOffDesk(to, toDesk, from).reverse() : [to];
    points = [...head, ...tail];
  }
  return { points, length: pathLength(points) };
}
