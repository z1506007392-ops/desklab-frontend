// A model URL the page is allowed to fetch. Catalog files are same-origin
// paths such as /models/office-desk.glb. Anything with a scheme, a
// protocol-relative host, a parent segment, or a query other than the cache
// revision (?v= and 8 hex digits) is refused so a shared desk or an imported
// file cannot make the browser load an attacker's GLB (or a javascript: /
// data: URL). The revision still names a file on this site.

const MODEL_PATH = /^(?:[A-Za-z0-9._-]+\/)*models\/[A-Za-z0-9][A-Za-z0-9_-]{0,63}\.glb$/;
const REVISION_QUERY = /^\?v=[0-9a-f]{8}$/;

function hasControlOrSpace(url) {
  for (let index = 0; index < url.length; index += 1) {
    const code = url.charCodeAt(index);
    if (code <= 32 || code === 127) return true;
  }
  return false;
}

export function isSafeModelAssetUrl(url) {
  if (typeof url !== 'string' || url.length === 0 || url.length > 160) return false;
  if (hasControlOrSpace(url)) return false;
  if (url.includes('\\') || url.includes('..') || url.includes('%') || url.includes('#') || url.includes('//')) {
    return false;
  }
  const queryAt = url.indexOf('?');
  const path = queryAt === -1 ? url : url.slice(0, queryAt);
  const query = queryAt === -1 ? '' : url.slice(queryAt);
  if (query && !REVISION_QUERY.test(query)) return false;
  return MODEL_PATH.test(path.replace(/^\//, ''));
}
