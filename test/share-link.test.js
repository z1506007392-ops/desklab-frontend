import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

import {
  SHARE_LINK_WARN_LENGTH,
  decodeShareLink,
  encodeShareLink,
} from '../src/domain/share-link.js';

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
  assert.match(link.url, /^https:\/\/desklab.example\/#desklab-share-1\.[A-Za-z0-9_-]+$/);
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
