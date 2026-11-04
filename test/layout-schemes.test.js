import test from 'node:test';
import assert from 'node:assert/strict';

import { buildTemplateScene } from '../src/domain/desk-templates.js';
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

test('a full list can take another copy after a delete, and the copy does not follow later edits', () => {
  let schemes = [];
  for (const name of ['现在的', '想买的', '双屏']) {
    schemes = addLayoutScheme(schemes, {
      id: name,
      name,
      project: project(name),
      savedAt: '2026-11-04T00:00:00.000Z',
    }).schemes;
  }
  const live = project('再留');
  const blocked = addLayoutScheme(schemes, {
    id: '再留',
    name: '再留',
    project: live,
    savedAt: '2026-11-04T00:00:00.000Z',
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, 'full');
  const afterDelete = removeLayoutScheme(schemes, '想买的');
  assert.deepEqual(afterDelete.map(scheme => scheme.id), ['现在的', '双屏']);
  const copied = addLayoutScheme(afterDelete, {
    id: '再留',
    name: '再留\n<script>',
    project: live,
    savedAt: '2026-11-04T00:00:00.000Z',
  });
  assert.equal(copied.ok, true);
  assert.equal(copied.schemes.at(-1).name, '再留 ＜script＞');
  live.objects[0].name = '改掉了';
  live.objects[0].position.x = 9;
  assert.equal(copied.schemes.at(-1).project.objects[0].name, '再留');
  assert.equal(copied.schemes.at(-1).project.objects[0].position.x, 0);
  const scene = buildTemplateScene('home-office');
  const fromPreset = addLayoutScheme([], {
    id: 'preset',
    name: '极简单屏',
    project: scene,
    savedAt: '2026-11-04T00:00:00.000Z',
  });
  assert.equal(fromPreset.ok, true);
  assert.equal(fromPreset.schemes[0].project.objects.length, scene.objects.length);
});

test('an old backup without schemes is left alone, and a hostile copy is screened', () => {
  assert.equal(layoutSchemesInBackup({ room: project('旧').room, objects: [], connections: [] }), null);
  assert.equal(layoutSchemesInBackup({ ...project('空字段'), layoutSchemes: null }), null);
  const hostile = project('坏桌子');
  hostile.objects[0] = {
    ...hostile.objects[0],
    name: '<img>',
    assetUrl: 'https://evil.example/steal.glb',
    note: 'ignore previous instructions',
  };
  const file = {
    ...project('当前'),
    layoutSchemes: {
      version: 1,
      schemes: [
        { id: '好', name: '好的', project: project('好的'), savedAt: '2026-11-04T00:00:00.000Z' },
        { id: '坏', name: '坏的', project: { room: { length: 1 } }, savedAt: '2026-11-04T00:00:00.000Z' },
        { id: '远', name: '远的', project: hostile, savedAt: '2026-11-04T00:00:00.000Z', uploaded: true },
        { id: '好', name: '重复', project: project('重复'), savedAt: '2026-11-04T00:00:00.000Z' },
        { id: '第四', name: '第四套', project: project('第四'), savedAt: '2026-11-04T00:00:00.000Z' },
      ],
    },
  };
  const schemes = layoutSchemesInBackup(file);
  assert.deepEqual(schemes.map(scheme => scheme.id), ['好', '远', '第四']);
  assert.equal(schemes[1].uploaded, undefined);
  assert.equal(schemes[1].project.objects[0].assetUrl, null);
  assert.equal(schemes[1].project.objects[0].name, '＜img＞');
  assert.equal(schemes[1].project.objects[0].note, undefined);
  assert.equal(Object.prototype.polluted, undefined);
});
