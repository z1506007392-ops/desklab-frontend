// A same-origin path can be fetched ahead of time. A scheme (https, javascript,
// data) or a protocol-relative host cannot: a shared desk or a saved copy must
// not make the browser request it. A path outside /models, such as
// /custom/thing.glb, is still a file on this site.
function isPreloadableModelUrl(url) {
  if (typeof url !== 'string' || url.length === 0) return false;
  if (url.charCodeAt(0) === 47 && url.charCodeAt(1) === 47) return false;
  for (let index = 0; index < url.length; index += 1) {
    const code = url.charCodeAt(index);
    if (code <= 32 || code === 127 || code === 58) return false;
  }
  return true;
}

// Which model files to fetch now, and which can wait. `now` is whatever the
// open project actually shows. `later` is the rest of the catalog, prefetched
// once the page is idle so adding a device does not wait on a download.
export function partitionModelPreload(objectUrls, catalogUrls) {
  const now = [];
  const seen = new Set();
  for (const url of objectUrls) {
    if (!isPreloadableModelUrl(url) || seen.has(url)) continue;
    seen.add(url);
    now.push(url);
  }
  const later = [];
  for (const url of catalogUrls) {
    if (isPreloadableModelUrl(url) && !seen.has(url)) later.push(url);
  }
  return { now, later };
}

const preloaded = new Set();

// Starts the download without pulling three.js into the page script. The
// scene's loader issues the same URL, so the browser should reuse this
// response instead of fetching twice.
export function preloadModelUrls(urls) {
  if (typeof document === 'undefined') return;
  for (const url of urls) {
    if (!isPreloadableModelUrl(url) || preloaded.has(url)) continue;
    preloaded.add(url);
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'fetch';
    link.crossOrigin = 'anonymous';
    // Below the stylesheet and the app script. The 3D chunks are not
    // modulepreloaded: on a slow phone that download delayed first paint.
    link.fetchPriority = 'low';
    link.href = url;
    document.head.appendChild(link);
  }
}
