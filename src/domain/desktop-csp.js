// Content-Security-Policy for the packaged Tauri app. The website policy in
// public/_headers stays same-origin. This one adds the API origin and the
// Tauri IPC endpoints, and keeps the blob / wasm-unsafe-eval exceptions the
// meshopt decoder and Troika workers need.
import { PACKAGED_API_ORIGIN, configuredApiOrigin } from './api-base.js';

export function desktopContentSecurityPolicy(origin = PACKAGED_API_ORIGIN) {
  const api = configuredApiOrigin(origin);
  if (!api) throw new Error('API base must be an https origin');
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    "script-src 'self' blob: 'wasm-unsafe-eval'",
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self' data:",
    `connect-src 'self' blob: ipc: http://ipc.localhost https://ipc.localhost ${api}`,
    "media-src 'self'",
  ].join('; ');
}

/** Origin used when packaging. Unset means the Pages production site. */
export function cspForBuild(raw) {
  const origin = raw == null || raw === '' ? PACKAGED_API_ORIGIN : configuredApiOrigin(raw);
  return desktopContentSecurityPolicy(origin);
}
