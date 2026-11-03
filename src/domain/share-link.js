import { DEVICE_CATALOG, hydrateProjectObjects } from './catalog.js';
import { normalizeProject } from './local-project-store.js';
import { MAX_PROJECT_IMPORT_BYTES } from './project-import-limits.js';
import { screenUntrustedProject } from './untrusted-project.js';

// The hash is `#desklab-share-<version>.<payload>`, the payload gzipped, then
// base64url. Version 1 is the same project JSON an imported backup has to
// pass. Version 2 packs it first (packProject) so an ordinary desk fits in a
// WeChat-sized link; version 1 links still open.
export const SHARE_LINK_VERSION = 2;
export const SHARE_LINK_PREFIX = `#desklab-share-${SHARE_LINK_VERSION}.`;
const READABLE_VERSIONS = new Set([1, 2]);

// WeChat's in-app browser, and some chat apps, drop or refuse a link longer
// than about 2000 characters. Desktop browsers allow much more. Past this
// length the app still copies the link, and tells the person it may not open.
export const SHARE_LINK_WARN_LENGTH = 2000;

export const SHARE_LINK_MESSAGES = Object.freeze({
  damaged: '分享链接已损坏，打不开。已打开你自己的桌面。',
  unsupported: '这个分享链接的版本较新，当前页面打不开。已打开你自己的桌面。',
  tooBig: '分享链接里的数据太大，打不开。已打开你自己的桌面。',
});

const HASH_PATTERN = /^#desklab-share-(\d+)\.([A-Za-z0-9_-]*)$/;

// base64url uses 4 characters for 3 bytes. Refuse a longer hash before
// allocating the decoded buffer. `#desklab-share-` is 15 characters; the
// version is only one or two digits in practice, so a few extra are enough.
function payloadCharLimit(maxBytes) {
  return Math.ceil((maxBytes * 4) / 3);
}

export async function encodeShareLink(project, locationLike) {
  const bytes = new TextEncoder().encode(JSON.stringify(packProject(project)));
  const compressed = await gzip(bytes);
  const hash = `${SHARE_LINK_PREFIX}${bytesToBase64Url(compressed)}`;
  const url = sharePageUrl(locationLike, hash);
  return { url, hash, tooLong: url.length > SHARE_LINK_WARN_LENGTH };
}

export async function decodeShareLink(hash, { maxBytes = MAX_PROJECT_IMPORT_BYTES } = {}) {
  if (typeof hash !== 'string' || hash.length === 0 || hash === '#') return { kind: 'absent' };
  if (!hash.startsWith('#desklab-share-')) return { kind: 'absent' };
  const payloadLimit = payloadCharLimit(maxBytes);
  if (hash.length > 15 + 3 + 1 + payloadLimit) return { kind: 'tooBig' };
  const match = HASH_PATTERN.exec(hash);
  if (!match || match[2].length === 0) return { kind: 'damaged' };
  if (match[2].length > payloadLimit) return { kind: 'tooBig' };
  const version = Number(match[1]);
  if (!READABLE_VERSIONS.has(version)) return { kind: 'unsupported' };
  try {
    const compressed = base64UrlToBytes(match[2]);
    if (compressed.byteLength > maxBytes) return { kind: 'tooBig' };
    const jsonBytes = await gunzip(compressed, maxBytes);
    const payload = JSON.parse(new TextDecoder().decode(jsonBytes));
    const project = screenUntrustedProject(normalizeProject(version === 1 ? payload : unpackProject(payload)));
    return { kind: 'ok', project };
  } catch (error) {
    if (error?.message === 'too big' || error?.code === 'too_big') return { kind: 'tooBig' };
    return { kind: 'damaged' };
  }
}

// Version 2 payload. A catalog device keeps only what the catalog cannot
// give back: model, place, turn, and anything the user changed (name, size,
// other fields, edited ports). Opening the link rebuilds the rest exactly as
// a fresh device of that model, ports and anchors included, the same ones
// the app's hydrateProjectObjects gives a saved device. Connections point at devices by list position,
// and ids are given anew. Lengths are kept to the millimetre.
const CATALOG = new Map(DEVICE_CATALOG.flatMap(({ category, models }) =>
  models.map(model => [model.modelId, { model, category }])));
const RESTORED_FIELDS = ['type', 'category', 'shape', 'color', 'assetUrl'];
// Fields a version-2 link may override. Anything else in the packed "x"
// object (a different name, id, or __proto__) is ignored.
const PACKED_CHANGE_FIELDS = [...RESTORED_FIELDS, 'wattage', 'maxLoad'];

const round = (value, places = 3) => Number(value.toFixed(places)) || 0;
const packVector = ({ x, y, z }) => [round(x), round(y), round(z)];
const unpackVector = ([x, y, z]) => ({ x, y, z });
const sameVector = (vector, other) => ['x', 'y', 'z'].every(axis => round(vector[axis]) === round(other[axis]));

function catalogBase({ model, category }) {
  return {
    type: model.type,
    category,
    modelId: model.modelId,
    shape: model.shape,
    color: model.color,
    assetUrl: model.assetUrl,
  };
}

function restoredPorts(base) {
  return hydrateProjectObjects([{ ...base, ports: [] }])[0].ports;
}

function packObject(object) {
  const entry = CATALOG.get(object.modelId);
  if (!entry) return { f: object };
  const { model } = entry;
  const base = catalogBase(entry);
  const packed = { m: model.modelId, p: packVector(object.position) };
  if (object.name !== model.displayName) packed.n = object.name;
  if (object.rotation.x || object.rotation.y) packed.r = packVector(object.rotation);
  else if (round(object.rotation.z, 2)) packed.a = round(object.rotation.z, 2);
  if (!sameVector(object.scale, model.defaultScale)) packed.s = packVector(object.scale);
  const changed = {};
  for (const field of [...RESTORED_FIELDS, 'wattage', 'maxLoad']) {
    if (object[field] !== undefined && object[field] !== base[field]) changed[field] = object[field];
  }
  if (Array.isArray(object.ports) && JSON.stringify(object.ports) !== JSON.stringify(restoredPorts(base))) {
    changed.ports = object.ports;
  }
  if (Object.keys(changed).length > 0) packed.x = changed;
  return packed;
}

function applyPackedChanges(object, changed) {
  if (!changed || typeof changed !== 'object' || Array.isArray(changed)) return object;
  const out = { ...object };
  for (const field of PACKED_CHANGE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(changed, field)) out[field] = changed[field];
  }
  if (Array.isArray(changed.ports)) out.ports = changed.ports;
  return out;
}

function unpackObject(packed, index) {
  const id = `shared-${index + 1}`;
  if (packed.f) return { ...packed.f, id };
  const entry = CATALOG.get(packed.m);
  if (!entry) throw new Error('unknown device');
  const { model } = entry;
  const base = catalogBase(entry);
  if (packed.n !== undefined && typeof packed.n !== 'string') throw new Error('bad name');
  return applyPackedChanges({
    ...base,
    ports: restoredPorts(base),
    id,
    name: packed.n ?? model.displayName,
    position: unpackVector(packed.p),
    rotation: packed.r ? unpackVector(packed.r) : { x: 0, y: 0, z: packed.a ?? 0 },
    scale: packed.s ? unpackVector(packed.s) : { ...model.defaultScale },
  }, packed.x);
}

export function packProject(project) {
  const clean = normalizeProject(project);
  const position = new Map(clean.objects.map((object, index) => [object.id, index]));
  const packed = {
    r: [clean.room.length, clean.room.width, clean.room.height],
    o: clean.objects.map(packObject),
    c: (clean.connections ?? []).map(connection => [
      position.get(connection.fromObjectId) ?? -1, connection.fromPortId ?? null,
      position.get(connection.toObjectId) ?? -1, connection.toPortId ?? null,
      connection.cableType, round(connection.length), connection.name,
    ]),
  };
  if (clean.camera) packed.v = [...packVector(clean.camera.position), ...packVector(clean.camera.target)];
  return packed;
}

export function unpackProject(packed) {
  const [length, width, height] = packed.r;
  const objects = packed.o.map(unpackObject);
  const project = {
    room: { length, width, height },
    objects,
    connections: packed.c.map(([from, fromPortId, to, toPortId, cableType, cableLength, name], index) => {
      if (!objects[from] || !objects[to]) throw new Error('connection to a missing device');
      const connection = { id: `shared-cable-${index + 1}`, fromObjectId: objects[from].id, toObjectId: objects[to].id, cableType, length: cableLength, name };
      if (fromPortId !== null) connection.fromPortId = fromPortId;
      if (toPortId !== null) connection.toPortId = toPortId;
      return connection;
    }),
  };
  if (packed.v) project.camera = { position: unpackVector(packed.v.slice(0, 3)), target: unpackVector(packed.v.slice(3, 6)) };
  return project;
}

export function sharePageUrl(locationLike, hash) {
  const origin = locationLike?.origin || '';
  const pathname = locationLike?.pathname || '/';
  const search = locationLike?.search || '';
  return `${origin}${pathname}${search}${hash}`;
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function base64UrlToBytes(text) {
  const pad = (4 - (text.length % 4)) % 4;
  const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat(pad));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function gzip(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzip(bytes, maxBytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error('too big');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}
