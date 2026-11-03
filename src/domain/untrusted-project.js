import { isSafeModelAssetUrl } from './safe-model-url.js';

// Caps for a desk that arrived from outside this browser: a share-link hash
// or an imported / pasted backup. The person's own save is not run through
// this. Numbers are far above a real room (templates are a handful of
// devices; a 100 m room already exists in tests) and still small enough that
// one file cannot freeze the page.
export const UNTRUSTED_PROJECT_LIMITS = Object.freeze({
  maxObjects: 400,
  maxConnections: 2000,
  maxPorts: 48,
  maxText: 4096,
  maxRoom: 1000,
  maxAbsCoord: 10000,
  maxAbsRotation: 100000,
  maxPower: 1e7,
});

function withoutControls(value) {
  let out = '';
  for (const char of value) {
    const code = char.charCodeAt(0);
    const hidden = code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127;
    if (!hidden) out += char;
  }
  return out;
}
const SAFE_COLOR = /^(?:#[0-9a-fA-F]{3}|#[0-9a-fA-F]{4}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|[a-zA-Z]{3,20})$/;

export function untrustedProjectError(code) {
  const error = new Error(code === 'too_big'
    ? '导入的内容太大'
    : '导入的内容里有不能使用的文字或地址');
  error.code = code === 'too_big' ? 'too_big' : 'unsafe';
  return error;
}

function cleanText(value, { allowBlank = false } = {}) {
  if (typeof value !== 'string') throw untrustedProjectError('unsafe');
  if (value.length > UNTRUSTED_PROJECT_LIMITS.maxText) throw untrustedProjectError('too_big');
  const cleaned = withoutControls(value).replaceAll('<', '＜').replaceAll('>', '＞');
  if (cleaned.trim().length === 0) {
    // A blank device name is allowed by the project file. A name made only of
    // control characters is not: it would look empty and can hide a payload.
    if (allowBlank && value.trim().length === 0) return value;
    throw untrustedProjectError('unsafe');
  }
  return cleaned;
}

function assignText(object, field, options) {
  if (object[field] == null) return object;
  const cleaned = cleanText(object[field], options);
  if (cleaned === object[field]) return object;
  return { ...object, [field]: cleaned };
}

function checkAbs(value, limit) {
  if (Math.abs(value) > limit) throw untrustedProjectError('too_big');
}

function screenVector(vector, limit) {
  checkAbs(vector.x, limit);
  checkAbs(vector.y, limit);
  checkAbs(vector.z, limit);
}

function screenObject(object, limits) {
  if (!object?.position || !object.rotation || !object.scale) throw untrustedProjectError('unsafe');
  let next = object;
  for (const field of ['id', 'type', 'shape', 'category', 'modelId']) {
    next = assignText(next, field);
  }
  next = assignText(next, 'name', { allowBlank: true });
  if (next.color != null && (typeof next.color !== 'string' || !SAFE_COLOR.test(next.color))) {
    throw untrustedProjectError('unsafe');
  }
  screenVector(next.position, limits.maxAbsCoord);
  screenVector(next.rotation, limits.maxAbsRotation);
  for (const axis of ['x', 'y', 'z']) {
    if (next.scale[axis] > limits.maxRoom) throw untrustedProjectError('too_big');
  }
  if (next.wattage != null && next.wattage > limits.maxPower) throw untrustedProjectError('too_big');
  if (next.maxLoad != null && next.maxLoad > limits.maxPower) throw untrustedProjectError('too_big');
  if (Array.isArray(next.ports)) {
    if (next.ports.length > limits.maxPorts) throw untrustedProjectError('too_big');
    const ports = next.ports.map(port => {
      let clean = port;
      for (const field of ['id', 'name', 'type']) clean = assignText(clean, field);
      return clean;
    });
    if (ports.some((port, index) => port !== next.ports[index])) next = { ...next, ports };
  }
  if (next.assetUrl != null && !isSafeModelAssetUrl(next.assetUrl)) {
    next = { ...next, assetUrl: null };
  }
  return next;
}

function screenConnection(connection) {
  let next = connection;
  for (const field of ['id', 'name', 'fromObjectId', 'toObjectId', 'fromPortId', 'toPortId']) {
    next = assignText(next, field);
  }
  return next;
}

/**
 * A normalized project that came from a share link or a file. Returns the
 * same object when nothing was dangerous. Replaces angle brackets so a name
 * cannot be read as HTML, and drops model URLs that are not a catalog file
 * on this site. Throws when the desk is absurdly large.
 */
export function screenUntrustedProject(project, limits = UNTRUSTED_PROJECT_LIMITS) {
  if (!project || typeof project !== 'object' || !Array.isArray(project.objects) || !project.room) {
    throw untrustedProjectError('unsafe');
  }
  if (project.objects.length > limits.maxObjects) throw untrustedProjectError('too_big');
  for (const dimension of ['length', 'width', 'height']) {
    if (project.room[dimension] > limits.maxRoom) throw untrustedProjectError('too_big');
  }
  if (project.camera) {
    screenVector(project.camera.position, limits.maxAbsCoord);
    screenVector(project.camera.target, limits.maxAbsCoord);
  }
  const objects = project.objects.map(object => screenObject(object, limits));
  let connections = project.connections;
  if (Array.isArray(connections)) {
    if (connections.length > limits.maxConnections) throw untrustedProjectError('too_big');
    connections = connections.map(screenConnection);
  }
  const objectsChanged = objects.some((object, index) => object !== project.objects[index]);
  const connectionsChanged = Array.isArray(project.connections)
    && connections.some((connection, index) => connection !== project.connections[index]);
  if (!objectsChanged && !connectionsChanged) return project;
  const clean = { ...project, objects };
  if (connectionsChanged) clean.connections = connections;
  return clean;
}
