import { useEffect, useState } from 'react';

// Loads the 3D view (three.js and Scene3D.jsx) after the rest of the page.
// React.lazy + Suspense left the R3F canvas blank under StrictMode's
// mount-unmount-remount in development, so the module is loaded in an effect
// and the canvas is mounted once, after it has arrived. A failed download is
// rethrown during render for SceneErrorBoundary to explain.
let scene3DModule = null;
const loadScene3D = () => {
  scene3DModule ??= importSceneWithRetry();
  return scene3DModule;
};

// WebKit and Firefox sometimes abort the module request on a quick reload.
// Try again before telling the user the 3D code failed to download.
function importSceneWithRetry(attempt = 0) {
  return import('./Scene3D.jsx').catch(error => {
    if (attempt >= 4) {
      scene3DModule = null;
      throw error;
    }
    return new Promise(resolve => { setTimeout(resolve, 80 * (attempt + 1)); })
      .then(() => importSceneWithRetry(attempt + 1));
  });
}

export default function LazyScene3D(props) {
  const [loaded, setLoaded] = useState({ Scene3D: null, error: null });

  useEffect(() => {
    let active = true;
    loadScene3D().then(
      module => { if (active) setLoaded({ Scene3D: module.default, error: null }); },
      error => { if (active) setLoaded({ Scene3D: null, error }); },
    );
    return () => { active = false; };
  }, []);

  if (loaded.error) throw loaded.error;
  if (!loaded.Scene3D) return <div className="scene-loading">正在加载 3D 画面…</div>;
  const { Scene3D } = loaded;
  return <Scene3D {...props} />;
}
