import test from 'node:test';
import assert from 'node:assert/strict';

import { createProjectDraftStorage } from '../src/domain/draft-storage.js';

test('reports a local draft write failure without losing its cause', () => {
  const failure = new Error('quota exceeded');
  const storage = createProjectDraftStorage(
    () => ({
      setItem() {
        throw failure;
      },
    }),
    'draft-key'
  );

  assert.deepEqual(storage.write({ version: 1 }), {
    ok: false,
    operation: 'write',
    error: failure,
  });
});

test('reports failure when browser storage cannot be accessed for reading', () => {
  const failure = new Error('storage denied');
  const storage = createProjectDraftStorage(
    () => {
      throw failure;
    },
    'draft-key'
  );

  assert.deepEqual(storage.read(), {
    ok: false,
    operation: 'read',
    error: failure,
    draft: null,
  });
});

test('reports a non-empty malformed draft instead of treating it as missing', () => {
  const storage = createProjectDraftStorage(
    () => ({
      getItem() {
        return '{"version":1,"project":';
      },
    }),
    'draft-key'
  );

  const result = storage.read();
  assert.equal(result.ok, false);
  assert.equal(result.operation, 'parse');
  assert.equal(result.draft, null);
  assert.match(result.error.message, /无法解析/);
});

test('preserves stored recovery material after a draft read failure', () => {
  let removed = false;
  const storage = createProjectDraftStorage(
    () => ({
      getItem() {
        return '{"version":1,"project":';
      },
      removeItem() {
        removed = true;
      },
    }),
    'draft-key'
  );

  assert.equal(storage.read().ok, false);
  const result = storage.clear();
  assert.equal(result.ok, false);
  assert.equal(result.operation, 'clear-blocked');
  assert.match(result.error.message, /保留恢复材料/);
  assert.equal(removed, false);
});

test('reports a local draft clear failure so callers cannot claim it was discarded', () => {
  const failure = new Error('remove denied');
  const storage = createProjectDraftStorage(
    () => ({
      removeItem() {
        throw failure;
      },
    }),
    'draft-key'
  );

  assert.deepEqual(storage.clear(), {
    ok: false,
    operation: 'clear',
    error: failure,
  });
});

test('waits for a file archive before calling a draft write successful', async () => {
  let stored = null;
  let release;
  const gate = new Promise(resolve => {
    release = resolve;
  });
  const storage = createProjectDraftStorage(() => ({
    setItem(_key, value) {
      stored = value;
      return gate.then(() => undefined);
    },
  }), 'draft-key');
  const draft = {
    version: 1,
    savedAt: '2026-11-04T00:00:00.000Z',
    project: { room: { length: 5, width: 4, height: 3 }, objects: [], connections: [], camera: null },
  };

  let settled = false;
  const pending = Promise.resolve(storage.write(draft)).then(result => {
    settled = true;
    return result;
  });
  await Promise.resolve();
  assert.equal(settled, false);
  release();
  assert.deepEqual(await pending, { ok: true });
  assert.equal(stored, JSON.stringify(draft));
});

test('round-trips and clears a valid local draft through the configured key', () => {
  let storedValue = null;
  const browserStorage = {
    getItem(key) {
      assert.equal(key, 'draft-key');
      return storedValue;
    },
    setItem(key, value) {
      assert.equal(key, 'draft-key');
      storedValue = value;
    },
    removeItem(key) {
      assert.equal(key, 'draft-key');
      storedValue = null;
    },
  };
  const storage = createProjectDraftStorage(() => browserStorage, 'draft-key');
  const draft = {
    version: 1,
    savedAt: '2026-06-22T10:00:00.000Z',
    project: {
      room: { length: 5, width: 4, height: 3 },
      objects: [],
      connections: [],
      camera: null,
    },
  };

  assert.deepEqual(storage.write(draft), { ok: true });
  assert.deepEqual(storage.read(), { ok: true, draft });
  assert.deepEqual(storage.clear(), { ok: true });
  assert.equal(storedValue, null);
});
