import { isProjectEnvelope } from './project-validation.js';

// Projects live in the visitor's own browser: there are no accounts, and the
// backend no longer stores anyone's desk. The client keeps the contract the
// HTTP client had (versioned load/save, validate, recover the previous save),
// so a second tab cannot silently overwrite a newer save.
export const PROJECT_STORAGE_KEY = 'desklab.project.v1';
export const PROJECT_BACKUP_STORAGE_KEY = 'desklab.project-backup.v1';
export const UNSAVED_PROJECT_VERSION = '"unsaved"';

const PROJECT_ID = 'default';
const CONFLICT_MESSAGE = '项目已在另一个页面中更新。请先刷新页面，确认最新内容后再保存。';
const STORAGE_BLOCKED_MESSAGE = '浏览器不允许本站使用本地存储，项目无法读取或保存。请在浏览器设置中允许本站存储数据。';
const STORAGE_FULL_MESSAGE = '浏览器存储空间不足，项目未保存。请先导出项目文件备份。';

export function createLocalProjectClient(getStorage, { now = () => new Date() } = {}) {
  const storage = () => {
    try {
      const store = getStorage();
      if (!store) throw new Error('no storage');
      return store;
    } catch {
      throw storeError(STORAGE_BLOCKED_MESSAGE, 'storage_unavailable');
    }
  };
  const readRaw = key => {
    try {
      return storage().getItem(key);
    } catch (error) {
      if (error.code === 'storage_unavailable') throw error;
      throw storeError(STORAGE_BLOCKED_MESSAGE, 'storage_unavailable');
    }
  };

  return {
    async load() {
      const raw = readRaw(PROJECT_STORAGE_KEY);
      if (raw === null) {
        return {
          project: buildStoredProject({ room: { length: 5, width: 4, height: 3 }, objects: [] }, now()),
          version: UNSAVED_PROJECT_VERSION,
        };
      }
      const project = parseStoredProject(raw);
      if (!project) {
        throw storeError('本机保存的项目已损坏，无法读取。', 'project_unreadable');
      }
      return { project, version: formatVersion(raw) };
    },
    async save(project, version = null) {
      if (typeof version !== 'string' || version.trim().length === 0) {
        throw new Error('项目版本尚未加载，已阻止保存以保护现有数据');
      }
      const clean = normalizeProject(project);
      const currentRaw = readRaw(PROJECT_STORAGE_KEY);
      const currentVersion = currentRaw === null ? UNSAVED_PROJECT_VERSION : formatVersion(currentRaw);
      if (currentVersion !== version) {
        throw storeError(CONFLICT_MESSAGE, 'project_conflict');
      }
      if (currentRaw !== null && !parseStoredProject(currentRaw)) {
        throw storeError('本机保存的项目已损坏，已阻止覆盖。', 'project_unreadable');
      }

      const stored = buildStoredProject(clean, now());
      const raw = JSON.stringify(stored);
      writeRaw(storage(), currentRaw === null ? [] : [[PROJECT_BACKUP_STORAGE_KEY, currentRaw]], [PROJECT_STORAGE_KEY, raw]);
      return { project: stored, version: formatVersion(raw) };
    },
    async validate(project) {
      return normalizeProject(project);
    },
    async recoverBackup() {
      const currentRaw = readRaw(PROJECT_STORAGE_KEY);
      if (currentRaw !== null && parseStoredProject(currentRaw)) {
        throw storeError('当前项目仍可正常读取，无需恢复备份', 'recovery_not_allowed');
      }
      const backupRaw = readRaw(PROJECT_BACKUP_STORAGE_KEY);
      const backup = backupRaw === null ? null : parseStoredProject(backupRaw);
      if (!backup) {
        throw storeError('当前没有可用的上一版本备份', 'backup_not_found');
      }
      writeRaw(storage(), [], [PROJECT_STORAGE_KEY, backupRaw]);
      return { project: backup, version: formatVersion(backupRaw) };
    },
  };
}

/**
 * Keep only the fields the project contract defines, as the backend did, so
 * an imported file cannot carry stray data into the save.
 */
export function normalizeProject(project) {
  if (!isProjectEnvelope(project)) {
    throw new Error('项目文件内容不完整或格式不正确');
  }
  const vec = value => ({ x: value.x, y: value.y, z: value.z });
  const clean = {
    room: { length: project.room.length, width: project.room.width, height: project.room.height },
    objects: project.objects.map(object => {
      const out = {
        id: object.id,
        type: object.type,
        name: object.name,
        shape: object.shape,
        position: vec(object.position),
        rotation: vec(object.rotation),
        scale: vec(object.scale),
      };
      for (const field of ['category', 'modelId', 'color', 'wattage', 'maxLoad']) {
        if (object[field] !== undefined && object[field] !== null) out[field] = object[field];
      }
      // assetUrl: null is meaningful (no GLB), so only undefined is dropped.
      if (object.assetUrl !== undefined) out.assetUrl = object.assetUrl;
      if (Array.isArray(object.ports)) {
        out.ports = object.ports.map(port => {
          const cleanPort = { id: port.id, name: port.name, type: port.type, direction: port.direction };
          if (port.anchor !== undefined) cleanPort.anchor = port.anchor === null ? null : vec(port.anchor);
          return cleanPort;
        });
      }
      return out;
    }),
  };
  if (project.camera !== undefined && project.camera !== null) {
    clean.camera = { position: vec(project.camera.position), target: vec(project.camera.target) };
  }
  if (project.connections !== undefined && project.connections !== null) {
    clean.connections = project.connections.map(connection => {
      const out = {
        id: connection.id,
        fromObjectId: connection.fromObjectId,
        toObjectId: connection.toObjectId,
        cableType: connection.cableType,
        length: connection.length,
        name: connection.name,
      };
      if (connection.fromPortId !== undefined && connection.fromPortId !== null) out.fromPortId = connection.fromPortId;
      if (connection.toPortId !== undefined && connection.toPortId !== null) out.toPortId = connection.toPortId;
      return out;
    });
  }
  return clean;
}

function buildStoredProject(project, date) {
  const stored = { id: PROJECT_ID, room: project.room, objects: project.objects, updatedAt: date.toISOString() };
  if (project.camera !== undefined) stored.camera = project.camera;
  if (project.connections !== undefined) stored.connections = project.connections;
  return stored;
}

function parseStoredProject(raw) {
  try {
    const parsed = JSON.parse(raw);
    return isProjectEnvelope(parsed, { requireStoredFields: true }) ? parsed : null;
  } catch {
    return null;
  }
}

function writeRaw(store, backups, [key, value]) {
  try {
    for (const [backupKey, backupValue] of backups) store.setItem(backupKey, backupValue);
    store.setItem(key, value);
  } catch {
    throw storeError(STORAGE_FULL_MESSAGE, 'storage_write_failed');
  }
}

// FNV-1a over the stored text: any change to the saved project changes the
// version, which is all the cross-tab conflict check needs.
function formatVersion(raw) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < raw.length; index += 1) {
    hash ^= raw.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `"local-${raw.length.toString(36)}-${(hash >>> 0).toString(36)}"`;
}

function storeError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}
