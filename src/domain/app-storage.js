// The web build reads window.localStorage. The desktop shell installs a file
// archive before the first render, and every save goes through this getter.
let installed = null;

export function isDesktopApp() {
  return typeof window !== 'undefined' && window.__TAURI_INTERNALS__ != null;
}

export function installFileArchive(storage) {
  installed = storage;
}

export function isFileArchiveActive() {
  return installed != null;
}

export function getAppStorage() {
  if (installed) return installed;
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  const error = new Error('no storage');
  error.code = 'storage_unavailable';
  throw error;
}
