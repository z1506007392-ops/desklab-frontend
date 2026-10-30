import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PROJECT_BACKUP_STORAGE_KEY,
  PROJECT_STORAGE_KEY,
  UNSAVED_PROJECT_VERSION,
  createLocalProjectClient,
  normalizeProject,
} from '../src/domain/local-project-store.js';

class MemoryStorage {
  constructor(entries = {}) { this.map = new Map(Object.entries(entries)); this.failWrites = false; }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) {
    if (this.failWrites) throw new DOMException('full', 'QuotaExceededError');
    this.map.set(key, String(value));
  }
  removeItem(key) { this.map.delete(key); }
}

const fixedNow = () => new Date('2026-10-30T08:00:00.000Z');
const desk = {
  id: 'desk', type: 'office-desk', name: '书桌', shape: 'rect',
  position: { x: 0, y: 0, z: 0.375 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1.4, y: 0.7, z: 0.75 },
};
const project = { room: { length: 4, width: 3, height: 2.8 }, objects: [desk], connections: [] };

test('a first visit gets an empty default room and an unsaved version', async () => {
  const client = createLocalProjectClient(() => new MemoryStorage(), { now: fixedNow });
  const { project: loaded, version } = await client.load();
  assert.equal(version, UNSAVED_PROJECT_VERSION);
  assert.deepEqual(loaded, {
    id: 'default', room: { length: 5, width: 4, height: 3 }, objects: [], updatedAt: '2026-10-30T08:00:00.000Z',
  });
});

test('a save is stored in this browser and loads back with the same version', async () => {
  const storage = new MemoryStorage();
  const client = createLocalProjectClient(() => storage, { now: fixedNow });
  const saved = await client.save(project, UNSAVED_PROJECT_VERSION);

  assert.deepEqual(saved.project, { id: 'default', ...project, updatedAt: '2026-10-30T08:00:00.000Z' });
  assert.notEqual(saved.version, UNSAVED_PROJECT_VERSION);
  const loaded = await client.load();
  assert.deepEqual(loaded, saved);
  assert.equal(storage.getItem(PROJECT_BACKUP_STORAGE_KEY), null, 'nothing to back up on the first save');
});

test('a stale version is refused so another tab cannot overwrite a newer save', async () => {
  const storage = new MemoryStorage();
  const client = createLocalProjectClient(() => storage, { now: fixedNow });
  const first = await client.save(project, UNSAVED_PROJECT_VERSION);
  await client.save({ ...project, room: { length: 6, width: 3, height: 2.8 } }, first.version);

  await assert.rejects(client.save(project, first.version), { code: 'project_conflict' });
  await assert.rejects(client.save(project, UNSAVED_PROJECT_VERSION), { code: 'project_conflict' });
  await assert.rejects(client.save(project, null), /版本尚未加载/);
  assert.equal(JSON.parse(storage.getItem(PROJECT_STORAGE_KEY)).room.length, 6);
});

test('each save keeps the previous save as a backup', async () => {
  const storage = new MemoryStorage();
  const client = createLocalProjectClient(() => storage, { now: fixedNow });
  const first = await client.save(project, UNSAVED_PROJECT_VERSION);
  const firstRaw = storage.getItem(PROJECT_STORAGE_KEY);
  await client.save({ ...project, objects: [] }, first.version);
  assert.equal(storage.getItem(PROJECT_BACKUP_STORAGE_KEY), firstRaw);
});

test('a corrupt save fails loudly, is never overwritten, and can be recovered from the backup', async () => {
  const storage = new MemoryStorage();
  const client = createLocalProjectClient(() => storage, { now: fixedNow });
  const first = await client.save(project, UNSAVED_PROJECT_VERSION);
  await client.save({ ...project, objects: [] }, first.version);
  storage.setItem(PROJECT_STORAGE_KEY, '{"room":');

  await assert.rejects(client.load(), { code: 'project_unreadable' });
  const corruptVersion = '"anything"';
  await assert.rejects(client.save(project, corruptVersion), { code: 'project_conflict' });
  assert.equal(storage.getItem(PROJECT_STORAGE_KEY), '{"room":');

  const recovered = await client.recoverBackup();
  assert.deepEqual(recovered.project.objects, [desk]);
  assert.deepEqual(await client.load(), recovered);
  await assert.rejects(client.recoverBackup(), { code: 'recovery_not_allowed' });
});

test('recovery without a backup says so', async () => {
  const storage = new MemoryStorage({ [PROJECT_STORAGE_KEY]: 'not json' });
  const client = createLocalProjectClient(() => storage);
  await assert.rejects(client.recoverBackup(), { code: 'backup_not_found', message: '当前没有可用的上一版本备份' });
});

test('blocked or full storage gives a plain message instead of a crash', async () => {
  const blocked = createLocalProjectClient(() => { throw new DOMException('denied', 'SecurityError'); });
  await assert.rejects(blocked.load(), { code: 'storage_unavailable', message: /不允许本站使用本地存储/ });

  const storage = new MemoryStorage();
  storage.failWrites = true;
  const full = createLocalProjectClient(() => storage);
  await assert.rejects(full.save(project, UNSAVED_PROJECT_VERSION), { code: 'storage_write_failed', message: /存储空间不足/ });
  assert.equal(storage.getItem(PROJECT_STORAGE_KEY), null);
});

test('invalid projects are rejected on save and validate', async () => {
  const client = createLocalProjectClient(() => new MemoryStorage());
  const broken = { room: { length: 4, width: 3, height: 2.8 }, objects: [{ ...desk, scale: { x: 0, y: 1, z: 1 } }] };
  await assert.rejects(client.validate(broken), /格式不正确/);
  await assert.rejects(client.save(broken, UNSAVED_PROJECT_VERSION), /格式不正确/);
  await assert.rejects(client.validate([]), /格式不正确/);
});

test('normalization keeps contract fields and drops anything else', () => {
  const clean = normalizeProject({
    room: { length: 4, width: 3, height: 2.8, extra: 1 },
    objects: [{
      ...desk, assetUrl: null, category: null, wattage: 30, secret: 'x',
      ports: [
        { id: 'p1', name: '网口', type: 'ethernet', direction: 'bidirectional', anchor: null, extra: true },
        { id: 'p2', name: 'HDMI', type: 'hdmi', direction: 'output', anchor: { x: 0.1, y: 0.2, z: 0.3, w: 1 } },
      ],
    }],
    camera: { position: { x: 1, y: 2, z: 3 }, target: { x: 0, y: 0, z: 0 }, fov: 50 },
    connections: null,
    note: 'dropped',
  });
  assert.deepEqual(clean, {
    room: { length: 4, width: 3, height: 2.8 },
    objects: [{
      ...desk, assetUrl: null, wattage: 30,
      ports: [
        { id: 'p1', name: '网口', type: 'ethernet', direction: 'bidirectional', anchor: null },
        { id: 'p2', name: 'HDMI', type: 'hdmi', direction: 'output', anchor: { x: 0.1, y: 0.2, z: 0.3 } },
      ],
    }],
    camera: { position: { x: 1, y: 2, z: 3 }, target: { x: 0, y: 0, z: 0 } },
  });
});
