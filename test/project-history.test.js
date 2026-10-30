import test from 'node:test';
import assert from 'node:assert/strict';

import { createProjectHistory } from '../src/domain/project-history.js';

const state = name => ({
  room: { length: 5, width: 4, height: 3 },
  objects: [{ id: name }],
  connections: [],
  selectedObjectId: null,
});

const camera = x => ({
  position: { x, y: 5, z: -6 },
  target: { x: 0, y: 1, z: 0 },
});

test('project replacement undo and redo restore their matching cameras', () => {
  const history = createProjectHistory();
  const before = state('before');
  const after = state('after');

  history.record(before, {
    includeCamera: true,
    camera: camera(1),
    cameraDirty: false,
  });

  const undone = history.undo(after, { camera: camera(2), cameraDirty: true });
  assert.deepEqual(undone.snapshot, {
    ...before,
    camera: camera(1),
    cameraDirty: false,
  });

  const redone = history.redo(undone.snapshot, {
    camera: camera(1),
    cameraDirty: false,
  });
  assert.deepEqual(redone.snapshot, {
    ...after,
    camera: camera(2),
    cameraDirty: true,
  });
});

test('ordinary layout undo and redo leave the camera outside history', () => {
  const history = createProjectHistory();
  const before = state('before');
  const after = state('after');

  history.record(before);
  const undone = history.undo(after, { camera: camera(2) });
  assert.deepEqual(undone.snapshot, before);

  const redone = history.redo(undone.snapshot, { camera: camera(1) });
  assert.deepEqual(redone.snapshot, after);
});

test('rapid records in the same group undo as one operation', () => {
  let timestamp = 0;
  const history = createProjectHistory({ now: () => timestamp });

  history.record(state('initial'), { groupKey: 'move:desk' });
  timestamp = 100;
  history.record(state('intermediate'), { groupKey: 'move:desk' });

  const undone = history.undo(state('final'));
  assert.deepEqual(undone.snapshot, state('initial'));
  assert.deepEqual(undone.status, { canUndo: false, canRedo: true });
});

test('clock rollback starts a new history group instead of merging operations', () => {
  let timestamp = 100;
  const history = createProjectHistory({ now: () => timestamp });

  history.record(state('first'), { groupKey: 'move:desk' });
  timestamp = 0;
  history.record(state('second'), { groupKey: 'move:desk' });

  const undone = history.undo(state('third'));
  assert.deepEqual(undone.snapshot, state('second'));
  assert.deepEqual(undone.status, { canUndo: true, canRedo: true });
});

test('a held group stays one undo step however slowly it is recorded, until it is finished', () => {
  let timestamp = 0;
  const history = createProjectHistory({ now: () => timestamp });

  history.record(state('before-drag'), { groupKey: 'drag:desk', holdGroup: true });
  timestamp = 2000;
  history.record(state('paused-mid-drag'), { groupKey: 'drag:desk', holdGroup: true });
  timestamp = 9000;
  history.record(state('end-of-drag'), { groupKey: 'drag:desk', holdGroup: true });
  history.finishGroup();
  history.record(state('next-drag'), { groupKey: 'drag:desk', holdGroup: true });

  const firstUndo = history.undo(state('after-next-drag'));
  assert.deepEqual(firstUndo.snapshot, state('next-drag'));
  const secondUndo = history.undo(firstUndo.snapshot);
  assert.deepEqual(secondUndo.snapshot, state('before-drag'));
  assert.deepEqual(secondUndo.status, { canUndo: false, canRedo: true });
});

test('finishing a group lets the next matching group create a new undo point immediately', () => {
  let timestamp = 0;
  const history = createProjectHistory({ now: () => timestamp });

  history.record(state('before-first-drag'), { groupKey: 'move:desk' });
  timestamp = 100;
  history.record(state('during-first-drag'), { groupKey: 'move:desk' });
  history.finishGroup();
  timestamp = 150;
  history.record(state('before-second-drag'), { groupKey: 'move:desk' });

  const firstUndo = history.undo(state('after-second-drag'));
  assert.deepEqual(firstUndo.snapshot, state('before-second-drag'));
  assert.deepEqual(firstUndo.status, { canUndo: true, canRedo: true });

  const secondUndo = history.undo(firstUndo.snapshot);
  assert.deepEqual(secondUndo.snapshot, state('before-first-drag'));
  assert.deepEqual(secondUndo.status, { canUndo: false, canRedo: true });
});

test('history limit keeps the newest undo snapshots only', () => {
  const history = createProjectHistory({ limit: 2 });

  history.record(state('one'));
  history.record(state('two'));
  history.record(state('three'));

  const firstUndo = history.undo(state('four'));
  assert.deepEqual(firstUndo.snapshot, state('three'));
  assert.deepEqual(firstUndo.status, { canUndo: true, canRedo: true });

  const secondUndo = history.undo(firstUndo.snapshot);
  assert.deepEqual(secondUndo.snapshot, state('two'));
  assert.deepEqual(secondUndo.status, { canUndo: false, canRedo: true });
});

test('a zero history limit disables undo snapshots', () => {
  const history = createProjectHistory({ limit: 0 });

  history.record(state('before'));

  assert.deepEqual(history.status(), { canUndo: false, canRedo: false });
  assert.equal(history.undo(state('after')).snapshot, null);
});
