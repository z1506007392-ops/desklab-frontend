import { buildDeskScene } from './scene-builder.js';

// Starting points a person would actually photograph. Each one is a placed,
// fully wired desk. Measurements follow the 2026-11-04 desk-setup brief:
// centre the primary axis, keyboard about 10 cm from the front edge, mouse
// tight on the seat's right, tower on the floor, one strip hung under the
// back of the desktop. Two catalog 27-inch panels are 0.62 m wide each, so a
// primary-centred plus side-by-side pair does not fit a 1.6 m desk without a
// long empty wing; the dual preset uses the brief's equal-use shallow V
// instead, seam on the centre line.
export const DESK_TEMPLATES = Object.freeze([
  Object.freeze({
    id: 'home-office',
    name: '极简单屏',
    description: '1.4 米桌。27 英寸显示器居中靠后，键盘和鼠标在正前方，两侧留空。不放笔记本，避免桌面中间再立一块屏。',
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
    description: '1.6×0.85 米桌。两台 27 英寸显示器并排、各向内转约 18°，接缝在座位正前方。键盘和鼠标对准接缝，前面留出手的位置，主机在左侧地上。',
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
    description: '1.6 米深 0.8 米桌。带鱼屏居中靠后，键盘和鼠标对准屏幕中线。主机在左侧地上，路由器靠后墙，不在带鱼屏前再开一台笔记本。',
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

export function buildTemplateScene(templateId) {
  const template = DESK_TEMPLATES.find(candidate => candidate.id === templateId);
  if (!template) return null;
  return buildDeskScene({
    desk: template.desk,
    devices: template.devices,
    arrangement: template.arrangement,
  });
}
