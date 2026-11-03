// Where the packaged desktop app sends AI (and, later, community) requests.
// The website and `tauri dev` stay on relative /api, which Vite proxies.
// A packaged build has no proxy, so those calls need an absolute https origin.

import { isDesktopApp } from './app-storage.js';

export const PACKAGED_API_ORIGIN = 'https://desklab-frontend.pages.dev';

function viteEnv(name) {
  const env = import.meta.env;
  if (!env || typeof env !== 'object') return undefined;
  return env[name];
}

/**
 * Accept only an https origin: no userinfo, path, query, or hash.
 * An empty value means "not set". Anything else that is not an origin throws,
 * so a bad build setting fails instead of calling an unexpected host.
 */
export function configuredApiOrigin(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw !== 'string' || /[\s\r\n]/.test(raw)) {
    throw new Error('API base must be an https origin');
  }
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('API base must be an https origin');
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('API base must be an https origin');
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error('API base must be an https origin');
  }
  return url.origin;
}

export function resolveApiUrl(path, { desktop = false, dev = false, origin = PACKAGED_API_ORIGIN } = {}) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) {
    throw new Error('API path must start with /');
  }
  if (!desktop || dev) return path;
  return `${origin}${path}`;
}

function packagedOrigin() {
  const override = configuredApiOrigin(viteEnv('VITE_DESKLAB_API_BASE'));
  return override || PACKAGED_API_ORIGIN;
}

/** Relative on the website and in tauri dev; absolute only in the packaged app. */
export function apiUrl(path) {
  return resolveApiUrl(path, {
    desktop: isDesktopApp(),
    dev: Boolean(viteEnv('DEV')),
    origin: packagedOrigin(),
  });
}
