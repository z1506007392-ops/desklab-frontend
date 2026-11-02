import { withPortAnchors } from './catalog.js';
import { getObjectBounds, horizontalFootprintsOverlap, objectsOverlap, validateAndConstrainObject } from './geometry.js';
import { createEntityId } from './identifiers.js';
import { findSupportingObject, snapWallOutletToNearestWall } from './layout-analysis.js';

const SEARCH_STEP = 0.05;
const DESK_EDGE_MARGIN = 0.05;
const DESK_SIDE_GAP = 0.05;
const BEHIND_DESK_GAP = 0.01;
const OUTLET_HEIGHT = 0.3;
const COPY_GAP = 0.05;
const SCREEN_GAP = 0.04; // between screens in a row, as the generator lays them

const isDeskTopDevice = (categoryId, modelTemplate) =>
  categoryId === 'display'
  || categoryId === 'accessory'
  || categoryId === 'entertainment'
  || categoryId === 'peripheral'
  || categoryId === 'audio'
  || categoryId === 'lighting'
  || modelTemplate.type === 'laptop';
// Keyboard, mouse and laptop go where the hands are: the half nearer the seat.
const prefersDeskFront = (categoryId, modelTemplate) =>
  categoryId === 'peripheral' || modelTemplate.type === 'laptop';
// Devices people look at or reach for face the seat, as the templates build
// them (scene-builder turns screens, the laptop and the PC by 180°). A
// device's front is its local +y; the seat is on the desk's -y side.
const FACES_SEAT = new Set(['display', 'computer', 'entertainment', 'peripheral', 'audio', 'lighting']);
const isWallOutlet = modelTemplate => modelTemplate.modelId === 'wall-outlet' || modelTemplate.type === 'outlet';
const isDesk = object => object.category === 'furniture';

function seatFacingRotation(objects) {
  const desk = Array.isArray(objects) ? objects.find(isDesk) : null;
  return (((desk?.rotation?.z ?? 0) + 180) % 360 + 360) % 360;
}

/**
 * Create a catalog object. With no existing objects it goes to the room
 * center. Otherwise it gets a free spot: monitors, laptops, keyboards, mice,
 * lamps and speakers on a desk top, wall outlets on the wall nearest the
 * desk, everything else on the floor spiralling out from the desk (or the
 * room center). Devices with a front face the desk's seat.
 */
export function placeCatalogObject({ modelTemplate, categoryId, room, id, objects = [] }) {
  const proposedObject = {
    id: id || createEntityId(modelTemplate.type),
    category: categoryId,
    type: modelTemplate.type,
    modelId: modelTemplate.modelId,
    name: modelTemplate.displayName,
    shape: modelTemplate.shape,
    assetUrl: modelTemplate.assetUrl,
    position: { x: 0, y: 0, z: modelTemplate.defaultScale.z / 2 },
    rotation: { x: 0, y: 0, z: FACES_SEAT.has(categoryId) ? seatFacingRotation(objects) : 0 },
    scale: { ...modelTemplate.defaultScale },
    color: modelTemplate.color,
    ports: withPortAnchors(
      modelTemplate.ports ? structuredClone(modelTemplate.ports) : [],
      modelTemplate.modelId,
    ),
  };

  const centered = validateAndConstrainObject(proposedObject, room);
  if (!centered.valid || !Array.isArray(objects) || objects.length === 0) return centered;

  const placed = findFreePlacement(centered.object, categoryId, modelTemplate, room, objects);
  return placed ? { valid: true, object: placed } : centered;
}

function fitsFreely(candidate, room, objects) {
  const constrained = validateAndConstrainObject(candidate, room);
  if (!constrained.valid) return false;
  const moved = ['x', 'y', 'z'].some(axis =>
    Math.abs(constrained.object.position[axis] - candidate.position[axis]) > 1e-6);
  return !moved && !objects.some(object => objectsOverlap(candidate, object));
}

function* spiralOffsets(maxRadius) {
  yield { dx: 0, dy: 0 };
  for (let radius = SEARCH_STEP * 2; radius <= maxRadius; radius += SEARCH_STEP * 2) {
    const steps = Math.max(8, Math.round((2 * Math.PI * radius) / (SEARCH_STEP * 2)));
    for (let step = 0; step < steps; step += 1) {
      const angle = (2 * Math.PI * step) / steps;
      yield { dx: radius * Math.cos(angle), dy: radius * Math.sin(angle) };
    }
  }
}

// The user sits on the desk's -y side (the default camera side), so "in front
// of the desk" means a smaller y than the desk's front edge.
function isInFrontOfDesk(candidate, deskBounds) {
  return candidate.position.y < deskBounds.minY;
}

// Where an object's footprint spans along the desk's own x axis (the line
// of screens), whatever the desk's or the object's turn.
function spanAlongDesk(object, frame) {
  const radians = ((object.rotation?.z ?? 0) * Math.PI) / 180;
  const halfX = object.scale.x / 2;
  const halfY = object.scale.y / 2;
  const xs = [[halfX, halfY], [halfX, -halfY], [-halfX, halfY], [-halfX, -halfY]].map(([a, b]) => frame.toLocal({
    x: object.position.x + a * Math.cos(radians) - b * Math.sin(radians),
    y: object.position.y + a * Math.sin(radians) + b * Math.cos(radians),
  }).x);
  return { min: Math.min(...xs), max: Math.max(...xs) };
}

// A screen should not hide behind another screen on the same desk: they
// share a column along the desk. With allowInFront, sharing a column is fine
// as long as the new screen is nearer the seat than every screen it lines up
// with. Measured in the desk's own frame, so a turned desk works too.
function blocksScreenView(candidate, desk, objects, allowInFront) {
  const frame = deskFrame(desk);
  const span = spanAlongDesk(candidate, frame);
  const candidateY = frame.toLocal(candidate.position).y;
  return objects.some(other => {
    if (other.category !== 'display' || !horizontalFootprintsOverlap(other, desk)) return false;
    const otherSpan = spanAlongDesk(other, frame);
    const sharesColumn = span.min < otherSpan.max - 1e-6 && span.max > otherSpan.min + 1e-6;
    return sharesColumn && !(allowInFront && candidateY < frame.toLocal(other.position).y);
  });
}

function findOnDesk(object, desk, room, objects, { preferFront, isScreen }) {
  const deskBounds = getObjectBounds(desk);
  const objectBounds = getObjectBounds(object);
  if (!deskBounds || !objectBounds) return null;
  const halfX = objectBounds.sizeX / 2;
  const halfY = objectBounds.sizeY / 2;
  const minX = deskBounds.minX + DESK_EDGE_MARGIN + halfX;
  const maxX = deskBounds.maxX - DESK_EDGE_MARGIN - halfX;
  const minY = deskBounds.minY + DESK_EDGE_MARGIN + halfY;
  const maxY = deskBounds.maxY - DESK_EDGE_MARGIN - halfY;
  if (minX > maxX || minY > maxY) return null;

  const z = deskBounds.maxZ + objectBounds.sizeZ / 2;
  const rowYs = [];
  for (let y = preferFront ? minY : maxY; preferFront ? y <= maxY + 1e-9 : y >= minY - 1e-9; y += preferFront ? SEARCH_STEP : -SEARCH_STEP) {
    rowYs.push(y);
  }
  const centerX = (minX + maxX) / 2;
  const columnXs = [centerX];
  for (let offset = SEARCH_STEP; centerX + offset <= maxX + 1e-9 || centerX - offset >= minX - 1e-9; offset += SEARCH_STEP) {
    if (centerX + offset <= maxX + 1e-9) columnXs.push(centerX + offset);
    if (centerX - offset >= minX - 1e-9) columnXs.push(centerX - offset);
  }

  // Screens first try a column of their own, then a spot in front of others.
  for (const allowInFront of isScreen ? [false, true] : [true]) {
    for (const y of rowYs) {
      for (const x of columnXs) {
        const candidate = { ...object, position: { ...object.position, x, y, z } };
        if (isScreen && blocksScreenView(candidate, desk, objects, allowInFront)) continue;
        if (horizontalFootprintsOverlap(candidate, desk) && fitsFreely(candidate, room, objects)) return candidate;
      }
    }
  }
  return null;
}

function* besideDeskPositions(object, deskBounds) {
  const bounds = getObjectBounds(object);
  const halfX = bounds.sizeX / 2;
  const halfY = bounds.sizeY / 2;
  // Behind the desk first (strips and adapters fit in the gap to the wall)...
  const behindY = deskBounds.maxY + BEHIND_DESK_GAP + halfY;
  const centerX = (deskBounds.minX + deskBounds.maxX) / 2;
  for (let offset = 0; offset <= (deskBounds.maxX - deskBounds.minX) / 2; offset += SEARCH_STEP) {
    yield { x: centerX + offset, y: behindY };
    if (offset > 0) yield { x: centerX - offset, y: behindY };
  }
  // ...then along the desk's two sides, from the back toward the front.
  for (const x of [deskBounds.maxX + DESK_SIDE_GAP + halfX, deskBounds.minX - DESK_SIDE_GAP - halfX]) {
    for (let y = deskBounds.maxY + BEHIND_DESK_GAP + halfY; y - halfY >= deskBounds.minY - 1e-9; y -= SEARCH_STEP) {
      yield { x, y };
    }
  }
}

function findOnFloor(object, reference, room, objects, desk) {
  const z = object.scale.z / 2;
  const deskBounds = desk ? getObjectBounds(desk) : null;
  if (deskBounds) {
    for (const { x, y } of besideDeskPositions(object, deskBounds)) {
      const candidate = { ...object, position: { ...object.position, x, y, z } };
      if (fitsFreely(candidate, room, objects)) return candidate;
    }
  }
  const maxRadius = Math.hypot(room.length, room.width);
  let inFront = null;
  for (const { dx, dy } of spiralOffsets(maxRadius)) {
    const candidate = { ...object, position: { ...object.position, x: reference.x + dx, y: reference.y + dy, z } };
    if (!fitsFreely(candidate, room, objects)) continue;
    if (deskBounds && isInFrontOfDesk(candidate, deskBounds)) {
      inFront ??= candidate;
      continue;
    }
    return candidate;
  }
  return inFront;
}

function findOnWall(object, reference, room, objects) {
  const maxOffset = Math.max(room.length, room.width);
  for (let offset = 0; offset <= maxOffset; offset += SEARCH_STEP * 2) {
    for (const sign of offset === 0 ? [1] : [1, -1]) {
      const proposed = { ...object, position: { x: reference.x + sign * offset, y: reference.y, z: OUTLET_HEIGHT } };
      const snapped = snapWallOutletToNearestWall(room, proposed);
      if (snapped && fitsFreely(snapped, room, objects)) return snapped;
    }
  }
  return null;
}

function findOnStand(object, stand, room, objects) {
  const standBounds = getObjectBounds(stand);
  if (!standBounds) return null;
  const candidate = {
    ...object,
    position: {
      x: stand.position.x,
      y: stand.position.y,
      z: standBounds.maxZ + object.scale.z / 2,
    },
  };
  return fitsFreely(candidate, room, objects) ? candidate : null;
}

// Where these go on (or beside) the first desk, in the desk's own frame, the
// way the desk generator lays them out (scene-builder.js): the keyboard in
// front of the seat, the mouse to the keyboard's right, the lamp in the back
// corner on the seat's left and the speakers in the one on its right (then
// the other corner, then halfway along a side), a console on the floor on
// the seat's right. Right is as seen from the seat in the 3D view, which
// mirrors project x, so the right hand is the desk's local -x.
const SEAT_RIGHT = -1;
const FRONT_MARGIN = 0.06;
const ROW_GAP = 0.06;
const CORNER_MARGIN = 0.05;

function deskFrame(desk) {
  const radians = ((desk.rotation?.z ?? 0) * Math.PI) / 180;
  const axisX = { x: Math.cos(radians), y: Math.sin(radians) };
  const axisY = { x: -Math.sin(radians), y: Math.cos(radians) };
  return {
    halfX: desk.scale.x / 2,
    halfY: desk.scale.y / 2,
    top: desk.position.z + desk.scale.z / 2,
    toWorld: (x, y) => ({ x: desk.position.x + axisX.x * x + axisY.x * y, y: desk.position.y + axisX.y * x + axisY.y * y }),
    toLocal: point => {
      const dx = point.x - desk.position.x;
      const dy = point.y - desk.position.y;
      return { x: dx * axisX.x + dy * axisX.y, y: dx * axisY.x + dy * axisY.y };
    },
  };
}

function preferredSpots(modelTemplate, frame, objects) {
  const { x: width, y: depth } = modelTemplate.defaultScale;
  const front = -frame.halfY + FRONT_MARGIN + depth / 2;
  const back = frame.halfY - CORNER_MARGIN - depth / 2;
  const side = sign => sign * (frame.halfX - CORNER_MARGIN - width / 2);
  const corners = first => [[side(first), back], [side(-first), back], [side(first), 0], [side(-first), 0]];
  switch (modelTemplate.modelId) {
    case 'keyboard':
      return [[0, front, 'desk']];
    case 'mouse': {
      const keyboard = objects.find(object => object.modelId === 'keyboard');
      const local = keyboard && frame.toLocal(keyboard.position);
      const nextTo = keyboard && Math.abs(local.x) <= frame.halfX && Math.abs(local.y) <= frame.halfY
        ? { x: local.x, y: local.y, half: keyboard.scale.x / 2 }
        : { x: 0, y: front, half: 0.22 };
      return [[nextTo.x + SEAT_RIGHT * (nextTo.half + ROW_GAP + width / 2), nextTo.y, 'desk']];
    }
    case 'desk-lamp':
      return corners(-SEAT_RIGHT).map(([x, y]) => [x, y, 'desk']);
    case 'speakers':
      return corners(SEAT_RIGHT).map(([x, y]) => [x, y, 'desk']);
    case 'game-console':
      return [SEAT_RIGHT, -SEAT_RIGHT].map(sign => [sign * (frame.halfX + DESK_SIDE_GAP + width / 2), 0, 'floor']);
    default:
      return [];
  }
}

function findPreferredSpot(object, modelTemplate, desk, room, objects) {
  const frame = deskFrame(desk);
  const { x: width, y: depth } = modelTemplate.defaultScale;
  for (const [x, y, level] of preferredSpots(modelTemplate, frame, objects)) {
    // On the desk means wholly on its top, not hanging over an edge.
    if (level === 'desk' && (Math.abs(x) + width / 2 > frame.halfX + 1e-9 || Math.abs(y) + depth / 2 > frame.halfY + 1e-9)) continue;
    const z = level === 'desk' ? frame.top + object.scale.z / 2 : object.scale.z / 2;
    const candidate = { ...object, position: { ...frame.toWorld(x, y), z } };
    if (fitsFreely(candidate, room, objects)) return candidate;
  }
  return null;
}

// Wholly on top of the same thing as the original (the same desk or stand),
// or on the floor like it; a copy half hanging off the desk does not count.
function restsLike(candidate, support, objects) {
  if (!support) return false;
  const now = findSupportingObject(candidate, objects);
  if (now?.kind !== support.kind || now?.id !== support.id) return false;
  if (support.kind !== 'object') return true;
  const under = getObjectBounds(objects.find(object => object.id === support.id));
  const bounds = getObjectBounds(candidate);
  return Boolean(under && bounds)
    && bounds.minX >= under.minX - 1e-6 && bounds.maxX <= under.maxX + 1e-6
    && bounds.minY >= under.minY - 1e-6 && bounds.maxY <= under.maxY + 1e-6;
}

/**
 * Where a copy of `original` goes: right beside it (side by side, then in
 * front or behind except for screens, then a step further), on the same surface (the same
 * desk, stand or floor; an outlet stays on a wall) and clear of everything.
 * When nothing near is free, the copy gets a place the way a device added
 * from the library would, at its own size. Returns the positioned copy, or
 * null when it fits nowhere.
 */
export function placeCopy(original, copy, room, objects) {
  const bounds = getObjectBounds(original);
  if (!bounds) return null;
  const isOutlet = isWallOutlet(original);
  const support = findSupportingObject(original, objects);
  const stepX = bounds.sizeX + COPY_GAP;
  const stepY = bounds.sizeY + COPY_GAP;
  // A screen in front of or behind another hides it, so a screen copy only
  // goes side by side; otherwise the library's screen-aware search decides.
  const isScreen = copy.category === 'display';
  for (const k of [1, 2]) {
    const offsets = [[k * stepX, 0], [-k * stepX, 0], ...(isScreen ? [] : [[0, -k * stepY], [0, k * stepY]])];
    for (const [dx, dy] of offsets) {
      let candidate = { ...copy, position: { ...original.position, x: original.position.x + dx, y: original.position.y + dy } };
      if (isOutlet) candidate = snapWallOutletToNearestWall(room, candidate);
      if (!candidate || !fitsFreely(candidate, room, objects)) continue;
      if (!isOutlet && !restsLike(candidate, support, objects)) continue;
      return candidate;
    }
  }
  const asTemplate = { modelId: copy.modelId, type: copy.type, defaultScale: { ...copy.scale } };
  return findFreePlacement(copy, copy.category, asTemplate, room, objects);
}

/**
 * Whether a screen would hide, or be hidden by, another screen on the first
 * desk: the two share a column (one stands in front of the other).
 */
export function hidesAnotherScreen(screen, objects) {
  const desk = objects.find(isDesk);
  if (!desk || screen.category !== 'display') return false;
  return blocksScreenView(screen, desk, objects.filter(object => object.id !== screen.id), false);
}

/**
 * Line up the screens standing on the first desk with a new one, the way the
 * generator does: a centred row in their present left-to-right order as seen
 * from the seat, the new screen at the right-hand end, each existing screen
 * keeping its distance from the back and the new one taking the first's.
 * For a new screen that would otherwise hide another. Returns
 * { screen, moved: [{ id, position }] }, or null when the row does not fit
 * on the desk, a screen is turned at an odd angle, or the row would run into
 * something else.
 */
export function lineUpScreens(screen, room, objects) {
  const desk = objects.find(isDesk);
  if (!desk) return null;
  const frame = deskFrame(desk);
  const standing = objects.filter(object => {
    if (object.category !== 'display' || object.id === screen.id) return false;
    const support = findSupportingObject(object, objects);
    return support?.kind === 'object' && support.id === desk.id;
  });
  if (standing.length === 0) return null;
  const square = object => {
    const turn = ((((object.rotation?.z ?? 0) - (desk.rotation?.z ?? 0)) % 180) + 180) % 180;
    return turn < 1 || turn > 179;
  };
  if (![...standing, screen].every(square)) return null;

  // Seen from the seat, the left is the desk's local +x.
  const ordered = [...standing].sort((a, b) => frame.toLocal(b.position).x - frame.toLocal(a.position).x);
  const row = [...ordered, screen];
  const total = row.reduce((sum, object) => sum + object.scale.x, 0) + SCREEN_GAP * (row.length - 1);
  if (total > 2 * (frame.halfX - DESK_EDGE_MARGIN) + 1e-9) return null;

  const backY = frame.toLocal(ordered[0].position).y;
  let cursor = total / 2;
  const placed = row.map(object => {
    const x = cursor - object.scale.x / 2;
    cursor -= object.scale.x + SCREEN_GAP;
    const y = object === screen ? backY : frame.toLocal(object.position).y;
    const z = object === screen ? frame.top + object.scale.z / 2 : object.position.z;
    return { ...object, position: { ...frame.toWorld(x, y), z } };
  });
  const others = objects.filter(object => !row.some(item => item.id === object.id));
  if (!placed.every(candidate => fitsFreely(candidate, room, others))) return null;
  return {
    screen: placed[placed.length - 1],
    moved: placed.slice(0, -1).map(object => ({ id: object.id, position: object.position })),
  };
}

function findFreePlacement(object, categoryId, modelTemplate, room, objects) {
  const desks = objects.filter(isDesk);
  const reference = desks[0]?.position ?? { x: 0, y: 0 };

  if (desks[0]) {
    const preferred = findPreferredSpot(object, modelTemplate, desks[0], room, objects);
    if (preferred) return preferred;
  }

  if (categoryId === 'display') {
    for (const stand of objects.filter(item => item.modelId === 'monitor-stand')) {
      const onStand = findOnStand(object, stand, room, objects);
      if (onStand) return onStand;
    }
  }
  if (isWallOutlet(modelTemplate)) {
    // Toward the wall behind the desk: start from the desk's far edge.
    const deskBounds = desks[0] ? getObjectBounds(desks[0]) : null;
    const start = deskBounds ? { x: reference.x, y: deskBounds.maxY } : reference;
    return findOnWall(object, start, room, objects);
  }
  if (isDeskTopDevice(categoryId, modelTemplate)) {
    for (const desk of desks) {
      const onDesk = findOnDesk(object, desk, room, objects, {
        preferFront: prefersDeskFront(categoryId, modelTemplate),
        isScreen: categoryId === 'display',
      });
      if (onDesk) return onDesk;
    }
  }
  return findOnFloor(object, reference, room, objects, desks[0]);
}
