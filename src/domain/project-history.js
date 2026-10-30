const DEFAULT_HISTORY_LIMIT = 50;
const DEFAULT_GROUP_WINDOW_MS = 500;

export function createProjectHistory({
  limit = DEFAULT_HISTORY_LIMIT,
  groupWindowMs = DEFAULT_GROUP_WINDOW_MS,
  now = Date.now,
} = {}) {
  const historyLimit = normalizeHistoryLimit(limit);
  let past = [];
  let future = [];
  let activeGroup = null;

  const status = () => ({
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  });

  // A group merges records with the same key that come within groupWindowMs
  // of each other. A held group (`holdGroup`, used for a drag) merges them
  // however far apart they are, until finishGroup(), undo or redo ends it.
  const record = (current, {
    groupKey = null,
    holdGroup = false,
    includeCamera = false,
    camera = null,
    cameraDirty = false,
  } = {}) => {
    const timestamp = now();
    if (groupKey
      && activeGroup?.key === groupKey
      && (activeGroup.held || (timestamp >= activeGroup.time && timestamp - activeGroup.time < groupWindowMs))) {
      activeGroup = { ...activeGroup, time: timestamp };
      return status();
    }

    const snapshot = clone(current);
    if (includeCamera) {
      snapshot.camera = clone(camera);
      snapshot.cameraDirty = Boolean(cameraDirty);
    }
    past = appendBounded(past, snapshot, historyLimit);
    future = [];
    activeGroup = groupKey ? { key: groupKey, time: timestamp, held: Boolean(holdGroup) } : null;
    return status();
  };

  const transition = (source, destination, current, camera, cameraDirty) => {
    if (source.length === 0) return { snapshot: null, status: status() };

    const snapshot = source[source.length - 1];
    const reciprocal = clone(current);
    if (Object.hasOwn(snapshot, 'camera')) {
      reciprocal.camera = clone(camera);
      reciprocal.cameraDirty = Boolean(cameraDirty);
    }

    const nextSource = source.slice(0, -1);
    const nextDestination = appendBounded(destination, reciprocal, historyLimit);
    activeGroup = null;
    return {
      snapshot: clone(snapshot),
      nextSource,
      nextDestination,
    };
  };

  const undo = (current, { camera = null, cameraDirty = false } = {}) => {
    const result = transition(past, future, current, camera, cameraDirty);
    if (result.snapshot === null) return result;
    past = result.nextSource;
    future = result.nextDestination;
    return { snapshot: result.snapshot, status: status() };
  };

  const redo = (current, { camera = null, cameraDirty = false } = {}) => {
    const result = transition(future, past, current, camera, cameraDirty);
    if (result.snapshot === null) return result;
    future = result.nextSource;
    past = result.nextDestination;
    return { snapshot: result.snapshot, status: status() };
  };

  return {
    record,
    undo,
    redo,
    status,
    finishGroup() {
      activeGroup = null;
    },
    reset() {
      past = [];
      future = [];
      activeGroup = null;
      return status();
    },
  };
}

function appendBounded(items, item, limit) {
  if (limit === 0) return [];
  return [...items, item].slice(-limit);
}

function normalizeHistoryLimit(limit) {
  if (!Number.isFinite(limit)) return DEFAULT_HISTORY_LIMIT;
  return Math.max(0, Math.floor(limit));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
