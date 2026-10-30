import { useEffect, useState } from 'react';

// Loads the 3D view (three.js and Scene3D.jsx) after the rest of the page.
// React.lazy + Suspense left the R3F canvas blank under StrictMode's
// mount-unmount-remount in development, so the module is loaded in an effect
// and the canvas is mounted once, after it has arrived. A failed download is
// rethrown during render for SceneErrorBoundary to explain.
let scene3DModule = null;
const loadScene3D = () => {
  scene3DModule ??= import('./Scene3D.jsx').catch(error => {
    scene3DModule = null;
    throw error;
  });
  return scene3DModule;
};

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
