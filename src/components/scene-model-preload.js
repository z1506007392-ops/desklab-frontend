import { useGLTF } from '@react-three/drei';
import { DEVICE_CATALOG } from '../domain/catalog.js';
import { partitionModelPreload } from '../domain/model-preload.js';

const CATALOG_MODEL_URLS = DEVICE_CATALOG.flatMap(category => category.models)
  .map(model => model.assetUrl)
  .filter(Boolean);

// The open project's models start as soon as the scene renders. The rest wait
// until the browser is idle, so an empty room does not spend its first moment
// downloading every device. Adding one later still finds it cached.
export function preloadProjectModels(objects) {
  const { now } = partitionModelPreload((objects || []).map(object => object?.assetUrl), CATALOG_MODEL_URLS);
  for (const url of now) useGLTF.preload(url, false, true);
}

export function scheduleCatalogPreload(objects) {
  const { later } = partitionModelPreload((objects || []).map(object => object?.assetUrl), CATALOG_MODEL_URLS);
  if (later.length === 0) return () => {};
  const run = () => {
    for (const url of later) useGLTF.preload(url, false, true);
  };
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(run, { timeout: 800 });
    return () => cancelIdleCallback(id);
  }
  const id = setTimeout(run, 300);
  return () => clearTimeout(id);
}
