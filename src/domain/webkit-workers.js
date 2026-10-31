// Troika lays out the 3D axis labels in a worker. Its feature test creates an
// empty blob worker, which WebKit allows, and then importScripts() of another
// blob, which WebKit blocks. The labels then throw instead of drawing.
// Reject only that empty probe so Troika keeps the same glyphs on the main
// thread. Other workers are left alone.
const nativeCreate = URL.createObjectURL.bind(URL);
const emptyWorkerURLs = new Set();

function isWebKit() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /AppleWebKit/i.test(ua) && !/Chrome|Chromium|Edg|OPR/i.test(ua);
}

if (typeof window !== 'undefined' && isWebKit() && typeof window.Worker === 'function') {
  URL.createObjectURL = (object) => {
    const url = nativeCreate(object);
    if (object instanceof Blob && object.size === 0) emptyWorkerURLs.add(url);
    return url;
  };
  const NativeWorker = window.Worker;
  window.Worker = function Worker(url, options) {
    if (emptyWorkerURLs.has(String(url))) {
      throw new Error('WebKit blocks Troika blob workers; use the main thread.');
    }
    return new NativeWorker(url, options);
  };
  window.Worker.prototype = NativeWorker.prototype;
}
