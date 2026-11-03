import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

import {
  DEVICE_CATALOG,
  catalogBranches,
  catalogModelUrl,
  describeCatalogModel,
  findModelTemplate,
  searchCatalogModels,
  getModelDefaultScale,
  hydrateProjectObjects,
  withPortAnchors,
} from '../src/domain/catalog.js';
import { isPortDirectionConsistent, getPortWorldPosition } from '../src/domain/connections.js';
import { snapWallOutletToNearestWall } from '../src/domain/layout-analysis.js';

const VALID_PORT_DIRECTIONS = new Set(['input', 'output', 'bidirectional']);
const isNonBlankString = (value) => typeof value === 'string' && value.trim().length > 0;

test('catalog model ids, dimensions, and per-model port ids are valid', () => {
  const categoryIds = new Set();
  const modelIds = new Set();

  for (const category of DEVICE_CATALOG) {
    assert.equal(categoryIds.has(category.category), false, `duplicate category ${category.category}`);
    categoryIds.add(category.category);
    for (const model of category.models) {
      assert.equal(modelIds.has(model.modelId), false, `duplicate model ${model.modelId}`);
      modelIds.add(model.modelId);
      for (const axis of ['x', 'y', 'z']) {
        assert.ok(Number.isFinite(model.defaultScale[axis]) && model.defaultScale[axis] > 0);
      }
      const portIds = (model.ports || []).map(port => port.id);
      assert.equal(new Set(portIds).size, portIds.length, `duplicate port id on ${model.modelId}`);
    }
  }
});

test('every catalog port has a valid, direction-consistent definition', () => {
  for (const category of DEVICE_CATALOG) {
    for (const model of category.models) {
      for (const port of model.ports || []) {
        const where = `${model.modelId}.${port.id}`;
        assert.ok(isNonBlankString(port.id), `${where} id must be a non-empty string`);
        assert.ok(isNonBlankString(port.name), `${where} name must be a non-empty string`);
        assert.ok(isNonBlankString(port.type), `${where} type must be a non-empty string`);
        assert.ok(
          VALID_PORT_DIRECTIONS.has(port.direction),
          `${where} direction "${port.direction}" is not valid`
        );
        assert.ok(
          isPortDirectionConsistent(port),
          `${where} power port direction must match its type`
        );
      }
    }
  }
});

test('generated port anchors stay normalized and preserve explicit anchors', () => {
  for (const category of DEVICE_CATALOG) {
    for (const model of category.models) {
      const ports = withPortAnchors(model.ports || [], model.modelId);
      for (const port of ports) {
        for (const axis of ['x', 'y', 'z']) {
          assert.ok(port.anchor[axis] >= -0.5 && port.anchor[axis] <= 0.5);
        }
      }
    }
  }

  const explicit = { x: 0.1, y: -0.2, z: 0.3 };
  const [port] = withPortAnchors([
    { id: 'custom', type: 'other', direction: 'bidirectional', anchor: explicit },
  ], 'custom-model');
  assert.equal(port.anchor, explicit);
});

test('no two ports on a model share a default anchor position', () => {
  // Cabling clarity depends on each port having a distinct world anchor; two ports
  // at the same point make connections visually ambiguous. Guards the port-anchor
  // accuracy the model-asset work relies on as the catalog grows.
  for (const category of DEVICE_CATALOG) {
    for (const model of category.models) {
      const ports = withPortAnchors(model.ports || [], model.modelId);
      const seen = new Map();
      for (const port of ports) {
        const key = ['x', 'y', 'z'].map(axis => port.anchor[axis].toFixed(4)).join(',');
        assert.equal(
          seen.has(key),
          false,
          `${model.modelId}: ports "${seen.get(key)}" and "${port.id}" share anchor ${key}`
        );
        seen.set(key, port.id);
      }
    }
  }
});

test('home catalog leaves out switch, NAS, and modem, and the router has no WAN port', () => {
  const modelIds = DEVICE_CATALOG.flatMap(category => category.models.map(model => model.modelId));
  for (const removed of ['switch', 'nas-2bay', 'modem']) {
    assert.equal(modelIds.includes(removed), false, `${removed} should not be offered`);
    assert.equal(findModelTemplate({ modelId: removed }), null);
  }

  const router = findModelTemplate({ modelId: 'router' });
  assert.ok(router, 'the router stays available for wired desktops');
  assert.equal(router.ports.some(port => /wan/i.test(port.id) || /wan/i.test(port.name)), false);
  assert.ok(router.ports.filter(port => port.type === 'ethernet').length >= 3);
});

test('categories with several kinds ask for a kind, and a single kind does not', () => {
  const names = category => catalogBranches(DEVICE_CATALOG.find(item => item.category === category)).map(branch => branch.name);
  assert.deepEqual(names('computer'), ['台式主机', '笔记本']);
  assert.deepEqual(names('peripheral'), ['键盘', '鼠标']);
  assert.equal(catalogBranches(DEVICE_CATALOG.find(item => item.category === 'display')).length, 1);
  assert.equal(catalogBranches(DEVICE_CATALOG.find(item => item.category === 'power')).length, 1);
  assert.deepEqual(DEVICE_CATALOG.map(item => item.categoryName), ['桌子', '电脑', '娱乐', '显示器', '外设', '配件', '灯', '音频', '网络', '供电']);
});

test('home catalog offers one adjustable desk and leaves out mini PCs and all-in-ones', () => {
  const furniture = DEVICE_CATALOG.find(category => category.category === 'furniture');
  assert.deepEqual(furniture.models.map(model => [model.modelId, model.displayName]), [['office-desk', '书桌']]);

  const modelIds = DEVICE_CATALOG.flatMap(category => category.models.map(model => model.modelId));
  for (const removed of ['gaming-desk', 'standing-desk', 'l-desk', 'mini-pc', 'all-in-one']) {
    assert.equal(modelIds.includes(removed), false, `${removed} should not be offered`);
  }
});

test('saved objects of removed models still load with their stored ports', () => {
  const storedPorts = [{ id: 'dc-in', name: 'DC 输入', type: 'dc_input', direction: 'input' }];
  const [hydrated] = hydrateProjectObjects([
    { id: 'old-mini', type: 'mini-pc', category: 'computer', modelId: 'mini-pc', ports: storedPorts },
  ]);

  assert.equal(hydrated.modelId, 'mini-pc');
  assert.deepEqual(hydrated.ports.map(({ id, type }) => ({ id, type })), [{ id: 'dc-in', type: 'dc_input' }]);
  assert.ok(hydrated.ports[0].anchor, 'stored ports still receive a default anchor');
  assert.equal(getModelDefaultScale('computer', 'mini-pc'), null);
});

test('search matches the name, the kind, and the spec line', () => {
  const ids = query => searchCatalogModels(query).map(model => model.modelId);
  for (const category of DEVICE_CATALOG) {
    for (const model of category.models) {
      const found = searchCatalogModels(model.displayName);
      const match = found.find(item => item.modelId === model.modelId);
      assert.ok(match, `${model.modelId} should be found by its name`);
      assert.equal(match.categoryId, category.category);
    }
  }
  assert.deepEqual(ids(''), []);
  assert.deepEqual(ids('   '), []);
  assert.deepEqual(ids('没有这种设备'), []);
  assert.ok(ids('键盘').includes('keyboard'));
  for (const modelId of ['monitor-24', 'monitor-27', 'ultrawide-monitor']) {
    assert.ok(ids('HDMI').includes(modelId), modelId);
    assert.ok(ids('hdmi').includes(modelId), modelId);
  }
  const hosts = ids('主机');
  assert.ok(hosts.includes('desktop-pc'));
  assert.ok(hosts.includes('game-console'));
  assert.deepEqual(ids('游戏主机'), ['game-console']);
});

test('catalog models have a short user-facing spec line instead of internal ids', () => {
  const describe = modelId => describeCatalogModel(findModelTemplate({ modelId }));
  assert.equal(describe('office-desk'), '1.4 × 0.7 m · 尺寸可调');
  assert.equal(describe('desktop-pc'), '约 350W · HDMI / DP · 网口');
  assert.equal(describe('laptop-15'), '约 65W · USB-C / HDMI');
  assert.equal(describe('monitor-27'), '约 45W · HDMI / DP');
  assert.equal(describe('router'), '3 个网口');
  assert.equal(describe('power-strip'), '6 孔 · 最大 2500W');
  assert.equal(describe('wall-outlet'), '2 孔');
  assert.equal(describe('power-adapter'), 'DC 输出 · 最大 150W');
  assert.equal(describe('keyboard'), '约 2W · USB');
  assert.equal(describe('mouse'), '约 1W · USB');
  assert.equal(describe('desk-lamp'), '约 8W');
  assert.equal(describe('speakers'), '约 18W · 3.5mm');
  assert.equal(describe('monitor-stand'), '夹桌 · 可放显示器');
  assert.equal(describe('cable-tray'), '桌下 · 收后沿的线');
  assert.equal(describe('game-console'), '约 200W · HDMI · 网口');

  for (const category of DEVICE_CATALOG) {
    for (const model of category.models) {
      const line = describeCatalogModel(model);
      assert.ok(line.length > 0, `${model.modelId} needs a spec line`);
      assert.equal(line.includes(model.modelId), false, `${model.modelId} spec line should not show internal ids`);
    }
  }
});

test('modelId matching wins over shared legacy type matching', () => {
  const template = findModelTemplate({ modelId: 'monitor-27', type: 'monitor' });
  assert.equal(template.modelId, 'monitor-27');
  const staleCategoryTemplate = findModelTemplate({ category: 'computer', modelId: 'monitor-27', type: 'monitor' });
  assert.equal(staleCategoryTemplate.modelId, 'monitor-27');
  assert.deepEqual(getModelDefaultScale('display', 'monitor-27'), { x: 0.62, y: 0.2, z: 0.45 });
});

test('project hydration adds current ports and anchors without overwriting custom anchors', () => {
  const customAnchor = { x: 0.2, y: 0.3, z: 0.4 };
  const hydrated = hydrateProjectObjects([
    { id: 'legacy', type: 'laptop', modelId: 'laptop-15', assetUrl: '/stale.glb' },
    {
      id: 'custom',
      type: 'laptop',
      modelId: 'laptop-15',
      ports: [{ id: 'custom-port', name: 'Custom', type: 'usb_c', direction: 'bidirectional', anchor: customAnchor }],
    },
  ]);

  assert.equal(hydrated[0].assetUrl, catalogModelUrl('laptop-15'));
  assert.equal(new URL(hydrated[0].assetUrl, 'https://desklab.local').pathname, '/models/laptop-15.glb');
  assert.ok(hydrated[0].ports.length > 0);
  assert.ok(hydrated[0].ports.every(port => port.anchor));
  assert.deepEqual(hydrated[1].ports[0].anchor, customAnchor);
});

test('every catalog model points at its own GLB under the public models directory', () => {
  for (const category of DEVICE_CATALOG) {
    for (const model of category.models) {
      const url = catalogModelUrl(model.modelId);
      assert.equal(model.assetUrl, url);
      assert.match(url, new RegExp(`/models/${model.modelId}\\.glb\\?v=[0-9a-f]{8}$`));
      assert.equal(
        existsSync(new URL(`../public/models/${model.modelId}.glb`, import.meta.url)),
        true,
        `${model.modelId} GLB should be in public/models`
      );
    }
  }
});

test('default port anchors meet the connector on each GLB', () => {
  const anchorsFor = modelId => {
    const model = findModelTemplate({ modelId });
    return Object.fromEntries(
      withPortAnchors(model.ports, modelId).map(port => [port.id, port.anchor])
    );
  };

  // Rear panel of the tower, not the front fan.
  for (const anchor of Object.values(anchorsFor('desktop-pc'))) {
    assert.equal(anchor.y, -0.5);
  }
  // Sides of the base, below the lid.
  for (const anchor of Object.values(anchorsFor('laptop-15'))) {
    assert.equal(Math.abs(anchor.x), 0.5);
    assert.ok(anchor.z < -0.4);
  }
  // Back of the panel. The ultrawide's centre bows further back than the flat panels.
  for (const modelId of ['monitor-24', 'monitor-27']) {
    for (const anchor of Object.values(anchorsFor(modelId))) {
      assert.ok(anchor.y < 0 && anchor.y > -0.3, modelId);
    }
  }
  for (const anchor of Object.values(anchorsFor('ultrawide-monitor'))) {
    assert.ok(anchor.y < -0.3);
  }
  // Front jacks, below the antenna midline.
  for (const anchor of Object.values(anchorsFor('router'))) {
    assert.equal(anchor.y, 0.5);
    assert.ok(anchor.z < 0);
  }
  const strip = anchorsFor('power-strip');
  assert.deepEqual(strip['ac-in'], { x: -0.5, y: 0, z: -0.1 });
  for (const [id, anchor] of Object.entries(strip)) {
    if (id === 'ac-in') continue;
    assert.equal(anchor.y, 0);
    assert.equal(anchor.z, 0.5);
  }
  const adapter = anchorsFor('power-adapter');
  assert.deepEqual(adapter['ac-in'], { x: 0, y: 0.5, z: 0 });
  assert.deepEqual(adapter['dc-out'], { x: 0, y: -0.5, z: 0 });

  // Wall snap aims local -y into the room. The plate is yawed onto that side,
  // so both sockets stay on -y and must not share a height.
  const outlet = anchorsFor('wall-outlet');
  assert.equal(outlet['ac-out-1'].y, -0.5);
  assert.equal(outlet['ac-out-2'].y, -0.5);
  assert.ok(outlet['ac-out-1'].z < outlet['ac-out-2'].z);
  const room = { length: 5, width: 4, height: 3 };
  const template = findModelTemplate({ modelId: 'wall-outlet' });
  const snapped = snapWallOutletToNearestWall(room, {
    type: 'outlet',
    modelId: 'wall-outlet',
    scale: { ...template.defaultScale },
    position: { x: 0.3, y: 1.8, z: 1 },
    rotation: { x: 0, y: 0, z: 0 },
    ports: withPortAnchors(template.ports, 'wall-outlet'),
  });
  for (const port of snapped.ports) {
    assert.ok(
      getPortWorldPosition(snapped, port.id).y < snapped.position.y,
      `${port.id} should face into the room, not into the wall`
    );
  }
});

test('legacy closed-lid laptop heights are restored and the laptop stays on the desk', () => {
  const deskTop = 0.75;
  const [thin, closed, custom] = hydrateProjectObjects([0.058, 0.105, 0.2].map((z, index) => ({
    id: `laptop-${index}`,
    type: 'laptop',
    category: 'computer',
    modelId: 'laptop-15',
    position: { x: 0.1, y: -0.2, z: deskTop + z / 2 },
    scale: { x: 0.34, y: 0.24, z },
    rotation: { x: 0, y: 0, z: 0.5 },
  })));

  for (const laptop of [thin, closed]) {
    assert.equal(laptop.scale.z, 0.22);
    assert.deepEqual([laptop.scale.x, laptop.scale.y], [0.34, 0.24], 'footprint is kept');
    assert.ok(Math.abs(laptop.position.z - laptop.scale.z / 2 - deskTop) < 1e-9, 'bottom stays on the desk top');
    assert.deepEqual([laptop.position.x, laptop.position.y], [0.1, -0.2]);
    assert.deepEqual(laptop.rotation, { x: 0, y: 0, z: 0.5 });
  }
  assert.equal(custom.scale.z, 0.2, 'heights close to the open-lid default are left alone');
  assert.equal(custom.position.z, deskTop + 0.1);

  const [panel, resized] = hydrateProjectObjects([
    {
      id: 'old-24', type: 'monitor', modelId: 'monitor-24',
      position: { x: 0.3, y: 0.2, z: deskTop + 0.32 / 2 },
      scale: { x: 0.54, y: 0.05, z: 0.32 },
      rotation: { x: 0, y: 0, z: 180 },
    },
    {
      id: 'custom-24', type: 'monitor', modelId: 'monitor-24',
      position: { x: 0, y: 0, z: 1 },
      scale: { x: 0.5, y: 0.12, z: 0.36 },
    },
  ]);
  assert.deepEqual(panel.scale, { x: 0.54, y: 0.17, z: 0.39 });
  assert.ok(Math.abs(panel.position.z - panel.scale.z / 2 - deskTop) < 1e-9);
  assert.deepEqual([panel.position.x, panel.position.y], [0.3, 0.2]);
  assert.equal(panel.rotation.z, 180);
  assert.deepEqual(resized.scale, { x: 0.5, y: 0.12, z: 0.36 }, 'a resized monitor is left alone');
  const [panelAgain] = hydrateProjectObjects([panel]);
  assert.deepEqual(panelAgain.scale, panel.scale);
  assert.deepEqual(panelAgain.position, panel.position);

  const [again] = hydrateProjectObjects([thin]);
  assert.deepEqual(again.scale, thin.scale, 'migration is idempotent');
  assert.deepEqual(again.position, thin.position);
});

test('saved catalog ports move to the current GLB anchors while unknown ports keep theirs', () => {
  const stale = { x: 0, y: 0.5, z: -0.25 };
  const custom = { x: 0.3, y: 0.3, z: 0.3 };
  const [laptop, legacy] = hydrateProjectObjects([
    {
      id: 'laptop',
      type: 'laptop',
      modelId: 'laptop-15',
      ports: [
        { id: 'dc-in', name: 'DC 输入', type: 'dc_input', direction: 'input', anchor: stale },
        { id: 'usb-c', name: 'USB-C', type: 'usb_c', direction: 'bidirectional', anchor: { x: 0.5, y: 0, z: 0 } },
        { id: 'extra', name: 'Extra', type: 'usb_c', direction: 'bidirectional', anchor: custom },
      ],
    },
    {
      id: 'aio',
      type: 'all-in-one',
      category: 'computer',
      modelId: 'all-in-one',
      ports: [{ id: 'dc-in', name: 'DC 输入', type: 'dc_input', direction: 'input', anchor: stale }],
    },
  ]);

  const anchorOf = id => laptop.ports.find(port => port.id === id).anchor;
  assert.deepEqual(anchorOf('dc-in'), { x: -0.5, y: -0.1, z: -0.45 });
  assert.deepEqual(anchorOf('usb-c'), { x: 0.5, y: 0.2, z: -0.45 });
  assert.deepEqual(anchorOf('extra'), custom);
  assert.deepEqual(legacy.ports[0].anchor, stale, 'models outside the catalog keep stored anchors');
});

test('saved mini PCs and all-in-ones still hydrate without losing data', () => {
  const objects = [
    { id: 'mini', type: 'mini-pc', category: 'computer', modelId: 'mini-pc', assetUrl: null, position: { x: 0, y: 0, z: 0.8 }, scale: { x: 0.12, y: 0.12, z: 0.05 }, ports: [] },
    { id: 'aio', type: 'all-in-one', category: 'computer', modelId: 'all-in-one', position: { x: 0.5, y: 0, z: 1 }, scale: { x: 0.6, y: 0.2, z: 0.45 } },
  ];
  const hydrated = hydrateProjectObjects(objects);
  assert.equal(hydrated.length, 2);
  for (const [index, object] of hydrated.entries()) {
    assert.equal(object.id, objects[index].id);
    assert.equal(object.modelId, objects[index].modelId);
    assert.deepEqual(object.scale, objects[index].scale);
    assert.deepEqual(object.position, objects[index].position);
    assert.deepEqual(object.ports, []);
  }
});
