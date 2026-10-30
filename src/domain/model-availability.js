// R3F reports every model load error through window.reportError, even when
// an error boundary catches it, so a missing GLB shows up as an uncaught page
// error although the device correctly falls back to a simple shape. Check
// each model file once up front and skip the GLB when it is not there.
// Static hosts can answer a missing file with the app's HTML page and a 200,
// so an HTML response counts as missing too.
export function isUsableModelResponse(response) {
  if (!response?.ok) return false;
  const type = response.headers?.get?.('content-type') ?? '';
  return !/text\/html/i.test(type);
}

export function createModelAvailabilityChecker(fetchImpl = (...args) => fetch(...args)) {
  const checks = new Map();
  const results = new Map();
  return {
    check(url) {
      if (!checks.has(url)) {
        checks.set(url, fetchImpl(url, { method: 'HEAD' })
          .then(isUsableModelResponse, () => false)
          .then(available => {
            results.set(url, available);
            return available;
          }));
      }
      return checks.get(url);
    },
    // 'available' | 'missing' | 'pending', without starting a request.
    peek(url) {
      if (!results.has(url)) return 'pending';
      return results.get(url) ? 'available' : 'missing';
    },
  };
}

export const modelAvailability = createModelAvailabilityChecker();
