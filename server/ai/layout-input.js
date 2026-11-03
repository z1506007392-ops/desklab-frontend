// Limits for the JSON a browser posts to /api/ai/layout. A real scene
// summary is a shallow tree of a few hundred nodes. Past these caps the
// request is refused with the ordinary "bad request" message — the response
// does not say which cap fired.

export const LAYOUT_INPUT_LIMITS = Object.freeze({
  maxDepth: 12,
  maxNodes: 8000,
  maxKeys: 48,
  maxArray: 2000,
  maxString: 16000,
});

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function layoutInputProblem(value, limits = LAYOUT_INPUT_LIMITS) {
  let nodes = 0;
  function walk(node, depth) {
    nodes += 1;
    if (nodes > limits.maxNodes || depth > limits.maxDepth) return true;
    if (typeof node === 'string') return node.length > limits.maxString;
    if (!node || typeof node !== 'object') return false;
    if (Array.isArray(node)) {
      if (node.length > limits.maxArray) return true;
      return node.some(item => walk(item, depth + 1));
    }
    const keys = Object.keys(node);
    if (keys.length > limits.maxKeys) return true;
    return keys.some(key => FORBIDDEN_KEYS.has(key) || walk(node[key], depth + 1));
  }
  return walk(value, 0);
}

// The model name is echoed to the browser. Keep it a short token so an
// upstream answer cannot put newlines or markup in the JSON field.
export function publicModelName(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const clean = value.trim();
  return /^[A-Za-z0-9._:-]{1,64}$/.test(clean) ? clean : fallback;
}

// CF-Connecting-IP is a single address. Strip anything else so a huge or
// odd value cannot become a giant rate-limit key. Empty becomes "unknown".
export function clientAddress(headerValue) {
  const raw = typeof headerValue === 'string' ? headerValue : '';
  const token = raw.split(/[\s,]/, 1)[0] ?? '';
  if (!/^[A-Za-z0-9.:]{1,64}$/.test(token)) return 'unknown';
  return token;
}

export function isJsonContentType(headerValue) {
  return typeof headerValue === 'string' && headerValue.toLowerCase().includes('application/json');
}
