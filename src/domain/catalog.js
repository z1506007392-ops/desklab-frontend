// Vite replaces import.meta.env.BASE_URL at build time. Node tests have no env
// object, so the access throws and we fall back to a root-absolute URL.
function assetBaseUrl() {
  try {
    const base = import.meta.env.BASE_URL;
    if (typeof base === 'string' && base.length > 0) {
      return base.endsWith('/') ? base : `${base}/`;
    }
  } catch {
    // import.meta.env is undefined under node --test.
  }
  return '/';
}

/** Public URL for a catalog GLB, including Vite's `base`. */
export function catalogModelUrl(modelId) {
  return `${assetBaseUrl()}models/${modelId}.glb`;
}

// The small picture on the asset library card, rendered from the GLB by
// tools/thumbnails/render-thumbnails.mjs.
export function catalogThumbnailUrl(modelId) {
  return `${assetBaseUrl()}thumbnails/${modelId}.webp`;
}

export const DEVICE_CATALOG = [
  {
    category: 'furniture', categoryName: '家具',
    models: [
      { type: 'office-desk', modelId: 'office-desk', displayName: '书桌', shape: 'rect', assetUrl: catalogModelUrl('office-desk'), defaultScale: { x: 1.4, y: 0.7, z: 0.75 }, color: '#1e88e5' },
    ],
  },
  {
    category: 'computer', categoryName: '电脑',
    models: [
      { type: 'desktop-pc', modelId: 'desktop-pc', displayName: '台式主机', shape: 'rect', assetUrl: catalogModelUrl('desktop-pc'), defaultScale: { x: 0.25, y: 0.5, z: 0.5 }, color: '#424242', wattage: 350, ports: [{ id: 'ac-in', name: '电源输入', type: 'ac_input', direction: 'input' }, { id: 'hdmi-out', name: 'HDMI 输出', type: 'hdmi', direction: 'output' }, { id: 'dp-out', name: 'DP 输出', type: 'displayport', direction: 'output' }, { id: 'usb-1', name: 'USB 1', type: 'usb', direction: 'bidirectional' }, { id: 'usb-2', name: 'USB 2', type: 'usb', direction: 'bidirectional' }, { id: 'audio-out', name: '耳机孔', type: 'audio', direction: 'output' }, { id: 'eth-1', name: '网口', type: 'ethernet', direction: 'bidirectional' }] },
      { type: 'laptop', modelId: 'laptop-15', displayName: '15 英寸笔记本', shape: 'rect', assetUrl: catalogModelUrl('laptop-15'), defaultScale: { x: 0.36, y: 0.28, z: 0.22 }, color: '#607d8b', wattage: 65, ports: [{ id: 'dc-in', name: 'DC 输入', type: 'dc_input', direction: 'input' }, { id: 'usb-c', name: 'USB-C', type: 'usb_c', direction: 'bidirectional' }, { id: 'usb-1', name: 'USB 1', type: 'usb', direction: 'bidirectional' }, { id: 'usb-2', name: 'USB 2', type: 'usb', direction: 'bidirectional' }, { id: 'audio-out', name: '耳机孔', type: 'audio', direction: 'output' }, { id: 'hdmi-out', name: 'HDMI 输出', type: 'hdmi', direction: 'output' }] },
    ],
  },
  {
    category: 'display', categoryName: '显示设备',
    models: [
      { type: 'monitor', modelId: 'monitor-24', displayName: '24 英寸显示器', shape: 'rect', assetUrl: catalogModelUrl('monitor-24'), defaultScale: { x: 0.54, y: 0.05, z: 0.32 }, color: '#212121', wattage: 30, ports: [{ id: 'ac-in', name: '电源输入', type: 'ac_input', direction: 'input' }, { id: 'hdmi-in', name: 'HDMI 输入', type: 'hdmi', direction: 'input' }, { id: 'dp-in', name: 'DP 输入', type: 'displayport', direction: 'input' }] },
      { type: 'monitor', modelId: 'monitor-27', displayName: '27 英寸显示器', shape: 'rect', assetUrl: catalogModelUrl('monitor-27'), defaultScale: { x: 0.62, y: 0.06, z: 0.37 }, color: '#111111', wattage: 45, ports: [{ id: 'ac-in', name: '电源输入', type: 'ac_input', direction: 'input' }, { id: 'hdmi-in', name: 'HDMI 输入', type: 'hdmi', direction: 'input' }, { id: 'dp-in', name: 'DP 输入', type: 'displayport', direction: 'input' }] },
      { type: 'monitor', modelId: 'ultrawide-monitor', displayName: '带鱼屏显示器', shape: 'rect', assetUrl: catalogModelUrl('ultrawide-monitor'), defaultScale: { x: 0.82, y: 0.1, z: 0.36 }, color: '#000000', wattage: 60, ports: [{ id: 'ac-in', name: '电源输入', type: 'ac_input', direction: 'input' }, { id: 'hdmi-in', name: 'HDMI 输入', type: 'hdmi', direction: 'input' }, { id: 'dp-in', name: 'DP 输入', type: 'displayport', direction: 'input' }] },
    ],
  },
  {
    category: 'peripheral', categoryName: '外设',
    models: [
      { type: 'keyboard', modelId: 'keyboard', displayName: '键盘', shape: 'rect', assetUrl: catalogModelUrl('keyboard'), defaultScale: { x: 0.44, y: 0.15, z: 0.032 }, color: '#2c333a', wattage: 2, ports: [{ id: 'usb-1', name: 'USB', type: 'usb', direction: 'bidirectional' }] },
      { type: 'mouse', modelId: 'mouse', displayName: '鼠标', shape: 'rect', assetUrl: catalogModelUrl('mouse'), defaultScale: { x: 0.062, y: 0.115, z: 0.038 }, color: '#3a4149', wattage: 1, ports: [{ id: 'usb-1', name: 'USB', type: 'usb', direction: 'bidirectional' }] },
    ],
  },
  {
    category: 'lighting', categoryName: '灯',
    models: [
      { type: 'desk-lamp', modelId: 'desk-lamp', displayName: '台灯', shape: 'rect', assetUrl: catalogModelUrl('desk-lamp'), defaultScale: { x: 0.16, y: 0.16, z: 0.42 }, color: '#2c3338', wattage: 8, ports: [{ id: 'ac-in', name: '电源输入', type: 'ac_input', direction: 'input' }] },
    ],
  },
  {
    category: 'audio', categoryName: '音频',
    models: [
      { type: 'speakers', modelId: 'speakers', displayName: '音箱', shape: 'rect', assetUrl: catalogModelUrl('speakers'), defaultScale: { x: 0.32, y: 0.12, z: 0.18 }, color: '#1f2428', wattage: 18, ports: [{ id: 'ac-in', name: '电源输入', type: 'ac_input', direction: 'input' }, { id: 'audio-in', name: '音频输入', type: 'audio', direction: 'input' }] },
    ],
  },
  {
    category: 'network', categoryName: '网络',
    models: [
      { type: 'router', modelId: 'router', displayName: '路由器', shape: 'rect', assetUrl: catalogModelUrl('router'), defaultScale: { x: 0.35, y: 0.25, z: 0.08 }, color: '#4caf50', wattage: 12, ports: [{ id: 'dc-in', name: 'DC 输入', type: 'dc_input', direction: 'input' }, { id: 'lan-1', name: '网口 1', type: 'ethernet', direction: 'bidirectional' }, { id: 'lan-2', name: '网口 2', type: 'ethernet', direction: 'bidirectional' }, { id: 'lan-3', name: '网口 3', type: 'ethernet', direction: 'bidirectional' }] },
    ],
  },
  {
    category: 'power', categoryName: '电源',
    models: [
      { type: 'power_strip', modelId: 'power-strip', displayName: '插排', shape: 'rect', assetUrl: catalogModelUrl('power-strip'), defaultScale: { x: 0.8, y: 0.08, z: 0.05 }, color: '#f44336', maxLoad: 2500, ports: [{ id: 'ac-in', name: '电源输入', type: 'ac_input', direction: 'input' }, ...Array(6).fill(0).map((_, i) => ({ id: `ac-out-${i + 1}`, name: `插孔 ${i + 1}`, type: 'ac_output', direction: 'output' }))] },
      { type: 'outlet', modelId: 'wall-outlet', displayName: '墙壁插座', shape: 'rect', assetUrl: catalogModelUrl('wall-outlet'), defaultScale: { x: 0.08, y: 0.02, z: 0.08 }, color: '#ffeb3b', maxLoad: 3500, ports: [{ id: 'ac-out-1', name: '插座 1', type: 'ac_output', direction: 'output' }, { id: 'ac-out-2', name: '插座 2', type: 'ac_output', direction: 'output' }] },
      { type: 'power-adapter', modelId: 'power-adapter', displayName: '电源适配器', shape: 'rect', assetUrl: catalogModelUrl('power-adapter'), defaultScale: { x: 0.1, y: 0.05, z: 0.03 }, color: '#263238', wattage: 5, maxLoad: 150, ports: [{ id: 'ac-in', name: 'AC 插头', type: 'ac_input', direction: 'input' }, { id: 'dc-out', name: 'DC 输出', type: 'dc_output', direction: 'output' }] },
    ],
  },
];

const LEGACY_MODEL_BY_TYPE = {
  table: { category: 'furniture', modelId: 'office-desk' },
  monitor: { category: 'display', modelId: 'monitor-24' },
  pc: { category: 'computer', modelId: 'desktop-pc' },
  router: { category: 'network', modelId: 'router' },
  power_strip: { category: 'power', modelId: 'power-strip' },
  outlet: { category: 'power', modelId: 'wall-outlet' },
};

export function getLegacyModelInfo(type) {
  return LEGACY_MODEL_BY_TYPE[type] || { category: 'unknown', modelId: 'unknown' };
}

export function findModelTemplate({ category, modelId, type } = {}) {
  const allModels = DEVICE_CATALOG.flatMap(candidate => candidate.models);
  const preferredModels = category
    ? DEVICE_CATALOG.filter(candidate => candidate.category === category)
      .flatMap(candidate => candidate.models)
    : allModels;
  return allModels.find(model => model.modelId === modelId)
    || preferredModels.find(model => model.type === type)
    || allModels.find(model => model.type === type)
    || null;
}

const VIDEO_PORT_LABELS = Object.freeze({ usb_c: 'USB-C', hdmi: 'HDMI', displayport: 'DP' });

/** One-line, user-facing spec summary for the asset library. */
export function describeCatalogModel(model) {
  const ports = model.ports || [];
  const parts = [];
  if (model.category === 'furniture' || model.type === 'office-desk') {
    parts.push(`${model.defaultScale.x} × ${model.defaultScale.y} m`, '尺寸可调');
  }
  const acOutputs = ports.filter(port => port.type === 'ac_output').length;
  const hasDcOutput = ports.some(port => port.type === 'dc_output');
  const isPluggedPowerGear = (acOutputs > 0 || hasDcOutput)
    && ports.some(port => port.type === 'ac_input' || port.type === 'dc_input');
  const videoLabels = [...new Set(ports.map(port => VIDEO_PORT_LABELS[port.type]).filter(Boolean))];
  if (acOutputs > 0) parts.push(`${acOutputs} 孔`);
  if (hasDcOutput) parts.push('DC 输出');
  // A strip or adapter's limit matters when buying one; a wall outlet's does not.
  if (isPluggedPowerGear && model.maxLoad) parts.push(`最大 ${model.maxLoad}W`);
  // Power draw is shown for computers and screens, the devices that add load.
  if (videoLabels.length > 0 && model.wattage) parts.push(`约 ${model.wattage}W`);
  if (videoLabels.length > 0) parts.push(videoLabels.join(' / '));
  const ethernetPorts = ports.filter(port => port.type === 'ethernet').length;
  if (ethernetPorts > 1) parts.push(`${ethernetPorts} 个网口`);
  else if (ethernetPorts === 1) parts.push('网口');
  const plainUsb = videoLabels.length === 0 && ports.some(port => port.type === 'usb');
  if (plainUsb && model.wattage) parts.push(`约 ${model.wattage}W`);
  if (plainUsb) parts.push('USB');
  else if (parts.length === 0 && model.wattage) parts.push(`约 ${model.wattage}W`);
  if (ports.some(port => port.type === 'audio') && videoLabels.length === 0) parts.push('3.5mm');
  return parts.join(' · ');
}

export function getModelDefaultScale(category, modelId) {
  return findModelTemplate({ category, modelId })?.defaultScale || null;
}

// Normalized anchors (x width, y depth, z height; +y is three.js +Z / the
// model's authored front). Measured from the GLB primitives so cables meet
// the connector instead of the bounding-box centre. Wall-outlet anchors stay
// on -y: wall snap aims that side into the room, and the mesh is yawed 180°
// in the renderer so the face plate lands there too.
const PORT_ANCHOR_BY_MODEL = {
  'desktop-pc': {
    'ac-in': { x: 0.2, y: -0.5, z: -0.2 },
    'hdmi-out': { x: -0.22, y: -0.5, z: 0.22 },
    'dp-out': { x: 0, y: -0.5, z: 0.22 },
    'usb-1': { x: -0.42, y: -0.5, z: 0.05 },
    'usb-2': { x: -0.42, y: -0.5, z: -0.22 },
    'audio-out': { x: 0.42, y: -0.5, z: 0.05 },
    'eth-1': { x: 0.22, y: -0.5, z: 0.22 },
  },
  'laptop-15': {
    'dc-in': { x: -0.5, y: -0.1, z: -0.45 },
    'usb-c': { x: 0.5, y: 0.2, z: -0.45 },
    'usb-1': { x: 0.5, y: 0.05, z: -0.45 },
    'usb-2': { x: -0.5, y: 0.15, z: -0.45 },
    'audio-out': { x: -0.5, y: 0.28, z: -0.45 },
    'hdmi-out': { x: 0.5, y: -0.25, z: -0.45 },
  },
  keyboard: {
    'usb-1': { x: 0, y: -0.5, z: -0.1 },
  },
  mouse: {
    'usb-1': { x: 0, y: -0.5, z: 0 },
  },
  'desk-lamp': {
    'ac-in': { x: 0, y: -0.5, z: -0.42 },
  },
  speakers: {
    'audio-in': { x: 0.24, y: -0.5, z: 0.12 },
    'ac-in': { x: 0.38, y: -0.5, z: -0.12 },
  },
  'monitor-24': {
    'ac-in': { x: -0.12, y: -0.16, z: 0.05 },
    'hdmi-in': { x: 0, y: -0.16, z: 0.05 },
    'dp-in': { x: 0.12, y: -0.16, z: 0.05 },
  },
  'monitor-27': {
    'ac-in': { x: -0.12, y: -0.16, z: 0.05 },
    'hdmi-in': { x: 0, y: -0.16, z: 0.05 },
    'dp-in': { x: 0.12, y: -0.16, z: 0.05 },
  },
  'ultrawide-monitor': {
    'ac-in': { x: -0.1, y: -0.42, z: 0.05 },
    'hdmi-in': { x: 0, y: -0.42, z: 0.05 },
    'dp-in': { x: 0.1, y: -0.42, z: 0.05 },
  },
  router: {
    'dc-in': { x: -0.257, y: 0.5, z: -0.295 },
    'lan-1': { x: -0.129, y: 0.5, z: -0.295 },
    'lan-2': { x: 0, y: 0.5, z: -0.295 },
    'lan-3': { x: 0.129, y: 0.5, z: -0.295 },
  },
  'power-strip': {
    'ac-in': { x: -0.5, y: 0, z: -0.1 },
    'ac-out-1': { x: -0.296, y: 0, z: 0.5 },
    'ac-out-2': { x: -0.149, y: 0, z: 0.5 },
    'ac-out-3': { x: -0.001, y: 0, z: 0.5 },
    'ac-out-4': { x: 0.146, y: 0, z: 0.5 },
    'ac-out-5': { x: 0.294, y: 0, z: 0.5 },
    'ac-out-6': { x: 0.441, y: 0, z: 0.5 },
  },
  'wall-outlet': {
    'ac-out-1': { x: 0, y: -0.5, z: -0.094 },
    'ac-out-2': { x: 0, y: -0.5, z: 0.188 },
  },
  'power-adapter': {
    'ac-in': { x: 0, y: 0.5, z: 0 },
    'dc-out': { x: 0, y: -0.5, z: 0 },
  },
};

export function getDefaultPortAnchor(port, index, ports, modelId) {
  const authored = PORT_ANCHOR_BY_MODEL[modelId]?.[port.id];
  if (authored) return { ...authored };
  const spread = ports.length > 1 ? -0.4 + (0.8 * index) / (ports.length - 1) : 0;
  return {
    x: spread,
    y: 0.5,
    z: port.type === 'ac_input' || port.type === 'dc_input' ? -0.25 : 0,
  };
}

export function withPortAnchors(ports, modelId) {
  return ports.map((port, index) => ({
    ...port,
    anchor: port.anchor || getDefaultPortAnchor(port, index, ports, modelId),
  }));
}

// Saves from before the open-lid laptop GLB stored a closed-lid height
// (about 0.058 or 0.105 m). Scaling the new mesh to that squashes it into a
// flat tray, so heights below this share of the default are restored.
const LEGACY_LAPTOP_HEIGHT_RATIO = 0.6;

function migrateLegacyLaptopHeight(object, template) {
  if (template?.modelId !== 'laptop-15' || !object.scale || !object.position) return object;
  const targetZ = template.defaultScale.z;
  const storedZ = Number(object.scale.z);
  if (!Number.isFinite(storedZ) || storedZ >= targetZ * LEGACY_LAPTOP_HEIGHT_RATIO) return object;
  // Keep the bottom where it was so the laptop still rests on the desk.
  const bottom = Number(object.position.z) - storedZ / 2;
  return {
    ...object,
    scale: { ...object.scale, z: targetZ },
    position: { ...object.position, z: bottom + targetZ / 2 },
  };
}

// Anchors saved for an older mesh no longer sit on the current GLB's
// connectors, so catalog ports take the authored anchor; anything else keeps
// its stored anchor.
function withCurrentPortAnchors(ports, modelId) {
  const authored = PORT_ANCHOR_BY_MODEL[modelId];
  return withPortAnchors(ports, modelId).map(port => (
    authored?.[port.id] ? { ...port, anchor: { ...authored[port.id] } } : port
  ));
}

export function hydrateProjectObjects(objects) {
  return objects.map(object => {
    const template = findModelTemplate(object);
    const ports = (!object.ports || object.ports.length === 0) && template?.ports?.length
      ? JSON.parse(JSON.stringify(template.ports))
      : (object.ports || []);
    return {
      ...migrateLegacyLaptopHeight(object, template),
      assetUrl: template ? template.assetUrl : object.assetUrl,
      ports: withCurrentPortAnchors(ports, object.modelId || template?.modelId),
    };
  });
}
