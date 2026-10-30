// Old computers, disabled hardware acceleration, and some in-app browsers
// cannot create a WebGL context, and three.js then throws on mount. Check
// once up front so the rest of the app can still be used without 3D.
export function canUseWebGL(createCanvas = () => document.createElement('canvas')) {
  try {
    const canvas = createCanvas();
    const context = canvas.getContext('webgl2')
      || canvas.getContext('webgl')
      || canvas.getContext('experimental-webgl');
    if (!context) return false;
    // Browsers cap live WebGL contexts; release the probe's right away.
    context.getExtension?.('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

// three.js throws from the WebGLRenderer constructor when the GPU refuses a
// context (driver reset, too many contexts). R3F creates the renderer outside
// React rendering, so no error boundary sees that throw. Catch it here, report
// it, and hand R3F a promise that never settles, since the caller is about to
// replace the canvas with a fallback anyway.
export function createRendererOrReport(createRenderer, defaults, onFailure) {
  try {
    return createRenderer(defaults);
  } catch (error) {
    onFailure(error);
    return new Promise(() => {});
  }
}
