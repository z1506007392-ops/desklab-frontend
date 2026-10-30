import { evaluateConnectionLength } from './connections.js';
import { findSupportingObject } from './layout-analysis.js';
import { getRecordItems } from './record-collections.js';

// Soft layout advice: things that work but could be more comfortable or
// tidier. These are hints, never errors, and the three built-in templates
// must produce none (they are the reference for a good desk). The AI gets
// them as input, and they score layouts (layout-score.js).
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
const isDesk = object => object.modelId === 'office-desk' || /(^|[-_])desk$/.test(object.type ?? '');
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
  return {
    desk,
    halfLength,
    halfDepth,
    toLocal,
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

const hint = (code, objectIds, message, extra = {}) => ({ code, severity: 'hint', objectIds, message, ...extra });

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
      if (frames.size > 0) hints.push(hint('monitor_not_on_desk', [monitor.id], `${monitor.name}没有放在桌面上`));
      continue;
    }
    if (!monitorsByDesk.has(frame)) monitorsByDesk.set(frame, []);
    monitorsByDesk.get(frame).push(monitor);
    const local = frame.toLocal(monitor.position);
    if (local.y - frame.seatLocal.y < HEURISTIC_LIMITS.minViewingDistance) {
      hints.push(hint('monitor_too_close', [monitor.id], `${monitor.name}离人太近，看久了眼睛累`));
    }
    if (facingAngleDegrees(monitor, frame.towardSeat) > HEURISTIC_LIMITS.maxFacingAngle) {
      hints.push(hint('monitor_facing_away', [monitor.id], `${monitor.name}没有朝向座位`));
    }
  }
  for (const [frame, monitors] of monitorsByDesk) {
    const centre = monitors.reduce((sum, monitor) => sum + frame.toLocal(monitor.position).x, 0) / monitors.length;
    const limit = monitors.length === 1 ? HEURISTIC_LIMITS.singleMonitorOffset : HEURISTIC_LIMITS.monitorGroupOffset;
    if (Math.abs(centre) > limit) {
      const subject = monitors.length === 1 ? monitors[0].name : '显示器';
      hints.push(hint('monitor_off_center', monitors.map(monitor => monitor.id), `${subject}偏离了座位正前方`));
    }
  }

  for (const laptop of objects.filter(isLaptop)) {
    const frame = deskUnder(laptop);
    if (frame && frame.toLocal(laptop.position).y > 0) {
      hints.push(hint('laptop_at_back', [laptop.id], `${laptop.name}放在桌子后面，打字够不着`));
    }
  }

  for (const tower of objects.filter(isTower)) {
    const frame = deskUnder(tower);
    if (frame && frame.inMiddle(frame.toLocal(tower.position))) {
      hints.push(hint('tower_on_desk_center', [tower.id], `${tower.name}占着桌面中间`));
    }
    if (onFloor(tower)) {
      for (const floorFrame of frames.values()) {
        const local = floorFrame.toLocal(tower.position);
        if (floorFrame.inMiddle(local) && floorFrame.underDesk(local)) {
          hints.push(hint('tower_blocks_legroom', [tower.id], `${tower.name}挡住了桌下放腿的地方`));
          break;
        }
      }
    }
  }

  for (const strip of objects.filter(isStrip)) {
    if (deskUnder(strip)) hints.push(hint('strip_on_desk', [strip.id], `${strip.name}放在桌面上，显得乱也容易碰到`));
  }

  for (const router of objects.filter(isRouter)) {
    if (!onFloor(router)) continue;
    for (const frame of frames.values()) {
      if (frame.underDesk(frame.toLocal(router.position))) {
        hints.push(hint('router_buried', [router.id], `${router.name}被桌子挡住，信号可能变差`));
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
        `${connection.name}比需要的长很多，容易缠在一起`, { connectionIds: [connection.id] }));
    }
  }

  return hints;
}
