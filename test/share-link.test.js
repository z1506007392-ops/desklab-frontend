import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { randomBytes } from 'node:crypto';

import {
  SHARE_LINK_WARN_LENGTH,
  decodeShareLink,
  encodeShareLink,
} from '../src/domain/share-link.js';
import { DEVICE_CATALOG, catalogModelUrl, hydrateProjectObjects } from '../src/domain/catalog.js';
import { buildTemplateScene } from '../src/domain/desk-templates.js';
import { normalizeProject } from '../src/domain/local-project-store.js';

const locationLike = { origin: 'https://desklab.example', pathname: '/', search: '' };

function desk(name = '桌子') {
  return {
    room: { length: 4, width: 3, height: 2.6 },
    objects: [{
      id: 'desk',
      type: 'furniture',
      name,
      shape: 'box',
      position: { x: 0, y: 0, z: 0.4 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1.2, y: 0.6, z: 0.75 },
    }],
    connections: [],
  };
}

test('a share link round-trips the desk and carries a version', async () => {
  const link = await encodeShareLink(desk(), locationLike);
  assert.match(link.url, /^https:\/\/desklab.example\/#desklab-share-2\.[A-Za-z0-9_-]+$/);
  assert.equal(link.tooLong, false);
  assert.ok(link.url.length <= SHARE_LINK_WARN_LENGTH);
  const decoded = await decodeShareLink(link.hash);
  assert.equal(decoded.kind, 'ok');
  assert.equal(decoded.project.objects[0].name, '桌子');
  assert.equal(decoded.project.room.length, 4);
  assert.equal(decoded.project.id, undefined);
});

test('a damaged or newer link is refused without throwing', async () => {
  const link = await encodeShareLink(desk(), locationLike);
  assert.equal((await decodeShareLink(`${link.hash}!!!`)).kind, 'damaged');
  assert.equal((await decodeShareLink('#desklab-share-1.')).kind, 'damaged');
  assert.equal((await decodeShareLink('#desklab-share-9.aaaa')).kind, 'unsupported');
  assert.equal((await decodeShareLink('#other')).kind, 'absent');
  assert.equal((await decodeShareLink('')).kind, 'absent');
});

test('a link that inflates past the import limit is refused', async () => {
  const link = await encodeShareLink(desk(), locationLike);
  const decoded = await decodeShareLink(link.hash, { maxBytes: 8 });
  assert.equal(decoded.kind, 'tooBig');
});

test('an incomplete desk cannot be shared or opened', async () => {
  await assert.rejects(() => encodeShareLink({ objects: [] }, locationLike));
  const link = await encodeShareLink(desk(), locationLike);
  const broken = link.hash.replace(/A|B|C|D|E|a|b|c|d|e/g, 'A');
  const decoded = await decodeShareLink(broken === link.hash ? `${link.hash.slice(0, -4)}AAAA` : broken);
  assert.notEqual(decoded.kind, 'ok');
});

test('a long desk warns once the url passes the usual chat limit', async () => {
  const name = randomBytes(1800).toString('base64url');
  const link = await encodeShareLink(desk(name), locationLike);
  assert.equal(link.tooLong, true);
  assert.ok(link.url.length > SHARE_LINK_WARN_LENGTH);
  const decoded = await decodeShareLink(link.hash);
  assert.equal(decoded.kind, 'ok');
  assert.equal(decoded.project.objects[0].name, name);
});

const liveLocation = { origin: 'https://desklab-frontend.pages.dev', pathname: '/', search: '' };
const camera = { position: { x: 0.12, y: 4.86, z: -5.6 }, target: { x: 0, y: 1.35, z: 0 } };
const templateProject = id => {
  const scene = buildTemplateScene(id);
  return { room: { length: 4, width: 3.5, height: 2.7 }, objects: hydrateProjectObjects(scene.objects), connections: scene.connections, camera };
};

// What the app shows for a project: hydrated objects, ids swapped for the
// ones a link gives out, numbers to the millimetre.
function asOpened(project) {
  const clean = normalizeProject(project);
  const ids = new Map(clean.objects.map((object, index) => [object.id, index]));
  const mm = value => Math.round(value * 1000) / 1000;
  const vector = value => ({ x: mm(value.x), y: mm(value.y), z: mm(value.z) });
  return {
    room: clean.room,
    objects: hydrateProjectObjects(clean.objects).map(({ id, position, rotation, scale, ...rest }) => ({
      ...rest, at: ids.get(id), position: vector(position), rotation: vector(rotation), scale: vector(scale),
    })),
    connections: (clean.connections ?? []).map(connection => {
      const { id: _id, fromObjectId, toObjectId, length, ...rest } = connection;
      return { ...rest, from: ids.get(fromObjectId), to: ids.get(toObjectId), length: mm(length) };
    }),
    camera: clean.camera && { position: vector(clean.camera.position), target: vector(clean.camera.target) },
  };
}

test('every template, shared and opened, is the same desk', async () => {
  for (const id of ['home-office', 'desktop-dual', 'gaming']) {
    const project = templateProject(id);
    const decoded = await decodeShareLink((await encodeShareLink(project, liveLocation)).hash);
    assert.equal(decoded.kind, 'ok', id);
    assert.deepEqual(asOpened(decoded.project), asOpened(project), id);
  }
});

test('an ordinary desk, even with more devices, fits a link WeChat can open', async () => {
  for (const id of ['home-office', 'desktop-dual', 'gaming']) {
    const link = await encodeShareLink(templateProject(id), liveLocation);
    assert.equal(link.tooLong, false, `${id}: ${link.url.length} characters`);
  }
  // The gaming desk again, with six more of every kind a home desk gets.
  const extra = DEVICE_CATALOG.flatMap(({ models }) => models)
    .filter(model => ['monitor-27', 'keyboard', 'mouse', 'speakers', 'desk-lamp', 'game-console'].includes(model.modelId));
  const project = templateProject('gaming');
  project.objects = [...project.objects, ...hydrateProjectObjects(extra.map((model, index) => ({
    id: `extra-${index}`, modelId: model.modelId, type: model.type, name: model.displayName, shape: model.shape,
    position: { x: index * 0.1, y: 0, z: 1 }, rotation: { x: 0, y: 0, z: 180 }, scale: { ...model.defaultScale },
  })))];
  assert.equal((await encodeShareLink(project, liveLocation)).tooLong, false);
});

test('what the user changed survives the link', async () => {
  const project = templateProject('gaming');
  const [desk, monitor] = project.objects;
  monitor.name = '我的主屏';
  monitor.scale = { x: 0.9, y: 0.12, z: 0.4 };
  monitor.wattage = 75;
  monitor.rotation = { x: 0, y: 0, z: 165 };
  desk.ports = [{ id: 'grommet', name: '走线孔', type: 'ac_input', direction: 'input' }];
  project.objects.push({
    id: 'shelf', type: 'furniture', name: '自制搁板', shape: 'box',
    position: { x: 1.5, y: 1, z: 0.5 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 0.5, y: 0.3, z: 1 },
  });
  project.connections[0].name = '自己起的线名';
  project.connections[0].length = 2.345;
  const decoded = await decodeShareLink((await encodeShareLink(project, liveLocation)).hash);
  assert.deepEqual(asOpened(decoded.project), asOpened(project));
});

test('links in the first format still open', async () => {
  const project = templateProject('home-office');
  const bytes = new TextEncoder().encode(JSON.stringify(normalizeProject(project)));
  const gzipped = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  const decoded = await decodeShareLink(`#desklab-share-1.${Buffer.from(gzipped).toString('base64url')}`);
  assert.equal(decoded.kind, 'ok');
  assert.deepEqual(asOpened(decoded.project), asOpened(project));
});

async function gzipPayload(payload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const gzipped = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  return `#desklab-share-2.${Buffer.from(gzipped).toString('base64url')}`;
}

test('a huge hash is refused before it is decoded', async () => {
  const hash = `#desklab-share-2.${'A'.repeat(20)}`;
  assert.equal((await decodeShareLink(hash, { maxBytes: 8 })).kind, 'tooBig');
});

test('a packed link cannot rename the id, run a script name, or point at someone else\'s model', async () => {
  const payload = JSON.parse('{"r":[4,3,2.6],"o":[{"m":"office-desk","p":[0,0,0.4],"n":"<script>alert(1)</script>","x":{"assetUrl":"https://evil.example/steal.glb","name":"<img>","id":"pwn","__proto__":{"polluted":true}}}],"c":[]}');
  const opened = await decodeShareLink(await gzipPayload(payload));
  assert.equal(opened.kind, 'ok');
  assert.equal(opened.project.objects[0].id, 'shared-1');
  assert.equal(opened.project.objects[0].name, '＜script＞alert(1)＜/script＞');
  assert.equal(opened.project.objects[0].assetUrl, null);
  assert.equal(Object.prototype.polluted, undefined);
  assert.equal(hydrateProjectObjects(opened.project.objects)[0].assetUrl, catalogModelUrl('office-desk'));
});

test('a free-form packed device cannot carry a script address', async () => {
  const hostile = JSON.parse('{"r":[4,3,2.6],"o":[{"f":{"id":"pwn","type":"furniture","name":"<script>alert(1)</script>","shape":"box","assetUrl":"javascript:alert(1)","position":{"x":0,"y":0,"z":0.4},"rotation":{"x":0,"y":0,"z":0},"scale":{"x":1,"y":1,"z":1},"__proto__":{"polluted":true}}}],"c":[]}');
  const opened = await decodeShareLink(await gzipPayload(hostile));
  assert.equal(opened.kind, 'ok');
  assert.equal(opened.project.objects[0].id, 'shared-1');
  assert.equal(opened.project.objects[0].name, '＜script＞alert(1)＜/script＞');
  assert.equal(opened.project.objects[0].assetUrl, null);
  assert.equal(Object.prototype.polluted, undefined);
});

test('a link naming a device this page does not know is treated as damaged', async () => {
  const payload = { r: [4, 3, 2.6], o: [{ m: 'hologram-desk', p: [0, 0, 0.4] }], c: [] };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const gzipped = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  assert.equal((await decodeShareLink(`#desklab-share-2.${Buffer.from(gzipped).toString('base64url')}`)).kind, 'damaged');
});

