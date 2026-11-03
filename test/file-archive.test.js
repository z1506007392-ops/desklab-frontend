import test from 'node:test';
import assert from 'node:assert/strict';

import { COMMUNITY_POSTS_KEY, COMMUNITY_PROFILE_KEY } from '../src/domain/community-gallery.js';
import { EYE_HEIGHT_STORAGE_KEY } from '../src/domain/eye-height.js';
import { LAYOUT_SCHEMES_STORAGE_KEY } from '../src/domain/layout-schemes.js';
import { GUIDE_SEEN_STORAGE_KEY } from '../src/domain/onboarding.js';
import {
  PROJECT_BACKUP_STORAGE_KEY,
  PROJECT_STORAGE_KEY,
  UNSAVED_PROJECT_VERSION,
  createLocalProjectClient,
} from '../src/domain/local-project-store.js';
import {
  ARCHIVE_FILES,
  createFileArchiveStorage,
  loadFileArchive,
  migrateBrowserArchive,
} from '../src/domain/file-archive.js';

function memoryIo(initial = {}) {
  const files = new Map(Object.entries(initial));
  return {
    files,
    async read(name) {
      return files.has(name) ? files.get(name) : null;
    },
    async write(name, text) {
      files.set(name, text);
    },
    async remove(name) {
      files.delete(name);
    },
  };
}

const desk = {
  id: 'desk', type: 'office-desk', name: '书桌', shape: 'rect',
  position: { x: 0, y: 0, z: 0.375 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1.4, y: 0.7, z: 0.75 },
};

test('known saves map to plain file names inside the app data directory', () => {
  assert.equal(ARCHIVE_FILES[PROJECT_STORAGE_KEY], 'project.json');
  assert.equal(ARCHIVE_FILES[PROJECT_BACKUP_STORAGE_KEY], 'project-backup.json');
  assert.equal(ARCHIVE_FILES[GUIDE_SEEN_STORAGE_KEY], 'guide-seen.txt');
  assert.equal(ARCHIVE_FILES[EYE_HEIGHT_STORAGE_KEY], 'eye-height.json');
  assert.equal(ARCHIVE_FILES[LAYOUT_SCHEMES_STORAGE_KEY], 'layout-schemes.json');
  assert.equal(ARCHIVE_FILES[COMMUNITY_PROFILE_KEY], 'community-profile.json');
  assert.equal(ARCHIVE_FILES[COMMUNITY_POSTS_KEY], 'community-posts.json');
  for (const name of Object.values(ARCHIVE_FILES)) {
    assert.match(name, /^[a-z0-9.-]+$/);
    assert.equal(name.includes('..'), false);
  }
});

test('a file archive loads what is on disk and writes the project back', async () => {
  const io = memoryIo({ 'guide-seen.txt': '1' });
  const storage = await loadFileArchive(io);
  assert.equal(storage.getItem(GUIDE_SEEN_STORAGE_KEY), '1');
  assert.equal(storage.getItem(PROJECT_STORAGE_KEY), null);

  const client = createLocalProjectClient(() => storage, { now: () => new Date('2026-11-04T00:00:00.000Z') });
  const saved = await client.save({
    room: { length: 5, width: 4, height: 3 },
    objects: [desk],
    connections: [],
  }, UNSAVED_PROJECT_VERSION);

  assert.equal(JSON.parse(io.files.get('project.json')).room.length, 5);
  assert.equal((await client.load()).version, saved.version);
  assert.equal(io.files.has('project-backup.json'), false);
});

test('a failed write rolls back and does not replace the previous project file', async () => {
  const io = memoryIo();
  const storage = createFileArchiveStorage(io);
  const client = createLocalProjectClient(() => storage, { now: () => new Date('2026-11-04T00:00:00.000Z') });
  await client.save({
    room: { length: 5, width: 4, height: 3 },
    objects: [],
    connections: [],
  }, UNSAVED_PROJECT_VERSION);
  const first = io.files.get('project.json');

  io.write = async () => {
    throw new Error('disk full');
  };
  await assert.rejects(
    client.save({
      room: { length: 6, width: 4, height: 3 },
      objects: [],
      connections: [],
    }, (await client.load()).version),
    { code: 'archive_write_failed' },
  );
  assert.equal(io.files.get('project.json'), first);
  assert.equal(JSON.parse(storage.getItem(PROJECT_STORAGE_KEY)).room.length, 5);
});

test('an empty file archive copies a browser project once and will not overwrite a file', async () => {
  const browser = new Map([
    [PROJECT_STORAGE_KEY, '{"id":"default","room":{"length":5,"width":4,"height":3},"objects":[],"updatedAt":"2026-11-04T00:00:00.000Z"}'],
    [GUIDE_SEEN_STORAGE_KEY, '1'],
  ]);
  const browserStorage = {
    getItem: key => (browser.has(key) ? browser.get(key) : null),
    setItem: (key, value) => browser.set(key, value),
  };
  const io = memoryIo();
  const storage = await loadFileArchive(io);
  const first = await migrateBrowserArchive(browserStorage, storage);
  assert.equal(first.migrated, true);
  assert.equal(storage.getItem(GUIDE_SEEN_STORAGE_KEY), '1');
  assert.equal(io.files.get('project.json'), browser.get(PROJECT_STORAGE_KEY));

  browser.set(PROJECT_STORAGE_KEY, 'newer-browser-copy');
  const second = await migrateBrowserArchive(browserStorage, storage);
  assert.deepEqual(second, { migrated: false, reason: 'file_exists' });
  assert.notEqual(storage.getItem(PROJECT_STORAGE_KEY), 'newer-browser-copy');
});

test('eye height and layout copies are files in the same archive', async () => {
  const io = memoryIo();
  const storage = await loadFileArchive(io);
  await storage.setItem(EYE_HEIGHT_STORAGE_KEY, '{"version":1,"eyeHeightMetres":1.15,"posture":"sitting","bifocals":false}');
  await storage.setItem(LAYOUT_SCHEMES_STORAGE_KEY, '{"version":1,"schemes":[]}');
  assert.equal(io.files.get('eye-height.json'), '{"version":1,"eyeHeightMetres":1.15,"posture":"sitting","bifocals":false}');
  assert.equal(io.files.get('layout-schemes.json'), '{"version":1,"schemes":[]}');
  const again = await loadFileArchive(io);
  assert.equal(again.getItem(EYE_HEIGHT_STORAGE_KEY), io.files.get('eye-height.json'));
  assert.equal(again.getItem(LAYOUT_SCHEMES_STORAGE_KEY), io.files.get('layout-schemes.json'));
});

test('migration does nothing when the browser has no project', async () => {
  const storage = createFileArchiveStorage(memoryIo());
  const result = await migrateBrowserArchive({ getItem: () => null }, storage);
  assert.deepEqual(result, { migrated: false, reason: 'browser_empty' });
});
