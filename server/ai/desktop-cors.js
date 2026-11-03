// The packaged app loads from a Tauri origin and calls the Pages API on
// another host. A Lax cookie is not sent on that cross-site request, and a
// None cookie would be sent from every site, so both the cookie and the
// response headers change only for the known desktop origins. The website
// keeps SameSite=Lax and gets no CORS headers. A present Origin that is
// neither the request's own origin nor a desktop origin is refused.

export const DESKTOP_ORIGINS = Object.freeze([
  'tauri://localhost',
  'http://tauri.localhost',
  'https://tauri.localhost',
]);

export function statedOrigin(request) {
  const raw = request.headers.get('origin');
  if (raw == null) return null;
  const origin = raw.trim();
  if (!origin) return null;
  if (/[\s\r\n]/.test(origin)) return 'invalid';
  return origin;
}

export function isDesktopOrigin(origin) {
  return DESKTOP_ORIGINS.includes(origin);
}

function isSameOrigin(request, origin) {
  try {
    return origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function isLoopbackOrigin(origin) {
  try {
    const url = new URL(origin);
    const host = url.hostname;
    return url.protocol === 'http:' && (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]');
  } catch {
    return false;
  }
}

function forbidden() {
  return new Response(JSON.stringify({
    error: 'forbidden_origin',
    message: '不能从这里登录或使用 AI',
  }), {
    status: 403,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export function foreignOriginResponse(request, { allowLoopback = false } = {}) {
  const origin = statedOrigin(request);
  if (origin == null) return null;
  if (origin === 'invalid') return forbidden();
  if (isDesktopOrigin(origin) || isSameOrigin(request, origin)) return null;
  if (allowLoopback && isLoopbackOrigin(origin)) return null;
  return forbidden();
}

function corsHeaders(origin) {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type, accept',
    vary: 'Origin',
  };
}

export function cookieForDesktop(cookie) {
  const replaced = cookie.replace(/SameSite=Lax/gi, 'SameSite=None');
  const withSite = /SameSite=/i.test(replaced) ? replaced : `${replaced}; SameSite=None`;
  if (/(?:^|;\s*)Secure(?:\s*;|$)/i.test(withSite)) return withSite;
  return `${withSite}; Secure`;
}

export function applyDesktopCors(request, response) {
  const origin = statedOrigin(request);
  if (!isDesktopOrigin(origin)) return response;
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(corsHeaders(origin))) {
    if (name === 'vary' && headers.has('vary')) headers.set('vary', `${headers.get('vary')}, Origin`);
    else headers.set(name, value);
  }
  const cookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
  if (cookies.length) {
    headers.delete('set-cookie');
    for (const cookie of cookies) headers.append('set-cookie', cookieForDesktop(cookie));
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export function desktopPreflight(request) {
  const origin = statedOrigin(request);
  const headers = { 'cache-control': 'no-store' };
  if (isDesktopOrigin(origin)) Object.assign(headers, corsHeaders(origin));
  return new Response(null, { status: 204, headers });
}

export async function guardApiRequest(request, next, options) {
  const blocked = foreignOriginResponse(request, options);
  if (blocked) return blocked;
  if (request.method === 'OPTIONS') return desktopPreflight(request);
  return applyDesktopCors(request, await next());
}
