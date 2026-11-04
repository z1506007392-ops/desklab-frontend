import { getRotatedFootprint } from './geometry.js';
import { followStorageWrite } from './storage-write.js';
import { isDesk } from './desks.js';
import { findSupportingObject } from './layout-analysis.js';
import { HEURISTIC_LIMITS } from './layout-heuristics.js';
import { getRecordItems } from './record-collections.js';

// Local eye height (E99). OSHA's monitor eTool is the source of the ranges
// below: top of the screen at or below eye level, eyes about 50–100 cm from
// the screen, centre usually 15–20° below horizontal, bifocals lower and tilt.
// https://www.osha.gov/etools/computer-workstations/components/monitors
// Nothing here moves a device, adds a chair, or leaves this machine.

export const EYE_HEIGHT_STORAGE_KEY = 'desklab.eye-height.v1';
export const EYE_HEIGHT_MIN_METRES = 0.5;
export const EYE_HEIGHT_MAX_METRES = 2.2;
export const OSHA_EYE_TO_SCREEN_MIN_METRES = 0.5;
export const OSHA_EYE_TO_SCREEN_MAX_METRES = 1;
export const OSHA_CENTER_BELOW_MIN_DEGREES = 15;

const MONITOR_MODELS = new Set(['monitor-24', 'monitor-27', 'ultrawide-monitor']);
const isScreen = object => MONITOR_MODELS.has(object.modelId)
  || object.type === 'monitor'
  || object.modelId === 'laptop-15'
  || object.type === 'laptop';

export function emptyEyeProfile() {
  return { eyeHeightMetres: null, posture: 'sitting', bifocals: false };
}

/** null clears the height, undefined rejects it, a number is metres to the centimetre. */
export function normalizeEyeHeight(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return undefined;
  const rounded = Math.round(number * 100) / 100;
  if (rounded < EYE_HEIGHT_MIN_METRES || rounded > EYE_HEIGHT_MAX_METRES) return undefined;
  return rounded;
}

export function parseEyeProfile(raw) {
  const empty = emptyEyeProfile();
  if (typeof raw !== 'string' || raw.length === 0) return empty;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1) return empty;
    const eyeHeightMetres = normalizeEyeHeight(parsed.eyeHeightMetres);
    return {
      eyeHeightMetres: eyeHeightMetres === undefined ? null : eyeHeightMetres,
      posture: parsed.posture === 'standing' ? 'standing' : 'sitting',
      bifocals: parsed.bifocals === true,
    };
  } catch {
    return empty;
  }
}

export function readEyeProfile(storage) {
  try {
    return parseEyeProfile(storage?.getItem(EYE_HEIGHT_STORAGE_KEY));
  } catch {
    return emptyEyeProfile();
  }
}

export function writeEyeProfile(storage, profile) {
  try {
    const clean = {
      eyeHeightMetres: normalizeEyeHeight(profile?.eyeHeightMetres) ?? null,
      posture: profile?.posture === 'standing' ? 'standing' : 'sitting',
      bifocals: profile?.bifocals === true,
    };
    const pending = clean.eyeHeightMetres === null && clean.posture === 'sitting' && !clean.bifocals
      ? storage.removeItem(EYE_HEIGHT_STORAGE_KEY)
      : storage.setItem(EYE_HEIGHT_STORAGE_KEY, JSON.stringify({ version: 1, ...clean }));
    return followStorageWrite(pending, () => true, () => false);
  } catch {
    return false;
  }
}

function centimetres(metres) {
  return Math.round(metres * 100);
}

function postureWord(posture) {
  return posture === 'standing' ? '站着' : '坐着';
}

function deskUnder(object, objects) {
  const seen = new Set();
  let current = object;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    const support = findSupportingObject(current, objects);
    if (support?.kind !== 'object') return null;
    const next = objects.find(item => item.id === support.id);
    if (!next) return null;
    if (isDesk(next)) return next;
    current = next;
  }
  return null;
}

function toDeskLocal(desk, point) {
  const radians = ((desk.rotation?.z ?? 0) * Math.PI) / 180;
  const axisX = { x: Math.cos(radians), y: Math.sin(radians) };
  const axisY = { x: -Math.sin(radians), y: Math.cos(radians) };
  const dx = point.x - desk.position.x;
  const dy = point.y - desk.position.y;
  return { x: dx * axisX.x + dy * axisX.y, y: dx * axisY.x + dy * axisY.y };
}

function screenOnDesk(screen, desk) {
  const local = toDeskLocal(desk, screen.position);
  const depth = getRotatedFootprint(
    screen.scale,
    (screen.rotation?.z ?? 0) - (desk.rotation?.z ?? 0),
  ).sizeY;
  const nearEdge = local.y - depth / 2;
  const seatY = -(desk.scale.y / 2 + HEURISTIC_LIMITS.seatDistance);
  const horizontal = nearEdge - seatY;
  const top = screen.position.z + screen.scale.z / 2;
  const center = screen.position.z;
  return { screen, desk, localX: local.x, horizontal, top, center };
}

function quote(name) {
  const text = String(name || '屏幕').trim() || '屏幕';
  return `「${text}」`;
}

/**
 * One sentence. The 0.45 m hint stays elsewhere: that one measures the seat
 * point to the near edge of the screen, and this one measures the eye.
 */
export function eyeHeightAdvice(project, profile) {
  const height = normalizeEyeHeight(profile?.eyeHeightMetres);
  if (height === undefined || height === null) {
    return '填上眼睛离地多高之后，这里会说一句。数字只留在这台设备里，不会上传，也不会自动挪屏幕。';
  }
  const posture = profile?.posture === 'standing' ? 'standing' : 'sitting';
  const bifocals = profile?.bifocals === true;
  const lead = `按你${postureWord(posture)}、眼睛离地 ${centimetres(height)} 厘米来看，`;
  const objects = getRecordItems(project?.objects).filter(object => object?.position && object?.scale);
  const placed = objects
    .filter(isScreen)
    .map(screen => {
      const desk = deskUnder(screen, objects);
      return desk ? screenOnDesk(screen, desk) : null;
    })
    .filter(Boolean)
    .sort((first, second) => Math.abs(first.localX) - Math.abs(second.localX) || second.top - first.top);
  const view = placed[0];
  if (!view) return `${lead}当前没有放在桌面上的屏幕，所以还没法比较。`;

  const name = quote(view.screen.name);
  const horizontal = Number.isFinite(view.horizontal) ? Math.max(view.horizontal, 0) : 0;
  const drop = height - view.center;
  const distance = Math.hypot(horizontal, drop);
  const angle = Math.atan2(drop, Math.max(horizontal, 0.05)) * 180 / Math.PI;
  const topAboveEye = view.top > height + 0.005;

  if (topAboveEye) {
    const bifocal = bifocals ? '，戴双光眼镜还要再放低一些并朝上倾一点' : '';
    return `${lead}${name}的上沿高过眼睛，常见做法是上沿在眼睛高度或略低${bifocal}。`;
  }
  if (distance < OSHA_EYE_TO_SCREEN_MIN_METRES) {
    return `${lead}眼睛到${name}大约 ${centimetres(distance)} 厘米，比常见的 50 厘米近。这量的是眼睛到屏幕，座位到屏幕近边不到 0.45 米是另一条。`;
  }
  if (distance > OSHA_EYE_TO_SCREEN_MAX_METRES) {
    return `${lead}眼睛到${name}大约 ${centimetres(distance)} 厘米，比常见的 100 厘米远。`;
  }
  if (bifocals && angle < OSHA_CENTER_BELOW_MIN_DEGREES) {
    return `${lead}${name}差不多是平视的，戴双光眼镜可以把屏幕再放低一些并朝上倾一点。`;
  }
  return `${lead}${name}的上沿没有高过眼睛，眼睛到屏幕大约 ${centimetres(distance)} 厘米，落在常见的 50 到 100 厘米里。`;
}
