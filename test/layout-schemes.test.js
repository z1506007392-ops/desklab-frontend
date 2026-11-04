import test from 'node:test';
import assert from 'node:assert/strict';

import { createFileArchiveStorage } from '../src/domain/file-archive.js';
import { isProjectEnvelope } from '../src/domain/project-validation.js';
import {
  addLayoutScheme,
  layoutSchemeStoreState,
  layoutSchemesDocument,
  layoutSchemesInBackup,
  loadLayoutSchemes,
  readLayoutSchemes,
  removeLayoutScheme,
  serializeLayoutSchemes,
  storeLayoutSchemes,
  LAYOUT_SCHEME_LIMIT,
  LAYOUT_SCHEMES_STORAGE_KEY,
} from '../src/domain/layout-schemes.js';

function project(name) {
  return {
    room: { length: 4, width: 3, height: 2.7 },
    objects: [{
      id: 'desk',
      name,
      type: 'furniture',
      modelId: 'office-desk',
      shape: 'box',
      position: { x: 0, y: 0, z: 0.375 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1.4, y: 0.7, z: 0.75 },
      ports: [],
    }],
    connections: [],
  };
}

test('at most three named copies are kept beside the current desk', () => {
  assert.equal(addLayoutScheme([], { id: 'x', name: '   ', project: project('x'), savedAt: '2026-11-04T00:00:00.000Z' }).reason, 'name');
  let schemes = [];
  for (const name of ['现在的', '想买的', '双屏']) {
    const added = addLayoutScheme(schemes, {
      id: name,
      name: `  ${name}  `,
      project: project(name),
      savedAt: '2026-11-04T00:00:00.000Z',
    });
    assert.equal(added.ok, true);
    schemes = added.schemes;
  }
  assert.equal(schemes.length, LAYOUT_SCHEME_LIMIT);
  assert.deepEqual(schemes.map(scheme => scheme.name), ['现在的', '想买的', '双屏']);
  const full = addLayoutScheme(schemes, {
    id: 'more',
    name: '第四套',
    project: project('第四套'),
    savedAt: '2026-11-04T00:00:00.000Z',
  });
  assert.equal(full.ok, false);
  assert.equal(full.reason, 'full');
  assert.equal(removeLayoutScheme(schemes, '想买的').map(scheme => scheme.id).join(','), '现在的,双屏');
});

test('a backup carries the copies and an old single desk does not wipe them', () => {
  const schemes = addLayoutScheme([], {
    id: 'a',
    name: '想买的双屏方案呀多余的字',
    project: project('想买的'),
    savedAt: '2026-11-04T00:00:00.000Z',
  }).schemes;
  assert.equal(schemes[0].name.length <= 20, true);
  const file = { ...project('当前'), layoutSchemes: layoutSchemesDocument(schemes) };
  assert.equal(isProjectEnvelope(file), true);
  assert.equal(layoutSchemesInBackup(file).length, 1);
  assert.equal(layoutSchemesInBackup(project('旧备份')), null);
  assert.deepEqual(layoutSchemesInBackup({ ...project('坏'), layoutSchemes: { version: 0, schemes: [] } }), null);
  assert.deepEqual(layoutSchemesInBackup({ ...project('空'), layoutSchemes: { version: 1, schemes: [] } }), []);
});

test('a broken local save becomes an empty list', () => {
  const storage = { getItem: () => '{', setItem() {} };
  assert.deepEqual(loadLayoutSchemes(storage), []);
  assert.deepEqual(readLayoutSchemes(null), []);
  assert.equal(layoutSchemeStoreState('{').blocked, true);
  assert.equal(LAYOUT_SCHEMES_STORAGE_KEY, 'desklab.layout-schemes.v1');
});

test('a blocked scheme file is not replaced by an empty list', () => {
  let written = null;
  const storage = {
    getItem: () => '{',
    setItem(_key, value) { written = value; },
  };
  assert.equal(storeLayoutSchemes(storage, []), true);
  assert.equal(written, null);
  assert.equal(storeLayoutSchemes(storage, [], { replaceBlocked: true }), true);
  assert.equal(written, serializeLayoutSchemes([]));
});

test('startup does not create an empty scheme file, and a failed write rolls back', async () => {
  const files = new Map();
  const io = {
    files,
    async read(name) { return files.has(name) ? files.get(name) : null; },
    async write(name, text) { files.set(name, text); },
    async remove(name) { files.delete(name); },
  };
  const storage = createFileArchiveStorage(io);
  assert.equal(storeLayoutSchemes(storage, []), true);
  assert.equal(files.has('layout-schemes.json'), false);

  const kept = addLayoutScheme([], {
    id: 'a',
    name: '想买的',
    project: project('想买的'),
    savedAt: '2026-11-04T00:00:00.000Z',
  }).schemes;
  assert.equal(await storeLayoutSchemes(storage, kept), true);
  const saved = files.get('layout-schemes.json');

  io.write = async () => { throw new Error('disk full'); };
  const extra = addLayoutScheme(kept, {
    id: 'b',
    name: '双屏',
    project: project('双屏'),
    savedAt: '2026-11-04T00:00:00.000Z',
  }).schemes;
  assert.equal(await storeLayoutSchemes(storage, extra), false);
  assert.equal(files.get('layout-schemes.json'), saved);
  assert.equal(loadLayoutSchemes(storage).length, 1);
});
