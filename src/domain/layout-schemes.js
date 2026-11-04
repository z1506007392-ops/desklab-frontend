import { normalizeProject } from './local-project-store.js';
import { followStorageWrite } from './storage-write.js';
import { screenUntrustedProject } from './untrusted-project.js';

// Up to three named copies beside the desk that is on screen (E100).
// They stay on this machine. Export can carry them; nothing here uploads
// or syncs them to another device.

export const LAYOUT_SCHEME_LIMIT = 3;
export const LAYOUT_SCHEMES_STORAGE_KEY = 'desklab.layout-schemes.v1';
export const LAYOUT_SCHEMES_VERSION = 1;
const NAME_LIMIT = 20;

function cleanName(name) {
  if (typeof name !== 'string') return '';
  let out = '';
  for (const char of name) {
    const code = char.charCodeAt(0);
    const hidden = code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127
      || (code >= 0x202A && code <= 0x202E)
      || (code >= 0x2066 && code <= 0x2069)
      || code === 0x200E || code === 0x200F || code === 0xFEFF;
    if (!hidden) out += char;
  }
  const text = out.replaceAll('<', '＜').replaceAll('>', '＞').replace(/\s+/g, ' ').trim();
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

function schemeProject(project) {
  try {
    return snapshotProject(screenUntrustedProject(normalizeProject(project)));
  } catch {
    return null;
  }
}

function cleanScheme(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const name = cleanName(entry.name);
  if (typeof entry.id !== 'string' || entry.id.length === 0 || entry.id.length > 80 || !name) return null;
  const project = schemeProject(entry.project);
  if (!project) return null;
  const savedAt = typeof entry.savedAt === 'string' && !Number.isNaN(Date.parse(entry.savedAt))
    ? entry.savedAt
    : new Date(0).toISOString();
  return {
    id: entry.id,
    name,
    savedAt,
    project,
  };
}

function cleanSchemeList(entries) {
  const seen = new Set();
  const out = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    const scheme = cleanScheme(entry);
    if (!scheme || seen.has(scheme.id)) continue;
    seen.add(scheme.id);
    out.push(scheme);
    if (out.length >= LAYOUT_SCHEME_LIMIT) break;
  }
  return out;
}

export function readLayoutSchemes(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== LAYOUT_SCHEMES_VERSION || !Array.isArray(parsed.schemes)) return [];
    return cleanSchemeList(parsed.schemes);
  } catch {
    return [];
  }
}

export function serializeLayoutSchemes(schemes) {
  return JSON.stringify({
    version: LAYOUT_SCHEMES_VERSION,
    schemes: cleanSchemeList(schemes),
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
      schemes: cleanSchemeList(parsed.schemes),
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
  return cleanSchemeList(field.schemes);
}

export function addLayoutScheme(schemes, { id, name, project, savedAt }) {
  const current = cleanSchemeList(schemes);
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
