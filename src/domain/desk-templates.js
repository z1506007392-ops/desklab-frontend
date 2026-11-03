import { findModelTemplate } from './catalog.js';
import { buildDeskScene } from './scene-builder.js';
import { placeCatalogObject } from './placement.js';

// Starting points a person would actually photograph. Each one is a placed,
// fully wired desk, shared by the web app and the Tauri shell. Measurements
// follow the 2026-11-04 desk-setup brief: centre the primary axis, keyboard
// about 10 cm from the front edge, mouse tight on the seat's right, tower on
// the floor, one strip and one cable tray under the back of the desktop.
// Two catalog 27-inch panels are 0.62 m wide each, so a primary-centred plus
// side-by-side pair does not fit a 1.6 m desk without a long empty wing; the
// dual preset uses the brief's equal-use shallow V instead, seam on the
// centre line, each screen turned inward about 20°.
export const DESK_TEMPLATES = Object.freeze([
  Object.freeze({
    id: 'home-office',
    name: '极简单屏',
    description: '1.4×0.75 米桌。27 英寸居中靠后，键盘离前沿约 10 厘米，鼠标紧挨在右手边，两侧留空。桌下有一只理线槽。不放笔记本，避免桌面中间再立一块屏。',
    desk: Object.freeze({ length: 1.4, depth: 0.75 }),
    devices: Object.freeze([
      Object.freeze({ modelId: 'monitor-27', count: 1 }),
      Object.freeze({ modelId: 'keyboard', count: 1 }),
      Object.freeze({ modelId: 'mouse', count: 1 }),
    ]),
  }),
  Object.freeze({
    id: 'desktop-dual',
    name: '电竞双屏',
    description: '1.6×0.85 米桌。两台 27 英寸各向内约 20°，接缝在座位正前方。键盘和鼠标对准接缝，前面留出手的位置。主机在左侧地上。桌下有一只理线槽。',
    arrangement: 'shallow-v',
    desk: Object.freeze({ length: 1.6, depth: 0.85 }),
    devices: Object.freeze([
      Object.freeze({ modelId: 'desktop-pc', count: 1 }),
      Object.freeze({ modelId: 'monitor-27', count: 2 }),
      Object.freeze({ modelId: 'keyboard', count: 1 }),
      Object.freeze({ modelId: 'mouse', count: 1 }),
    ]),
  }),
  Object.freeze({
    id: 'gaming',
    name: '超宽',
    description: '1.6×0.8 米桌。带鱼屏居中，键盘对准屏幕中线，鼠标在右手边。主机在左侧地上，路由器靠后墙。桌下有一只理线槽。带鱼屏前不再放笔记本。',
    desk: Object.freeze({ length: 1.6, depth: 0.8 }),
    devices: Object.freeze([
      Object.freeze({ modelId: 'desktop-pc', count: 1 }),
      Object.freeze({ modelId: 'ultrawide-monitor', count: 1 }),
      Object.freeze({ modelId: 'router', count: 1 }),
      Object.freeze({ modelId: 'keyboard', count: 1 }),
      Object.freeze({ modelId: 'mouse', count: 1 }),
    ]),
  }),
]);

// One tray under the back edge. The generator used by「按我的设备生成」does
// not add one; these three photographed presets do.
function mountPresetTray(scene) {
  if (scene.objects.some(object => object.modelId === 'cable-tray')) return scene;
  const template = findModelTemplate({ modelId: 'cable-tray' });
  const placed = placeCatalogObject({
    modelTemplate: template,
    categoryId: 'accessory',
    room: scene.room,
    id: 'cable-tray',
    objects: scene.objects,
  });
  if (!placed.valid) return scene;
  return { ...scene, objects: [...scene.objects, placed.object] };
}

export function buildTemplateScene(templateId) {
  const template = DESK_TEMPLATES.find(candidate => candidate.id === templateId);
  if (!template) return null;
  const scene = buildDeskScene({
    desk: template.desk,
    devices: template.devices,
    arrangement: template.arrangement,
  });
  return scene ? mountPresetTray(scene) : null;
}
