import { evaluateConnectionLength, standardCableLength } from './connections.js';
import { getRotatedFootprint, horizontalFootprintsOverlap, hungUnderDeskPosition, isHungUnderDesk } from './geometry.js';
import { isDesk } from './desks.js';
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
  // In front of the desk's midline, in the desk's own coordinates. The seat
  // is -y. A back corner and the middle of a side edge (local y = 0) are not
  // in the way of writing.
  frontOfDeskLocalY: -0.05,
  mouseKeyboardDistance: 0.45,
  cornerInset: 0.05,
});

// From the seat, the right hand is -x (scene-builder uses the same sign).
const SEAT_RIGHT = -1;

const MONITOR_MODELS = new Set(['monitor-24', 'monitor-27', 'ultrawide-monitor']);
export { isDesk };
const isMonitor = object => MONITOR_MODELS.has(object.modelId) || object.type === 'monitor';
const isLaptop = object => object.modelId === 'laptop-15' || object.type === 'laptop';
const isKeyboard = object => object.modelId === 'keyboard' || object.type === 'keyboard';
const isTower = object => object.modelId === 'desktop-pc' || object.type === 'desktop-pc';
const isStrip = object => object.modelId === 'power-strip' || object.type === 'power_strip';
const isRouter = object => object.modelId === 'router' || object.type === 'router';
const isConsole = object => object.modelId === 'game-console' || object.type === 'game-console';
const isLamp = object => object.modelId === 'desk-lamp' || object.type === 'desk-lamp';
const isSpeakers = object => object.modelId === 'speakers' || object.type === 'speakers';
const isMouse = object => object.modelId === 'mouse' || object.type === 'mouse';

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

function backCorner(frame, object, side) {
  return frame.toWorld({
    x: side * (frame.halfLength - object.scale.x / 2 - HEURISTIC_LIMITS.cornerInset),
    y: frame.halfDepth - object.scale.y / 2 - HEURISTIC_LIMITS.cornerInset,
  });
}

function blocksFront(frame, object) {
  const local = frame.toLocal(object.position);
  return local.y < HEURISTIC_LIMITS.frontOfDeskLocalY && frame.inMiddle(local);
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

// A spot on the desk far enough from the seat, preferring the back edge so the
// monitor does not land on the laptop. The old target sat only 15 cm past the
// minimum distance, which on a home desk is the laptop, and the move was then
// rejected because a monitor has to stay on the desk.
function clearMonitorSpot(frame, monitor, objects) {
  const halfY = monitor.scale.y / 2;
  // Distance is to the screen, the face toward the seat, not the centre of a
  // stand that now reaches back behind the panel.
  const minY = frame.seatLocal.y + HEURISTIC_LIMITS.minViewingDistance + halfY + 0.02;
  const maxY = frame.halfDepth - halfY - 0.02;
  if (maxY < minY) return null;
  const localX = frame.toLocal(monitor.position).x;
  const blockers = objects.filter(object => object.id !== monitor.id && !isDesk(object));
  for (let y = maxY; y >= minY - 1e-9; y -= 0.02) {
    const world = frame.toWorld({ x: localX, y });
    const candidate = { ...monitor, position: { ...monitor.position, x: world.x, y: world.y } };
    if (blockers.some(other => horizontalFootprintsOverlap(candidate, other))) continue;
    return world;
  }
  return null;
}

// The laptop covers a monitor: their widths overlap, and the laptop sits
// closer to the seat. A laptop beside the screens, or one used as the only
// keyboard, does not.
function laptopBlocksScreen(frame, laptop, monitor) {
  const laptopLocal = frame.toLocal(laptop.position);
  const monitorLocal = frame.toLocal(monitor.position);
  const overlap = Math.min(laptopLocal.x + laptop.scale.x / 2, monitorLocal.x + monitor.scale.x / 2)
    - Math.max(laptopLocal.x - laptop.scale.x / 2, monitorLocal.x - monitor.scale.x / 2);
  return overlap > 0.02 && laptopLocal.y < monitorLocal.y - 0.05;
}

function laptopBesideMonitors(frame, laptop, monitors, objects) {
  const ys = monitors.map(monitor => frame.toLocal(monitor.position).y + monitor.scale.y / 2);
  const y = Math.min(Math.max(...ys), frame.halfDepth - 0.06) - laptop.scale.y / 2;
  if (y - laptop.scale.y / 2 < -frame.halfDepth + 0.02) return null;
  const xs = monitors.flatMap(monitor => {
    const local = frame.toLocal(monitor.position);
    return [local.x - monitor.scale.x / 2, local.x + monitor.scale.x / 2];
  });
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  // Seat's left is +x. Try that side first, then the other.
  for (const x of [maxX + 0.08 + laptop.scale.x / 2, minX - 0.08 - laptop.scale.x / 2]) {
    if (Math.abs(x) + laptop.scale.x / 2 > frame.halfLength - 0.05) continue;
    const world = frame.toWorld({ x, y });
    const candidate = { ...laptop, position: { ...laptop.position, ...world } };
    const blocked = objects.some(other => other.id !== laptop.id && !isDesk(other)
      && horizontalFootprintsOverlap(candidate, other));
    if (!blocked) return world;
  }
  return null;
}

function hungStripFix(frame, strip, objects) {
  const localY = frame.halfDepth - strip.scale.y / 2 - 0.005;
  for (const localX of [0, 0.2, -0.2, 0.4, -0.4]) {
    const point = hungUnderDeskPosition(frame.desk, localX, localY, strip);
    const candidate = { ...strip, position: point, rotation: { ...strip.rotation, z: frame.desk.rotation?.z ?? 0 } };
    if (!isHungUnderDesk(candidate, frame.desk)) continue;
    const blocked = objects.some(other => other.id !== strip.id && !isDesk(other) && horizontalFootprintsOverlap(candidate, other)
      && Math.abs((other.position.z) - point.z) < (other.scale.z + strip.scale.z) / 2);
    if (blocked) continue;
    return move(strip, { x: point.x, y: point.y }, point.z);
  }
  return null;
}

export function analyzeLayoutHeuristics(room, rawObjects, rawConnections = []) {
  const objects = getRecordItems(rawObjects).filter(object => object?.position && object?.scale);
  const connections = getRecordItems(rawConnections);
  const frames = new Map(objects.filter(isDesk).map(desk => [desk.id, deskFrame(desk)]));
  const supportOf = new Map(objects.map(object => [object.id, findSupportingObject(object, objects)]));
  const deskUnder = object => {
    const seen = new Set();
    let currentId = object.id;
    while (currentId && !seen.has(currentId)) {
      seen.add(currentId);
      const support = supportOf.get(currentId);
      if (support?.kind !== 'object') return null;
      const frame = frames.get(support.id);
      if (frame) return frame;
      currentId = support.id;
    }
    return null;
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
          fix: [move(monitor, frame.toWorld({ x: 0, y: frame.halfDepth - monitor.scale.y / 2 - 0.06 }))],
        }));
      }
      continue;
    }
    if (!monitorsByDesk.has(frame)) monitorsByDesk.set(frame, []);
    monitorsByDesk.get(frame).push(monitor);
    const local = frame.toLocal(monitor.position);
    const nearestToSeat = local.y - monitor.scale.y / 2;
    if (nearestToSeat - frame.seatLocal.y < HEURISTIC_LIMITS.minViewingDistance) {
      const spot = clearMonitorSpot(frame, monitor, objects);
      hints.push(hint('monitor_too_close', [monitor.id], `${monitor.name}离座位太近。这条量的是座位到屏幕靠近人的那条边，不到 0.45 米`, spot ? {
        fix: [move(monitor, spot)],
      } : {}));
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

  // With a keyboard on the same desk the laptop is a screen, not something
  // to type on, so the back of the desk is fine.
  const keyboardDesks = new Set(objects.filter(isKeyboard).map(keyboard => deskUnder(keyboard)?.desk.id));
  for (const laptop of objects.filter(isLaptop)) {
    const frame = deskUnder(laptop);
    const local = frame?.toLocal(laptop.position);
    if (frame && local.y > 0 && !keyboardDesks.has(frame.desk.id)) {
      hints.push(hint('laptop_at_back', [laptop.id], `${laptop.name}放在桌子后面，打字够不着`, {
        fix: [move(laptop, frame.toWorld({ x: local.x, y: -frame.halfDepth + laptop.scale.y / 2 + 0.05 }))],
      }));
    }
    if (!frame || !keyboardDesks.has(frame.desk.id)) continue;
    const monitors = objects.filter(isMonitor).filter(monitor => deskUnder(monitor)?.desk.id === frame.desk.id);
    const blocking = monitors.filter(monitor => laptopBlocksScreen(frame, laptop, monitor));
    if (blocking.length === 0) continue;
    const spot = laptopBesideMonitors(frame, laptop, monitors, objects);
    if (!spot) continue;
    hints.push(hint('laptop_blocks_screen', [laptop.id], `${laptop.name}挡在屏幕前面，看着挤`, {
      fix: [move(laptop, spot)],
    }));
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

  for (const gameConsole of objects.filter(isConsole)) {
    const consoleFix = consoleFrame => {
      const spot = floorSpotBesideDesk(room, consoleFrame, gameConsole, SEAT_RIGHT);
      return spot ? { fix: [move(gameConsole, spot, gameConsole.scale.z / 2)] } : {};
    };
    const frame = deskUnder(gameConsole);
    if (frame && frame.inMiddle(frame.toLocal(gameConsole.position))) {
      hints.push(hint('console_on_desk', [gameConsole.id], `${gameConsole.name}占着桌面中间`, consoleFix(frame)));
    }
    if (onFloor(gameConsole)) {
      for (const floorFrame of frames.values()) {
        const local = floorFrame.toLocal(gameConsole.position);
        if (floorFrame.inMiddle(local) && floorFrame.underDesk(local)) {
          hints.push(hint('console_blocks_legroom', [gameConsole.id], `${gameConsole.name}挡住了桌下放腿的地方`, consoleFix(floorFrame)));
          break;
        }
      }
    }
  }

  for (const lamp of objects.filter(isLamp)) {
    const frame = deskUnder(lamp);
    if (frame && blocksFront(frame, lamp)) {
      hints.push(hint('lamp_blocks_work', [lamp.id], `${lamp.name}放在座位前面，写字时挡手`, {
        fix: [move(lamp, backCorner(frame, lamp, -SEAT_RIGHT))],
      }));
    }
  }

  for (const speakers of objects.filter(isSpeakers)) {
    const frame = deskUnder(speakers);
    if (frame && blocksFront(frame, speakers)) {
      hints.push(hint('speakers_block_seat', [speakers.id], `${speakers.name}放在座位前面，挡着手`, {
        fix: [move(speakers, backCorner(frame, speakers, SEAT_RIGHT))],
      }));
    }
  }

  for (const mouse of objects.filter(isMouse)) {
    const frame = deskUnder(mouse);
    if (!frame) continue;
    const keyboards = objects.filter(isKeyboard).filter(keyboard => deskUnder(keyboard)?.desk.id === frame.desk.id);
    if (keyboards.length === 0) continue;
    const mouseLocal = frame.toLocal(mouse.position);
    let nearest = null;
    let nearestDistance = Infinity;
    for (const keyboard of keyboards) {
      const local = frame.toLocal(keyboard.position);
      const distance = Math.hypot(mouseLocal.x - local.x, mouseLocal.y - local.y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = { keyboard, local };
      }
    }
    if (nearestDistance > HEURISTIC_LIMITS.mouseKeyboardDistance) {
      hints.push(hint('mouse_far_from_keyboard', [mouse.id], `${mouse.name}离键盘太远，手要挪很远才能点`, {
        fix: [move(mouse, frame.toWorld({
          x: nearest.local.x - (nearest.keyboard.scale.x / 2 + 0.04 + mouse.scale.x / 2),
          y: nearest.local.y - nearest.keyboard.scale.y / 2 + mouse.scale.y / 2,
        }))],
      }));
    }
  }

  for (const strip of objects.filter(isStrip)) {
    const onTop = deskUnder(strip);
    if (onTop) {
      const fix = hungStripFix(onTop, strip, objects);
      hints.push(hint('strip_on_desk', [strip.id], `${strip.name}放在桌面上，显得乱也容易碰到`, fix ? { fix: [fix] } : {}));
      continue;
    }
    if (!onFloor(strip) || frames.size === 0) continue;
    let nearest = null;
    for (const frame of frames.values()) {
      const local = frame.toLocal(strip.position);
      const distance = Math.hypot(local.x, local.y);
      if (!nearest || distance < nearest.distance) nearest = { frame, distance };
    }
    const fix = nearest && hungStripFix(nearest.frame, strip, objects);
    hints.push(hint('strip_on_floor', [strip.id], `${strip.name}放在地上，光脚容易踢到`, fix ? { fix: [fix] } : {}));
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
