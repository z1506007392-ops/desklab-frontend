import { isProjectEnvelope } from './project-validation.js';
import { followStorageWrite } from './storage-write.js';

// Up to three named copies beside the desk that is on screen (E100).
// They stay on this machine. Export can carry them; nothing here uploads
// or syncs them to another device.

export const LAYOUT_SCHEME_LIMIT = 3;
export const LAYOUT_SCHEMES_STORAGE_KEY = 'desklab.layout-schemes.v1';
export const LAYOUT_SCHEMES_VERSION = 1;
const NAME_LIMIT = 20;

function cleanName(name) {
  const text = String(name ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return [...text].slice(0, NAME_LIMIT).join('').trim();
}

function snapshotProject(project) {
  const copy = {
    room: project.room,
    objects: project.objects,
    connections: project.connections || [],
  };
  if (project.camera) copy.camera = project.camera;
  return JSON.parse(JSON.stringify(copy));
}

function cleanScheme(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const name = cleanName(entry.name);
  if (!entry.id || typeof entry.id !== 'string' || !name) return null;
  if (!isProjectEnvelope(entry.project)) return null;
  const savedAt = typeof entry.savedAt === 'string' && !Number.isNaN(Date.parse(entry.savedAt))
    ? entry.savedAt
    : new Date(0).toISOString();
  return {
    id: entry.id,
    name,
    savedAt,
    project: snapshotProject(entry.project),
  };
}

export function readLayoutSchemes(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== LAYOUT_SCHEMES_VERSION || !Array.isArray(parsed.schemes)) return [];
    return parsed.schemes.map(cleanScheme).filter(Boolean).slice(0, LAYOUT_SCHEME_LIMIT);
  } catch {
    return [];
  }
}

export function serializeLayoutSchemes(schemes) {
  return JSON.stringify({
    version: LAYOUT_SCHEMES_VERSION,
    schemes: (Array.isArray(schemes) ? schemes : []).map(cleanScheme).filter(Boolean).slice(0, LAYOUT_SCHEME_LIMIT),
  });
}

export function layoutSchemesDocument(schemes) {
  return JSON.parse(serializeLayoutSchemes(schemes));
}

// `blocked` means the text on disk is not a scheme list. An empty list must
// not be written back over it.
export function layoutSchemeStoreState(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return { schemes: [], blocked: false };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== LAYOUT_SCHEMES_VERSION || !Array.isArray(parsed.schemes)) {
      return { schemes: [], blocked: true };
    }
    return {
      schemes: parsed.schemes.map(cleanScheme).filter(Boolean).slice(0, LAYOUT_SCHEME_LIMIT),
      blocked: false,
    };
  } catch {
    return { schemes: [], blocked: true };
  }
}

export function loadLayoutSchemes(storage) {
  try {
    return layoutSchemeStoreState(storage?.getItem(LAYOUT_SCHEMES_STORAGE_KEY)).schemes;
  } catch {
    return [];
  }
}

export function storeLayoutSchemes(storage, schemes, { replaceBlocked = false } = {}) {
  const next = serializeLayoutSchemes(schemes);
  try {
    const current = storage.getItem(LAYOUT_SCHEMES_STORAGE_KEY);
    const state = layoutSchemeStoreState(current);
    if (state.blocked && !replaceBlocked) return true;
    if (current === next) return true;
    if ((current == null || current === '') && next === serializeLayoutSchemes([])) return true;
    return followStorageWrite(
      storage.setItem(LAYOUT_SCHEMES_STORAGE_KEY, next),
      () => true,
      () => false,
    );
  } catch {
    return false;
  }
}

/**
 * null when the file has no scheme field (an old backup): leave this
 * machine's copies alone. An array, possibly empty, replaces them.
 * A broken field is also null, so a damaged extra does not wipe the copies.
 */
export function layoutSchemesInBackup(file) {
  if (!file || typeof file !== 'object' || Array.isArray(file)) return null;
  if (!Object.prototype.hasOwnProperty.call(file, 'layoutSchemes')) return null;
  const field = file.layoutSchemes;
  if (!field || field.version !== LAYOUT_SCHEMES_VERSION || !Array.isArray(field.schemes)) return null;
  return field.schemes.map(cleanScheme).filter(Boolean).slice(0, LAYOUT_SCHEME_LIMIT);
}

export function addLayoutScheme(schemes, { id, name, project, savedAt }) {
  const current = Array.isArray(schemes) ? schemes.map(cleanScheme).filter(Boolean) : [];
  if (current.length >= LAYOUT_SCHEME_LIMIT) return { ok: false, reason: 'full', schemes: current };
  const scheme = cleanScheme({ id, name, project, savedAt });
  if (!scheme) {
    return { ok: false, reason: cleanName(name) ? 'project' : 'name', schemes: current };
  }
  return { ok: true, schemes: [...current, scheme] };
}

export function removeLayoutScheme(schemes, id) {
  return (Array.isArray(schemes) ? schemes : []).filter(scheme => scheme.id !== id);
}
