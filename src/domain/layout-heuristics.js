import { evaluateConnectionLength, standardCableLength } from './connections.js';
import { getRotatedFootprint } from './geometry.js';
import { findSupportingObject } from './layout-analysis.js';
import { getRecordItems } from './record-collections.js';

// Soft layout advice: things that work but could be more comfortable or
// tidier. These are hints, never errors, and the three built-in templates
// must produce none (they are the reference for a good desk). The AI gets
// them as input, and they score layouts (layout-score.js).
//
// Each hint carries `fix`: one concrete way to resolve it, written as AI
// actions (move / rotate / set_cable_length). It is a starting point for the
// model, not a promise: suggestions are still checked before being shown.
//
// Desk frame: a device's front faces its local +y. Templates turn monitors
// and laptops to rotation 180 so they face -y, and the person sits on the
// desk's -y side, SEAT_DISTANCE in front of the desk's front edge.
export const HEURISTIC_LIMITS = Object.freeze({
  seatDistance: 0.35,
  singleMonitorOffset: 0.15,
  monitorGroupOffset: 0.2,
  minViewingDistance: 0.45,
  maxFacingAngle: 30,
  deskMiddleShare: 0.6,
  cableSlackFactor: 2,
  cableSlackMetres: 1,
});

const MONITOR_MODELS = new Set(['monitor-24', 'monitor-27', 'ultrawide-monitor']);
// Old saves have gaming-desk, standing-desk, l-desk; 'desktop-pc' is not a desk.
export const isDesk = object => object.modelId === 'office-desk' || /(^|[-_])desk$/.test(object.type ?? '');
const isMonitor = object => MONITOR_MODELS.has(object.modelId) || object.type === 'monitor';
const isLaptop = object => object.modelId === 'laptop-15' || object.type === 'laptop';
const isTower = object => object.modelId === 'desktop-pc' || object.type === 'desktop-pc';
const isStrip = object => object.modelId === 'power-strip' || object.type === 'power_strip';
const isRouter = object => object.modelId === 'router' || object.type === 'router';

function deskFrame(desk) {
  const radians = ((desk.rotation?.z ?? 0) * Math.PI) / 180;
  const axisX = { x: Math.cos(radians), y: Math.sin(radians) };
  const axisY = { x: -Math.sin(radians), y: Math.cos(radians) };
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
  return {
    desk,
    halfLength,
    halfDepth,
    toLocal,
    toWorld,
    seatLocal: { x: 0, y: -(halfDepth + HEURISTIC_LIMITS.seatDistance) },
    // The direction a screen should face: from the desk towards the seat.
    towardSeat: { x: -axisY.x, y: -axisY.y },
    inMiddle: local => Math.abs(local.x) < halfLength * HEURISTIC_LIMITS.deskMiddleShare,
    underDesk: local => Math.abs(local.x) < halfLength && Math.abs(local.y) < halfDepth,
  };
}

// Angle between a device's front (its local +y) and a unit direction.
function facingAngleDegrees(object, direction) {
  const radians = ((object.rotation?.z ?? 0) * Math.PI) / 180;
  const cosine = -Math.sin(radians) * direction.x + Math.cos(radians) * direction.y;
  return (Math.acos(Math.max(-1, Math.min(1, cosine))) * 180) / Math.PI;
}

/** Where the person sits at a desk, in room coordinates. */
export function getDeskSeat(desk) {
  const radians = ((desk.rotation?.z ?? 0) * Math.PI) / 180;
  const reach = desk.scale.y / 2 + HEURISTIC_LIMITS.seatDistance;
  return {
    x: desk.position.x + Math.sin(radians) * reach,
    y: desk.position.y - Math.cos(radians) * reach,
  };
}

const hint = (code, objectIds, message, extra = {}) => ({ code, severity: 'hint', objectIds, message, ...extra });
const round = value => Math.round(value * 100) / 100;
const move = (object, point, z) => ({ type: 'move', objectId: object.id, x: round(point.x), y: round(point.y), ...(z === undefined ? {} : { z: round(z) }) });

// A floor spot beside the desk's left (-1) or right (+1) end for an object,
// as close as the templates put a tower (5 cm gap), so its cables still reach.
function besideDesk(frame, object, side) {
  const along = getRotatedFootprint(object.scale, (object.rotation?.z ?? 0) - (frame.desk.rotation?.z ?? 0)).sizeX;
  return frame.toWorld({ x: side * (frame.halfLength + along / 2 + 0.05), y: 0 });
}

function insideRoom(room, object, point) {
  const half = Math.max(object.scale.x, object.scale.y) / 2;
  return Math.abs(point.x) + half <= room.length / 2 && Math.abs(point.y) + half <= room.width / 2;
}

// Prefer the end nearest the object, fall back to the other one.
function floorSpotBesideDesk(room, frame, object, preferredSide) {
  for (const side of [preferredSide, -preferredSide]) {
    const point = besideDesk(frame, object, side);
    if (insideRoom(room, object, point)) return point;
  }
  return null;
}

export function analyzeLayoutHeuristics(room, rawObjects, rawConnections = []) {
  const objects = getRecordItems(rawObjects).filter(object => object?.position && object?.scale);
  const connections = getRecordItems(rawConnections);
  const frames = new Map(objects.filter(isDesk).map(desk => [desk.id, deskFrame(desk)]));
  const supportOf = new Map(objects.map(object => [object.id, findSupportingObject(object, objects)]));
  const deskUnder = object => {
    const support = supportOf.get(object.id);
    return support?.kind === 'object' ? frames.get(support.id) ?? null : null;
  };
  const onFloor = object => supportOf.get(object.id)?.kind === 'floor';
  const hints = [];

  // Monitors: on a desk, in front of the seat, far enough away, facing it.
  const monitorsByDesk = new Map();
  for (const monitor of objects.filter(isMonitor)) {
    const frame = deskUnder(monitor);
    if (!frame) {
      if (frames.size > 0) {
        const [frame] = frames.values();
        hints.push(hint('monitor_not_on_desk', [monitor.id], `${monitor.name}没有放在桌面上`, {
          fix: [move(monitor, frame.toWorld({ x: 0, y: frame.halfDepth / 2 }))],
        }));
      }
      continue;
    }
    if (!monitorsByDesk.has(frame)) monitorsByDesk.set(frame, []);
    monitorsByDesk.get(frame).push(monitor);
    const local = frame.toLocal(monitor.position);
    if (local.y - frame.seatLocal.y < HEURISTIC_LIMITS.minViewingDistance) {
      const targetY = Math.min(frame.seatLocal.y + HEURISTIC_LIMITS.minViewingDistance + 0.15, frame.halfDepth - monitor.scale.y / 2);
      hints.push(hint('monitor_too_close', [monitor.id], `${monitor.name}离人太近，看久了眼睛累`, {
        fix: [move(monitor, frame.toWorld({ x: local.x, y: targetY }))],
      }));
    }
    if (facingAngleDegrees(monitor, frame.towardSeat) > HEURISTIC_LIMITS.maxFacingAngle) {
      hints.push(hint('monitor_facing_away', [monitor.id], `${monitor.name}没有朝向座位`, {
        fix: [{ type: 'rotate', objectId: monitor.id, rotationZ: round(((frame.desk.rotation?.z ?? 0) + 180) % 360) }],
      }));
    }
  }
  for (const [frame, monitors] of monitorsByDesk) {
    const centre = monitors.reduce((sum, monitor) => sum + frame.toLocal(monitor.position).x, 0) / monitors.length;
    const limit = monitors.length === 1 ? HEURISTIC_LIMITS.singleMonitorOffset : HEURISTIC_LIMITS.monitorGroupOffset;
    if (Math.abs(centre) > limit) {
      const subject = monitors.length === 1 ? monitors[0].name : '显示器';
      hints.push(hint('monitor_off_center', monitors.map(monitor => monitor.id), `${subject}偏离了座位正前方`, {
        fix: monitors.map(monitor => {
          const local = frame.toLocal(monitor.position);
          return move(monitor, frame.toWorld({ x: local.x - centre, y: local.y }));
        }),
      }));
    }
  }

  for (const laptop of objects.filter(isLaptop)) {
    const frame = deskUnder(laptop);
    const local = frame?.toLocal(laptop.position);
    if (frame && local.y > 0) {
      hints.push(hint('laptop_at_back', [laptop.id], `${laptop.name}放在桌子后面，打字够不着`, {
        fix: [move(laptop, frame.toWorld({ x: local.x, y: -frame.halfDepth + laptop.scale.y / 2 + 0.05 }))],
      }));
    }
  }

  for (const tower of objects.filter(isTower)) {
    const frame = deskUnder(tower);
    const towerFix = towerFrame => {
      const spot = floorSpotBesideDesk(room, towerFrame, tower, towerFrame.toLocal(tower.position).x < 0 ? -1 : 1);
      return spot ? { fix: [move(tower, spot, tower.scale.z / 2)] } : {};
    };
    if (frame && frame.inMiddle(frame.toLocal(tower.position))) {
      hints.push(hint('tower_on_desk_center', [tower.id], `${tower.name}占着桌面中间`, towerFix(frame)));
    }
    if (onFloor(tower)) {
      for (const floorFrame of frames.values()) {
        const local = floorFrame.toLocal(tower.position);
        if (floorFrame.inMiddle(local) && floorFrame.underDesk(local)) {
          hints.push(hint('tower_blocks_legroom', [tower.id], `${tower.name}挡住了桌下放腿的地方`, towerFix(floorFrame)));
          break;
        }
      }
    }
  }

  for (const strip of objects.filter(isStrip)) {
    const frame = deskUnder(strip);
    if (frame) {
      // On the floor under the back edge, out of the way of feet.
      const spot = frame.toWorld({ x: 0, y: frame.halfDepth - strip.scale.y / 2 - 0.02 });
      hints.push(hint('strip_on_desk', [strip.id], `${strip.name}放在桌面上，显得乱也容易碰到`, {
        fix: [move(strip, spot, strip.scale.z / 2)],
      }));
    }
  }

  for (const router of objects.filter(isRouter)) {
    if (!onFloor(router)) continue;
    for (const frame of frames.values()) {
      if (frame.underDesk(frame.toLocal(router.position))) {
        // The end away from a tower, so the two do not end up in one spot.
        const tower = objects.find(object => isTower(object) && onFloor(object));
        const side = tower && frame.toLocal(tower.position).x > 0 ? -1 : 1;
        const spot = floorSpotBesideDesk(room, frame, router, side);
        hints.push(hint('router_buried', [router.id], `${router.name}被桌子挡住，信号可能变差`,
          spot ? { fix: [move(router, spot, router.scale.z / 2)] } : {}));
        break;
      }
    }
  }

  for (const connection of connections) {
    const length = evaluateConnectionLength(connection, objects);
    if (!length) continue;
    const extra = length.cableLength - length.recommendedLength;
    if (length.cableLength > length.recommendedLength * HEURISTIC_LIMITS.cableSlackFactor
      && extra > HEURISTIC_LIMITS.cableSlackMetres) {
      hints.push(hint('cable_too_long', [connection.fromObjectId, connection.toObjectId],
        `${connection.name}比需要的长很多，容易缠在一起`, {
          connectionIds: [connection.id],
          fix: [{ type: 'set_cable_length', connectionId: connection.id, length: standardCableLength(length.recommendedLength) }],
        }));
    }
  }

  return hints;
}
