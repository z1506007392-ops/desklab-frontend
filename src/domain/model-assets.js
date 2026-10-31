const GENERIC_MONITOR_ASSET = Object.freeze({
  id: 'generic-monitor',
  category: 'display',
  source: 'in-house-generated',
  license: 'DeskLab-owned',
});

const GENERIC_POWER_STRIP_ASSET = Object.freeze({
  id: 'generic-power-strip',
  category: 'power',
  source: 'in-house-generated',
  license: 'DeskLab-owned',
});

const GENERIC_ROUTER_ASSET = Object.freeze({
  id: 'generic-router',
  category: 'network',
  source: 'in-house-generated',
  license: 'DeskLab-owned',
});

const GENERIC_DESKTOP_PC_ASSET = Object.freeze({
  id: 'generic-desktop-pc',
  category: 'computer',
  source: 'in-house-generated',
  license: 'DeskLab-owned',
});

const GENERIC_POWER_ADAPTER_ASSET = Object.freeze({
  id: 'generic-power-adapter',
  category: 'power',
  source: 'in-house-generated',
  license: 'DeskLab-owned',
});

const GENERIC_WALL_OUTLET_ASSET = Object.freeze({
  id: 'generic-wall-outlet',
  category: 'power',
  source: 'in-house-generated',
  license: 'DeskLab-owned',
});

const GENERIC_LAPTOP_ASSET = Object.freeze({
  id: 'generic-laptop',
  category: 'computer',
  source: 'in-house-generated',
  license: 'DeskLab-owned',
});

const GENERIC_OFFICE_DESK_ASSET = Object.freeze({
  id: 'generic-office-desk',
  category: 'furniture',
  source: 'in-house-generated',
  license: 'DeskLab-owned',
});

const GENERIC_KEYBOARD_ASSET = Object.freeze({
  id: 'generic-keyboard',
  category: 'peripheral',
  source: 'in-house-generated',
  license: 'DeskLab-owned',
});

const GENERIC_MOUSE_ASSET = Object.freeze({
  id: 'generic-mouse',
  category: 'peripheral',
  source: 'in-house-generated',
  license: 'DeskLab-owned',
});

const GENERIC_MODEL_ASSET_BY_MODEL_ID = Object.freeze({
  'monitor-24': GENERIC_MONITOR_ASSET,
  'monitor-27': GENERIC_MONITOR_ASSET,
  'ultrawide-monitor': GENERIC_MONITOR_ASSET,
  'power-strip': GENERIC_POWER_STRIP_ASSET,
  router: GENERIC_ROUTER_ASSET,
  'desktop-pc': GENERIC_DESKTOP_PC_ASSET,
  'power-adapter': GENERIC_POWER_ADAPTER_ASSET,
  'wall-outlet': GENERIC_WALL_OUTLET_ASSET,
  'laptop-15': GENERIC_LAPTOP_ASSET,
  'office-desk': GENERIC_OFFICE_DESK_ASSET,
  keyboard: GENERIC_KEYBOARD_ASSET,
  mouse: GENERIC_MOUSE_ASSET,
});

export function getGenericModelAsset(modelId) {
  return GENERIC_MODEL_ASSET_BY_MODEL_ID[modelId] || null;
}

export function hasGenericModelAsset(modelId) {
  return Boolean(getGenericModelAsset(modelId));
}
