import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyAllAvailableImprovements,
  applyAllImprovements,
  applyImprovement,
  buildFreeImprovements,
  buildConnectionCompletion,
  buildPurchaseSuggestions,
  buildRecommendations,
} from '../src/domain/recommendations.js';
import { analyzeProjectLayout } from '../src/domain/layout-analysis.js';
import { analyzeProjectWiring, buildPowerGraph } from '../src/domain/analysis.js';
import { evaluateConnectionLength } from '../src/domain/connections.js';
import { findModelTemplate } from '../src/domain/catalog.js';
import { placeCatalogObject } from '../src/domain/placement.js';
import { isProjectEnvelope } from '../src/domain/project-validation.js';

const room = { length: 5, width: 4, height: 3 };
const object = (id, overrides = {}) => ({
  id,
  name: id,
  type: 'device',
  position: { x: 0, y: 0, z: 0.5 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
  ...overrides,
});

// The engine view: every free fix, including the model-completion lines
// (power, video, network) that the user-facing buildRecommendations hides.
const engineRecommendations = (project, options = {}) => {
  const freeImprovements = buildFreeImprovements(project.room, project.objects, project.connections, options);
  const purchases = buildPurchaseSuggestions(project.objects, project.connections, options);
  return { freeImprovements, purchases, total: freeImprovements.length + purchases.length };
};

const applyObjectPatch = (objects, patch) => objects.map(item =>
  item.id === patch.objectId
    ? { ...item, position: patch.position ?? item.position, rotation: patch.rotation ?? item.rotation }
    : item
);

test('suggests dropping a floating object and the fix clears the warning', () => {
  const floating = object('floating', { position: { x: 1.5, y: 0, z: 1.5 }, scale: { x: 0.2, y: 0.2, z: 0.2 } });
  const objects = [floating];

  const suggestions = buildFreeImprovements(room, objects, []);
  const drop = suggestions.find(item => item.code === 'drop_to_support');
  assert.ok(drop, 'expected a drop_to_support suggestion');
  assert.deepEqual(drop.objectIds, ['floating']);

  const fixed = applyObjectPatch(objects, drop.patch);
  assert.equal(
    analyzeProjectLayout(room, fixed).some(issue => issue.id === 'floating:floating'),
    false
  );
});

test('suggests moving an out-of-bounds object back inside and the fix clears the warning', () => {
  const stray = object('stray', { position: { x: 10, y: 0, z: 0.5 }, scale: { x: 1, y: 1, z: 1 } });
  const objects = [stray];

  const suggestions = buildFreeImprovements(room, objects, []);
  const move = suggestions.find(item => item.code === 'move_inside_room');
  assert.ok(move, 'expected a move_inside_room suggestion');

  const fixed = applyObjectPatch(objects, move.patch);
  assert.equal(
    analyzeProjectLayout(room, fixed).some(issue => issue.id === 'out-of-bounds:stray'),
    false
  );
});

test('suggests snapping a stray wall outlet and the fix clears the warning', () => {
  const outlet = object('outlet', {
    type: 'outlet',
    modelId: 'wall-outlet',
    scale: { x: 0.08, y: 0.02, z: 0.08 },
    position: { x: 0, y: 0, z: 1 },
    ports: [{ id: 'ac-out', name: 'AC', type: 'ac_output', direction: 'output', anchor: { x: 0, y: -0.5, z: 0 } }],
  });
  const objects = [outlet];

  const suggestions = buildFreeImprovements(room, objects, []);
  const snap = suggestions.find(item => item.code === 'snap_outlet_to_wall');
  assert.ok(snap, 'expected a snap_outlet_to_wall suggestion');

  const fixed = applyObjectPatch(objects, snap.patch);
  assert.equal(
    analyzeProjectLayout(room, fixed).some(issue => issue.code === 'outlet_off_wall'),
    false
  );
});

test('suggests extending a short cable and the fix satisfies both slack checks', () => {
  const objects = [
    object('source', { position: { x: 0, y: 0, z: 0.1 }, ports: [{ id: 'out', name: 'out', type: 'dc_output', direction: 'output' }] }),
    object('target', { position: { x: 3, y: 0, z: 0.1 }, ports: [{ id: 'in', name: 'in', type: 'dc_input', direction: 'input' }] }),
  ];
  const connections = [{
    id: 'c1', name: '电源线', cableType: 'power', length: 1,
    fromObjectId: 'source', fromPortId: 'out', toObjectId: 'target', toPortId: 'in',
  }];

  const suggestions = buildFreeImprovements(room, objects, connections);
  const extend = suggestions.find(item => item.code === 'extend_cable');
  assert.ok(extend, 'expected an extend_cable suggestion');
  assert.ok(extend.patch.length > connections[0].length);

  const fixedConnections = connections.map(c =>
    c.id === extend.patch.connectionId ? { ...c, length: extend.patch.length } : c
  );
  const status = evaluateConnectionLength(fixedConnections[0], objects);
  assert.equal(status.sufficient, true);
  assert.equal(status.hasRecommendedSlack, true);
  assert.equal(
    analyzeProjectWiring(objects, fixedConnections).some(issue =>
      issue.code === 'short_cable' || issue.code === 'low_cable_slack'),
    false
  );
});

test('is safe to call on empty or malformed mid-edit state', () => {
  // The UI calls this on live state, so it must never throw and must offer no
  // fix for issues that have none (invalid geometry / missing fields).
  assert.deepEqual(buildFreeImprovements(room, [], []), []);
  assert.deepEqual(
    buildFreeImprovements(room, [{
      id: 'x', name: 'x', type: 'd',
      position: { x: Number.NaN, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 },
    }], []),
    []
  );
  assert.deepEqual(buildFreeImprovements(room, [{ id: 'y', name: 'y' }], []), []);
});

test('does not throw when a port-bearing object is missing its position', () => {
  // analyzeProjectLayout flags such an object as invalid_geometry but keeps going,
  // so a position-less device with ports can still reach the nearest-source loops.
  // Those loops must tolerate it instead of crashing the recommendation panel.
  const source = object('source', {
    type: 'power_strip', modelId: 'power-strip',
    position: { x: 0, y: 0, z: 0.1 },
    ports: [{ id: 'out', name: 'out', type: 'ac_output', direction: 'output' }],
  });
  const noPositionPowered = { id: 'np', name: 'np', type: 'device', ports: [{ id: 'in', name: 'in', type: 'ac_input', direction: 'input' }] };
  const noPositionNet = { id: 'nn', name: 'nn', type: 'device', ports: [{ id: 'eth', name: 'eth', type: 'ethernet', direction: 'bidirectional' }] };
  const routerDev = object('rt', {
    type: 'router', modelId: 'router',
    position: { x: 1, y: 0, z: 0.1 },
    ports: [{ id: 'lan-1', name: 'LAN 1', type: 'ethernet', direction: 'bidirectional' }],
  });
  const monitor = object('mon', {
    type: 'monitor', modelId: 'monitor-24',
    position: { x: 1, y: 0, z: 1 },
    ports: [{ id: 'hdmi-in', name: 'HDMI 输入', type: 'hdmi', direction: 'input' }],
  });
  const noPositionDisplay = { id: 'nd', name: 'nd', type: 'device', ports: [{ id: 'hdmi-out', name: 'HDMI 输出', type: 'hdmi', direction: 'output' }] };
  const objects = [source, noPositionPowered, routerDev, noPositionNet, monitor, noPositionDisplay];

  assert.doesNotThrow(() => buildFreeImprovements(room, objects, []));
  assert.doesNotThrow(() => buildPurchaseSuggestions(objects, []));

  // Objects with no usable position must not produce auto-connection suggestions.
  const free = buildFreeImprovements(room, objects, []);
  assert.equal(free.some(s => s.objectIds?.includes('np') || s.objectIds?.includes('nn') || s.objectIds?.includes('nd')), false);
});

test('produces a working fix for a real catalog wall outlet placed off-wall', () => {
  // Integration across catalog -> placement -> recommendations -> analysis.
  const outletTemplate = findModelTemplate({ modelId: 'wall-outlet' });
  const placed = placeCatalogObject({ modelTemplate: outletTemplate, categoryId: 'power', room, id: 'outlet' });
  assert.equal(placed.valid, true);

  const suggestions = buildFreeImprovements(room, [placed.object], []);
  const snap = suggestions.find(item => item.code === 'snap_outlet_to_wall');
  assert.ok(snap, 'expected a snap_outlet_to_wall suggestion for a real wall outlet');

  const next = applyImprovement({ room, objects: [placed.object], connections: [] }, snap);
  assert.equal(
    analyzeProjectLayout(room, next.objects).some(issue => issue.code === 'outlet_off_wall'),
    false
  );
});

test('returns no suggestions for a clean project', () => {
  const objects = [object('grounded', { position: { x: 0, y: 0, z: 0.5 }, scale: { x: 1, y: 1, z: 1 } })];
  assert.deepEqual(buildFreeImprovements(room, objects, []), []);
});

test('recommends unchaining daisy-chained strips with a larger strip, deduped per pair', () => {
  const strip = (id, x) => object(id, {
    type: 'power_strip',
    modelId: 'power-strip',
    position: { x, y: 0, z: 0.1 },
    ports: [
      { id: 'in', name: 'in', type: 'ac_input', direction: 'input' },
      { id: 'out', name: 'out', type: 'ac_output', direction: 'output' },
    ],
  });
  const objects = [strip('a', -1), strip('b', 1)];
  // Mutual chain raises two power_strip_chain issues for the same pair.
  const connections = [
    { id: 'ab', name: 'ab', cableType: 'power', length: 3, fromObjectId: 'a', fromPortId: 'out', toObjectId: 'b', toPortId: 'in' },
    { id: 'ba', name: 'ba', cableType: 'power', length: 3, fromObjectId: 'b', fromPortId: 'out', toObjectId: 'a', toPortId: 'in' },
  ];

  const purchases = buildPurchaseSuggestions(objects, connections);
  const powerSourcePurchases = purchases.filter(item => item.code === 'fix_power_strip_chain');
  assert.equal(powerSourcePurchases.length, 1, 'one deduped purchase suggestion per strip pair');
  assert.equal(powerSourcePurchases[0].code, 'fix_power_strip_chain');
  assert.deepEqual(powerSourcePurchases[0].product, { category: 'power', modelId: 'power-strip' });
  assert.match(powerSourcePurchases[0].description, /墙壁插座/);
  assert.doesNotMatch(powerSourcePurchases[0].description, /UPS/);
  assert.deepEqual([...powerSourcePurchases[0].objectIds].sort(), ['a', 'b']);

  // The referenced product must resolve to a real catalog item, or the UI would
  // surface a purchase recommendation pointing at a non-existent device.
  const template = findModelTemplate(powerSourcePurchases[0].product);
  assert.ok(template, 'purchase product must resolve in the catalog');
  assert.equal(template.modelId, powerSourcePurchases[0].product.modelId);

  assert.deepEqual(buildPurchaseSuggestions([], []), []);
});

test('recommends a cable purchase for short cable or low slack', () => {
  const objects = [
    object('source', { position: { x: 0, y: 0, z: 0.1 }, ports: [{ id: 'out', name: 'out', type: 'dc_output', direction: 'output' }] }),
    object('target', { position: { x: 3, y: 0, z: 0.1 }, ports: [{ id: 'in', name: 'in', type: 'dc_input', direction: 'input' }] }),
  ];
  const connections = [{
    id: 'c1', name: '电源线', cableType: 'power', length: 1,
    fromObjectId: 'source', fromPortId: 'out', toObjectId: 'target', toPortId: 'in',
  }];

  const purchases = buildPurchaseSuggestions(objects, connections);
  const buyCable = purchases.find(item => item.code === 'buy_cable');
  assert.ok(buyCable, 'expected a buy_cable purchase suggestion');
  assert.equal(buyCable.product.category, 'cable');
  assert.equal(buyCable.product.modelId, 'power');
  assert.ok(buyCable.product.length > 1);
  assert.equal(buyCable.connectionIds[0], 'c1');
});

test('suggests powering an unpowered device and the fix creates a valid connection', () => {
  // 1. Create a powered power strip with a vacant ac_output
  const strip = object('strip1', {
    type: 'power_strip',
    modelId: 'power-strip',
    ports: [
      { id: 'ac-in', name: 'in', type: 'ac_input', direction: 'input' },
      { id: 'ac-out-1', name: 'out 1', type: 'ac_output', direction: 'output' },
    ]
  });
  const outlet = object('outlet', {
    type: 'outlet', modelId: 'wall-outlet',
    ports: [{ id: 'ac-out', name: 'AC OUT', type: 'ac_output', direction: 'output' }],
  });
  // 2. Create a desktop PC with an unpowered ac_input
  const pc = object('pc1', {
    modelId: 'desktop-pc',
    position: { x: 1, y: 1, z: 0.5 },
    ports: [{ id: 'ac-in', name: '电源输入', type: 'ac_input', direction: 'input' }]
  });
  const objects = [outlet, strip, pc];
  const connections = [{
    id: 'outlet-strip', name: 'Outlet strip power', cableType: 'power', length: 1,
    fromObjectId: 'outlet', fromPortId: 'ac-out', toObjectId: 'strip1', toPortId: 'ac-in',
  }];

  const suggestions = buildFreeImprovements(room, objects, connections);
  const autoPower = suggestions.find(item => item.code === 'auto_power_device');
  assert.ok(autoPower, 'expected an auto_power_device suggestion');
  assert.equal(autoPower.patch.newConnection.fromObjectId, 'strip1');
  assert.equal(autoPower.patch.newConnection.toObjectId, 'pc1');

  // Apply the patch
  const project = { room, objects, connections };
  const next = applyImprovement(project, autoPower);
  assert.equal(next.connections.length, 2);
  assert.equal(next.connections.at(-1).fromObjectId, 'strip1');
  assert.equal(next.connections.at(-1).toObjectId, 'pc1');

  // Verify the unpowered warning is resolved for pc1
  const issues = analyzeProjectWiring(next.objects, next.connections);
  assert.equal(issues.some(issue => issue.code === 'unpowered_input' && issue.objectIds.includes('pc1')), false);
});

test('auto_power_device infers cable type correctly for dc_input devices', () => {
  // Power adapter with dc_output → laptop with dc_input should infer cableType 'power'
  const adapter = object('adapter', {
    type: 'power-adapter',
    modelId: 'power-adapter',
    ports: [
      { id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' },
      { id: 'dc-out', name: 'DC OUT', type: 'dc_output', direction: 'output' },
    ],
  });
  const laptop = object('laptop', {
    type: 'laptop',
    modelId: 'laptop-15',
    position: { x: 1, y: 1, z: 0.5 },
    ports: [{ id: 'dc-in', name: 'DC IN', type: 'dc_input', direction: 'input' }],
  });
  const outlet = object('outlet', {
    type: 'outlet', modelId: 'wall-outlet',
    ports: [{ id: 'ac-out', name: 'AC OUT', type: 'ac_output', direction: 'output' }],
  });
  const objects = [outlet, adapter, laptop];
  const connections = [{
    id: 'outlet-adapter', name: 'Outlet adapter power', cableType: 'power', length: 1,
    fromObjectId: 'outlet', fromPortId: 'ac-out', toObjectId: 'adapter', toPortId: 'ac-in',
  }];

  const suggestions = buildFreeImprovements(room, objects, connections);
  const autoPower = suggestions.find(item => item.code === 'auto_power_device');
  assert.ok(autoPower, 'expected an auto_power_device suggestion for dc_input device');
  assert.equal(autoPower.patch.newConnection.cableType, 'power',
    'dc_output → dc_input should infer cableType power, not other');
});

test('does not suggest auto_power_device when no power source has a free compatible port', () => {
  // A single unpowered device with no nearby power source → no suggestion
  const device = object('lonely-device', {
    position: { x: 0, y: 0, z: 0.5 },
    ports: [{ id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' }],
  });
  const objects = [device];

  const suggestions = buildFreeImprovements(room, objects, []);
  const autoPower = suggestions.find(item => item.code === 'auto_power_device');
  assert.equal(autoPower, undefined, 'should not suggest auto_power_device without a power source');
});

test('does not use an unpowered power strip as a supply source', () => {
  const strip = object('strip', {
    type: 'power_strip', modelId: 'power-strip',
    ports: [
      { id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' },
      { id: 'ac-out', name: 'AC OUT', type: 'ac_output', direction: 'output' },
    ],
  });
  const pc = object('pc', {
    ports: [{ id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' }],
  });

  const free = buildFreeImprovements(room, [strip, pc], []);

  assert.equal(free.some(item => item.code === 'auto_power_device'), false,
    'a strip without an upstream power connection cannot safely power another device');
});

test('does not use a power strip fed only by an unpowered upstream strip', () => {
  const upstreamStrip = object('upstream', {
    type: 'power_strip', modelId: 'power-strip',
    ports: [
      { id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' },
      { id: 'ac-out', name: 'AC OUT', type: 'ac_output', direction: 'output' },
    ],
  });
  const downstreamStrip = object('downstream', {
    type: 'power_strip', modelId: 'power-strip',
    ports: [
      { id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' },
      { id: 'ac-out', name: 'AC OUT', type: 'ac_output', direction: 'output' },
    ],
  });
  const pc = object('pc', {
    ports: [{ id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' }],
  });
  const connections = [{
    id: 'strip-chain', name: 'Strip chain', cableType: 'power', length: 1,
    fromObjectId: 'upstream', fromPortId: 'ac-out', toObjectId: 'downstream', toPortId: 'ac-in',
  }];

  const free = buildFreeImprovements(room, [upstreamStrip, downstreamStrip, pc], connections);

  assert.equal(free.some(item => item.code === 'auto_power_device'), false,
    'a downstream strip is unavailable until its upstream supply reaches a root source');
});

test('does not recommend power fixes for a directionally invalid power input', () => {
  const source = object('source', {
    type: 'power_strip',
    modelId: 'power-strip',
    position: { x: 0, y: 0, z: 0.1 },
    ports: [{ id: 'ac-out', name: 'AC OUT', type: 'ac_output', direction: 'output' }],
  });
  const device = object('device', {
    position: { x: 1, y: 0, z: 0.1 },
    ports: [{ id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'output' }],
  });

  const free = buildFreeImprovements(room, [source, device], []);
  assert.equal(free.some(item => item.code === 'auto_power_device'), false);
});

test('does not use a source with an invalidly directed power input', () => {
  const invalidSource = object('invalid-source', {
    type: 'power_strip', modelId: 'power-strip',
    position: { x: 0, y: 0, z: 0.1 },
    ports: [
      { id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'output' },
      { id: 'ac-out', name: 'AC OUT', type: 'ac_output', direction: 'output' },
    ],
  });
  const pc = object('pc', {
    position: { x: 1, y: 0, z: 0.1 },
    ports: [{ id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' }],
  });

  const free = buildFreeImprovements(room, [invalidSource, pc], []);

  assert.equal(free.some(item => item.code === 'auto_power_device'), false,
    'a malformed power source must not be treated as an independent root');
});

test('ignores invalid connection occupancy when recommending power fixes', () => {
  const source = object('source', {
    type: 'power_strip',
    modelId: 'power-strip',
    position: { x: 0, y: 0, z: 0.1 },
    ports: [
      { id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' },
      { id: 'ac-out', name: 'AC OUT', type: 'ac_output', direction: 'output' },
    ],
  });
  const device = object('device', {
    position: { x: 1, y: 0, z: 0.1 },
    ports: [{ id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' }],
  });
  const outlet = object('outlet', {
    type: 'outlet', modelId: 'wall-outlet',
    ports: [{ id: 'ac-out', name: 'AC OUT', type: 'ac_output', direction: 'output' }],
  });
  const connections = [
    {
      id: 'outlet-source', name: 'Outlet source power', cableType: 'power', length: 1,
      fromObjectId: 'outlet', fromPortId: 'ac-out', toObjectId: 'source', toPortId: 'ac-in',
    },
    {
      id: 'invalid-self', name: 'Invalid self link', cableType: 'power', length: 1,
      fromObjectId: 'source', fromPortId: 'ac-out', toObjectId: 'source', toPortId: 'ac-in',
    },
  ];

  const autoPower = buildFreeImprovements(room, [outlet, source, device], connections)
    .find(item => item.code === 'auto_power_device');

  assert.ok(autoPower, 'invalid links must not consume the available source port');
  assert.equal(autoPower.patch.newConnection.fromObjectId, 'source');
  assert.equal(autoPower.patch.newConnection.toObjectId, 'device');
});

test('auto_power_device with real catalog power-adapter and laptop clears unpowered warning', () => {
  const outlet = placeCatalogObject({
    modelTemplate: findModelTemplate({ modelId: 'wall-outlet' }),
    categoryId: 'power',
    room,
    id: 'outlet',
  }).object;
  const adapter = placeCatalogObject({
    modelTemplate: findModelTemplate({ modelId: 'power-adapter' }),
    categoryId: 'power',
    room,
    id: 'adapter',
  }).object;
  const laptop = placeCatalogObject({
    modelTemplate: findModelTemplate({ modelId: 'laptop-15' }),
    categoryId: 'computer',
    room,
    id: 'laptop',
    position: { x: 1, y: 0, z: 0 },
  }).object;
  const objects = [outlet, adapter, laptop];
  const connections = [{
    id: 'outlet-adapter', name: 'Outlet adapter power', cableType: 'power', length: 1,
    fromObjectId: 'outlet', fromPortId: 'ac-out-1', toObjectId: 'adapter', toPortId: 'ac-in',
  }];

  const suggestions = buildFreeImprovements(room, objects, connections);
  const autoPower = suggestions.find(item => item.code === 'auto_power_device');
  assert.ok(autoPower, 'expected auto_power_device for unpowered laptop near adapter');
  assert.equal(autoPower.patch.newConnection.cableType, 'power',
    'dc_output from adapter → dc_input on laptop should be power cable');
  assert.equal(autoPower.patch.newConnection.fromObjectId, 'adapter');
  assert.equal(autoPower.patch.newConnection.toObjectId, 'laptop');

  // Apply and verify the warning is cleared
  const project = { room, objects, connections };
  const next = applyImprovement(project, autoPower);
  const issues = analyzeProjectWiring(next.objects, next.connections);
  assert.equal(issues.some(issue => issue.code === 'unpowered_input' && issue.objectIds.includes('laptop')), false,
    'unpowered warning should be cleared after auto-connecting laptop');
});

test('a DC device uses its existing but unplugged adapter instead of buying another', () => {
  const adapter = placeCatalogObject({
    modelTemplate: findModelTemplate({ modelId: 'power-adapter' }),
    categoryId: 'power',
    room,
    id: 'adapter',
  }).object;
  const laptop = placeCatalogObject({
    modelTemplate: findModelTemplate({ modelId: 'laptop-15' }),
    categoryId: 'computer',
    room,
    id: 'laptop',
    position: { x: 1, y: 0, z: 0 },
  }).object;
  const objects = [adapter, laptop];

  const autoPower = buildFreeImprovements(room, objects, [])
    .find(item => item.code === 'auto_power_device' && item.objectIds.includes('laptop'));
  assert.ok(autoPower, 'the laptop should be connected to the adapter that is already there');
  assert.equal(autoPower.patch.newConnection.fromObjectId, 'adapter');
  assert.match(autoPower.description, /插到插座/, 'the user is reminded to plug the adapter in');

  const next = applyImprovement({ room, objects, connections: [] }, autoPower);
  assert.equal(next.connections.length, 1);
  assert.ok(analyzeProjectWiring(next.objects, next.connections)
    .some(issue => issue.code === 'unpowered_input' && issue.objectIds.includes('adapter')),
  'the adapter itself still reports that it needs power');
});

test('applyImprovement applies a layout patch without mutating the input', () => {
  const floating = object('floating', { position: { x: 1.5, y: 0, z: 1.5 }, scale: { x: 0.2, y: 0.2, z: 0.2 } });
  const project = { room, objects: [floating], connections: [] };

  const [drop] = buildFreeImprovements(room, project.objects, project.connections);
  const next = applyImprovement(project, drop);

  assert.notEqual(next, project);
  assert.equal(project.objects[0].position.z, 1.5, 'original project must be untouched');
  assert.deepEqual(next.objects[0].position, drop.patch.position);
  assert.equal(
    analyzeProjectLayout(next.room, next.objects).some(issue => issue.id === 'floating:floating'),
    false
  );
});

test('applyImprovement rejects a stale layout patch when its object ID becomes ambiguous', () => {
  const stray = object('stray', { position: { x: 10, y: 0, z: 0.5 } });
  const project = { room, objects: [stray], connections: [] };
  const suggestion = buildFreeImprovements(room, project.objects, project.connections)
    .find(item => item.code === 'move_inside_room');
  assert.ok(suggestion, 'expected a valid move suggestion before the edit');

  const staleProject = {
    ...project,
    objects: [
      ...project.objects,
      object('stray', {
        name: 'Duplicate stray',
        position: { x: -10, y: 0, z: 0.5 },
      }),
    ],
  };
  const beforeIssues = analyzeProjectWiring(staleProject.objects, staleProject.connections);

  const next = applyImprovement(staleProject, suggestion);
  const nextIssues = analyzeProjectWiring(next.objects, next.connections);
  const summarizeDuplicates = issues => issues
    .filter(issue => issue.code === 'duplicate_object_id_definition')
    .map(({ code, severity, objectIds }) => ({ code, severity, objectIds }));

  assert.deepEqual({
    beforeDuplicateIssues: summarizeDuplicates(beforeIssues),
    unchanged: next === staleProject,
    positions: next.objects.map(item => item.position),
    nextDuplicateIssues: summarizeDuplicates(nextIssues),
  }, {
    beforeDuplicateIssues: [{
      code: 'duplicate_object_id_definition',
      severity: 'error',
      objectIds: ['stray'],
    }],
    unchanged: true,
    positions: [
      { x: 10, y: 0, z: 0.5 },
      { x: -10, y: 0, z: 0.5 },
    ],
    nextDuplicateIssues: [{
      code: 'duplicate_object_id_definition',
      severity: 'error',
      objectIds: ['stray'],
    }],
  });
});

test('applyImprovement applies a cable patch and leaves objects untouched', () => {
  const objects = [
    object('source', { position: { x: 0, y: 0, z: 0.1 }, ports: [{ id: 'out', name: 'out', type: 'dc_output', direction: 'output' }] }),
    object('target', { position: { x: 3, y: 0, z: 0.1 }, ports: [{ id: 'in', name: 'in', type: 'dc_input', direction: 'input' }] }),
  ];
  const project = {
    room,
    objects,
    connections: [{
      id: 'c1', name: '电源线', cableType: 'power', length: 1,
      fromObjectId: 'source', fromPortId: 'out', toObjectId: 'target', toPortId: 'in',
    }],
  };

  const extend = buildFreeImprovements(room, project.objects, project.connections)
    .find(item => item.code === 'extend_cable');
  const next = applyImprovement(project, extend);

  assert.equal(next.connections[0].length, extend.patch.length);
  assert.equal(next.objects, project.objects, 'objects array is reused when only a cable changes');
  assert.equal(project.connections[0].length, 1, 'original project must be untouched');
});

test('applyImprovement rejects a stale cable-length patch after endpoints move farther apart', () => {
  const largeRoom = { length: 12, width: 4, height: 3 };
  const source = object('source', {
    position: { x: -1, y: 0, z: 0.5 },
    ports: [{ id: 'out', name: 'OUT', type: 'other', direction: 'output' }],
  });
  const target = object('target', {
    position: { x: 1, y: 0, z: 0.5 },
    ports: [{ id: 'in', name: 'IN', type: 'other', direction: 'input' }],
  });
  const connection = {
    id: 'cable', name: 'Cable', cableType: 'other', length: 0.5,
    fromObjectId: 'source', fromPortId: 'out', toObjectId: 'target', toPortId: 'in',
  };
  const project = {
    room: largeRoom,
    objects: [source, target],
    connections: [connection],
  };
  const suggestion = buildFreeImprovements(largeRoom, project.objects, project.connections)
    .find(item => item.code === 'extend_cable');
  assert.ok(suggestion, 'expected a valid cable extension suggestion before the move');

  const staleProject = {
    ...project,
    objects: project.objects.map(item => item.id === target.id
      ? { ...item, position: { x: 4, y: 0, z: 0.5 } }
      : item),
  };
  const proposedConnection = { ...connection, length: suggestion.patch.length };
  const beforeIssues = analyzeProjectWiring(staleProject.objects, staleProject.connections);

  const next = applyImprovement(staleProject, suggestion);
  const nextSuggestion = buildFreeImprovements(largeRoom, next.objects, next.connections)
    .find(item => item.code === 'extend_cable');

  assert.deepEqual({
    beforeIssueCodes: beforeIssues.map(issue => issue.code),
    lengthWasValid: evaluateConnectionLength(
      proposedConnection,
      project.objects
    )?.hasRecommendedSlack,
    lengthIsStillValid: evaluateConnectionLength(
      proposedConnection,
      staleProject.objects
    )?.hasRecommendedSlack,
    unchanged: next === staleProject,
    connectionsReused: next.connections === staleProject.connections,
    length: next.connections[0].length,
    replacementPatchIsLonger: nextSuggestion.patch.length > suggestion.patch.length,
  }, {
    beforeIssueCodes: ['short_cable'],
    lengthWasValid: true,
    lengthIsStillValid: false,
    unchanged: true,
    connectionsReused: true,
    length: 0.5,
    replacementPatchIsLonger: true,
  });
});

test('applyImprovement rejects a stale cable patch when its connection ID becomes ambiguous', () => {
  const objects = [
    object('source', {
      position: { x: 0, y: 0, z: 0.1 },
      ports: [{ id: 'out', name: 'out', type: 'dc_output', direction: 'output' }],
    }),
    object('target', {
      position: { x: 3, y: 0, z: 0.1 },
      ports: [{ id: 'in', name: 'in', type: 'dc_input', direction: 'input' }],
    }),
  ];
  const project = {
    room,
    objects,
    connections: [{
      id: 'c1', name: 'Power cable', cableType: 'power', length: 1,
      fromObjectId: 'source', fromPortId: 'out', toObjectId: 'target', toPortId: 'in',
    }],
  };
  const suggestion = buildFreeImprovements(room, project.objects, project.connections)
    .find(item => item.code === 'extend_cable');
  assert.ok(suggestion, 'expected a valid cable extension suggestion before the edit');

  const staleProject = {
    ...project,
    connections: [
      ...project.connections,
      { ...project.connections[0], name: 'Duplicate power cable', length: 5 },
    ],
  };
  const beforeIssues = analyzeProjectWiring(staleProject.objects, staleProject.connections);

  const next = applyImprovement(staleProject, suggestion);
  const nextIssues = analyzeProjectWiring(next.objects, next.connections);
  const summarizeDuplicates = issues => issues
    .filter(issue => issue.code === 'duplicate_connection_id')
    .map(({ code, severity, connectionIds }) => ({ code, severity, connectionIds }));

  assert.deepEqual({
    beforeDuplicateIssues: summarizeDuplicates(beforeIssues),
    unchanged: next === staleProject,
    lengths: next.connections.map(connection => connection.length),
    nextDuplicateIssues: summarizeDuplicates(nextIssues),
  }, {
    beforeDuplicateIssues: [{
      code: 'duplicate_connection_id',
      severity: 'error',
      connectionIds: ['c1'],
    }],
    unchanged: true,
    lengths: [1, 5],
    nextDuplicateIssues: [{
      code: 'duplicate_connection_id',
      severity: 'error',
      connectionIds: ['c1'],
    }],
  });
});

test('applyImprovement returns the project unchanged for an empty patch', () => {
  const project = { room, objects: [], connections: [] };
  assert.equal(applyImprovement(project, {}), project);
  assert.equal(applyImprovement(project, undefined), project);
});

test('applyImprovement ignores patches for deleted objects and connections', () => {
  const project = {
    room,
    objects: [object('desk')],
    connections: [{ id: 'existing', length: 1 }],
  };

  assert.equal(applyImprovement(project, {
    patch: { objectId: 'deleted-object', position: { x: 1, y: 0, z: 1 } },
  }), project, 'a stale layout patch must be a no-op');
  assert.equal(applyImprovement(project, {
    patch: { connectionId: 'deleted-connection', length: 2 },
  }), project, 'a stale cable patch must be a no-op');
});

test('applyImprovement does not allocate state for already-applied patches', () => {
  const project = {
    room,
    objects: [object('desk', { position: { x: 1, y: 0, z: 0.5 }, rotation: { x: 0, y: 0, z: 0 } })],
    connections: [{ id: 'existing', length: 2 }],
  };

  assert.equal(applyImprovement(project, {
    patch: { objectId: 'desk', position: { x: 1, y: 0, z: 0.5 }, rotation: { x: 0, y: 0, z: 0 } },
  }), project, 'a repeated layout patch must be a no-op');
  assert.equal(applyImprovement(project, {
    patch: { connectionId: 'existing', length: 2 },
  }), project, 'a repeated cable patch must be a no-op');
});

test('applyImprovement does not append an automatic connection twice', () => {
  const project = {
    room,
    objects: [
      object('outlet', { ports: [{ id: 'ac-out', name: 'AC OUT', type: 'ac_output', direction: 'output' }] }),
      object('pc', { ports: [{ id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' }] }),
    ],
    connections: [],
  };
  const suggestion = {
    patch: {
      newConnection: {
        id: 'c-auto-power-pc-ac-in', name: 'PC power', cableType: 'power', length: 1.5,
        fromObjectId: 'outlet', fromPortId: 'ac-out', toObjectId: 'pc', toPortId: 'ac-in',
      },
    },
  };

  const once = applyImprovement(project, suggestion);
  const twice = applyImprovement(once, suggestion);

  assert.equal(once.connections.length, 1);
  assert.equal(twice, once, 'reapplying a stale automatic connection must be a no-op');
});

test('applyImprovement does not use a port claimed by a newer connection', () => {
  const project = {
    room,
    objects: [
      object('outlet', { ports: [{ id: 'ac-out', name: 'AC OUT', type: 'ac_output', direction: 'output' }] }),
      object('monitor', { ports: [{ id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' }] }),
      object('pc', { ports: [{ id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' }] }),
    ],
    connections: [{
      id: 'newer-connection', name: 'Newer connection', cableType: 'power', length: 1,
      fromObjectId: 'outlet', fromPortId: 'ac-out', toObjectId: 'monitor', toPortId: 'ac-in',
    }],
  };
  const staleSuggestion = {
    patch: {
      newConnection: {
        id: 'c-auto-power-pc-ac-in', name: 'PC power', cableType: 'power', length: 1.5,
        fromObjectId: 'outlet', fromPortId: 'ac-out', toObjectId: 'pc', toPortId: 'ac-in',
      },
    },
  };

  assert.equal(applyImprovement(project, staleSuggestion), project,
    'a stale automatic connection must not create duplicate physical-port occupancy');
});

test('applyImprovement does not create a connection to a deleted endpoint', () => {
  const project = {
    room,
    objects: [object('outlet', {
      ports: [{ id: 'ac-out', name: 'AC OUT', type: 'ac_output', direction: 'output' }],
    })],
    connections: [],
  };
  const staleSuggestion = {
    patch: {
      newConnection: {
        id: 'c-auto-power-pc-ac-in', name: 'PC power', cableType: 'power', length: 1.5,
        fromObjectId: 'outlet', fromPortId: 'ac-out', toObjectId: 'pc', toPortId: 'ac-in',
      },
    },
  };

  assert.equal(applyImprovement(project, staleSuggestion), project,
    'a stale connection must not reintroduce a reference to a deleted device');
});

test('applyImprovement does not create a connection through a deleted port', () => {
  const project = {
    room,
    objects: [
      object('outlet', { ports: [] }),
      object('pc', { ports: [{ id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' }] }),
    ],
    connections: [],
  };
  const staleSuggestion = {
    patch: {
      newConnection: {
        id: 'c-auto-power-pc-ac-in', name: 'PC power', cableType: 'power', length: 1.5,
        fromObjectId: 'outlet', fromPortId: 'ac-out', toObjectId: 'pc', toPortId: 'ac-in',
      },
    },
  };

  assert.equal(applyImprovement(project, staleSuggestion), project,
    'a stale connection must not reference a port that no longer exists');
});

test('applyImprovement rejects a stale automatic connection after its endpoints move out of cable range', () => {
  const largeRoom = { length: 20, width: 4, height: 3 };
  const router = object('router', {
    type: 'router',
    modelId: 'router',
    position: { x: 0, y: 0, z: 0.5 },
    ports: [{ id: 'lan-1', name: 'LAN 1', type: 'ethernet', direction: 'output' }],
  });
  const endpoint = object('endpoint', {
    position: { x: 1, y: 0, z: 0.5 },
    ports: [{ id: 'eth-in', name: 'Ethernet', type: 'ethernet', direction: 'input' }],
  });
  const project = { room: largeRoom, objects: [router, endpoint], connections: [] };
  const suggestion = buildFreeImprovements(largeRoom, project.objects, project.connections)
    .find(item => item.code === 'auto_network_device');
  assert.ok(suggestion, 'expected a valid automatic network suggestion before the move');

  const staleProject = {
    ...project,
    objects: project.objects.map(item => item.id === endpoint.id
      ? { ...item, position: { x: 8, y: 0, z: 0.5 } }
      : item),
  };
  const beforeIssues = analyzeProjectWiring(staleProject.objects, staleProject.connections);

  const next = applyImprovement(staleProject, suggestion);
  const nextIssues = analyzeProjectWiring(next.objects, next.connections);

  assert.deepEqual({
    beforeIssueCodes: beforeIssues.map(issue => issue.code),
    lengthWasValid: evaluateConnectionLength(
      suggestion.patch.newConnection,
      project.objects
    )?.hasRecommendedSlack,
    lengthIsStillValid: evaluateConnectionLength(
      suggestion.patch.newConnection,
      staleProject.objects
    )?.hasRecommendedSlack,
    unchanged: next === staleProject,
    connections: next.connections,
    introducedLengthIssues: nextIssues
      .filter(issue => issue.code === 'short_cable' || issue.code === 'low_cable_slack')
      .map(issue => issue.code),
  }, {
    beforeIssueCodes: [],
    lengthWasValid: true,
    lengthIsStillValid: false,
    unchanged: true,
    connections: [],
    introducedLengthIssues: [],
  });
});

test('applyImprovement rejects a stale connection when an endpoint port becomes ambiguous', () => {
  const router = object('router', {
    type: 'router',
    modelId: 'router',
    position: { x: -1, y: 0, z: 0.5 },
    ports: [{ id: 'lan-1', name: 'LAN 1', type: 'ethernet', direction: 'output' }],
  });
  const endpoint = object('endpoint', {
    position: { x: 1, y: 0, z: 0.5 },
    ports: [{ id: 'eth-in', name: 'Ethernet', type: 'ethernet', direction: 'input' }],
  });
  const project = { room, objects: [router, endpoint], connections: [] };
  const suggestion = buildFreeImprovements(room, project.objects, project.connections)
    .find(item => item.code === 'auto_network_device');
  assert.ok(suggestion, 'expected a valid automatic network suggestion before the edit');

  const staleProject = {
    ...project,
    objects: project.objects.map(item => item.id === endpoint.id
      ? {
          ...item,
          ports: [
            ...item.ports,
            { ...item.ports[0], name: 'Duplicate Ethernet' },
          ],
        }
      : item),
  };
  const beforeIssues = analyzeProjectWiring(staleProject.objects, staleProject.connections);

  const next = applyImprovement(staleProject, suggestion);
  const nextIssues = analyzeProjectWiring(next.objects, next.connections);

  assert.deepEqual({
    duplicatePortIssues: beforeIssues
      .filter(issue => issue.code === 'duplicate_port_id_definition')
      .map(({ code, severity, objectIds }) => ({ code, severity, objectIds })),
    unchanged: next === staleProject,
    connections: next.connections,
    introducedAmbiguousConnections: nextIssues
      .filter(issue => issue.code === 'ambiguous_connection_port')
      .map(issue => issue.code),
  }, {
    duplicatePortIssues: [{
      code: 'duplicate_port_id_definition',
      severity: 'error',
      objectIds: ['endpoint'],
    }],
    unchanged: true,
    connections: [],
    introducedAmbiguousConnections: [],
  });
});

test('applyImprovement rejects a stale connection when an endpoint object ID becomes ambiguous', () => {
  const router = object('router', {
    type: 'router',
    modelId: 'router',
    position: { x: -1, y: 0, z: 0.5 },
    ports: [{ id: 'lan-1', name: 'LAN 1', type: 'ethernet', direction: 'output' }],
  });
  const endpoint = object('endpoint', {
    position: { x: 1, y: 0, z: 0.5 },
    ports: [{ id: 'eth-in', name: 'Ethernet', type: 'ethernet', direction: 'input' }],
  });
  const project = { room, objects: [router, endpoint], connections: [] };
  const suggestion = buildFreeImprovements(room, project.objects, project.connections)
    .find(item => item.code === 'auto_network_device');
  assert.ok(suggestion, 'expected a valid automatic network suggestion before the edit');

  const staleProject = {
    ...project,
    objects: [
      ...project.objects,
      object('endpoint', {
        name: 'Duplicate endpoint',
        position: { x: 2, y: 0, z: 0.5 },
        ports: [{ ...endpoint.ports[0] }],
      }),
    ],
  };
  const beforeIssues = analyzeProjectWiring(staleProject.objects, staleProject.connections);

  const next = applyImprovement(staleProject, suggestion);
  const nextIssues = analyzeProjectWiring(next.objects, next.connections);

  assert.deepEqual({
    duplicateObjectIssues: beforeIssues
      .filter(issue => issue.code === 'duplicate_object_id_definition')
      .map(({ code, severity, objectIds }) => ({ code, severity, objectIds })),
    unchanged: next === staleProject,
    connections: next.connections,
    introducedAmbiguousConnections: nextIssues
      .filter(issue => issue.code === 'ambiguous_connection_object')
      .map(issue => issue.code),
  }, {
    duplicateObjectIssues: [{
      code: 'duplicate_object_id_definition',
      severity: 'error',
      objectIds: ['endpoint'],
    }],
    unchanged: true,
    connections: [],
    introducedAmbiguousConnections: [],
  });
});

test('buildRecommendations aggregates free and purchase suggestions with a total', () => {
  const strip = (id, x) => object(id, {
    type: 'power_strip', modelId: 'power-strip',
    position: { x, y: 0, z: 0.1 },
    ports: [
      { id: 'in', name: 'in', type: 'ac_input', direction: 'input' },
      { id: 'out', name: 'out', type: 'ac_output', direction: 'output' },
    ],
  });
  const project = {
    room,
    objects: [
      object('floating', { position: { x: 1.5, y: 0, z: 1.5 }, scale: { x: 0.2, y: 0.2, z: 0.2 } }),
      strip('a', -1),
      strip('b', 1),
    ],
    connections: [
      { id: 'ab', name: 'ab', cableType: 'power', length: 3, fromObjectId: 'a', fromPortId: 'out', toObjectId: 'b', toPortId: 'in' },
    ],
  };

  const result = buildRecommendations(project);
  assert.ok(result.freeImprovements.some(item => item.code === 'drop_to_support'));
  assert.ok(result.purchases.some(item => item.code === 'fix_power_strip_chain'));
  assert.equal(result.total, result.freeImprovements.length + result.purchases.length);

  assert.deepEqual(buildRecommendations({}), { freeImprovements: [], purchases: [], total: 0 });
  assert.deepEqual(buildRecommendations({ objects: null, connections: null }), {
    freeImprovements: [], purchases: [], total: 0,
  });
  assert.deepEqual(buildRecommendations(null), { freeImprovements: [], purchases: [], total: 0 });
});

test('buildRecommendations facade tolerates malformed-but-valid project data', () => {
  // App.jsx calls buildRecommendations on every render with live state, which can
  // briefly include a port-bearing object without a position or with a string
  // wattage (neither is rejected by isProjectObject). The facade must not throw.
  const project = {
    room,
    objects: [
      object('strip', {
        type: 'power_strip', modelId: 'power-strip', maxLoad: '2500',
        position: { x: 0, y: 0, z: 0.1 },
        ports: [{ id: 'out', name: 'out', type: 'ac_output', direction: 'output' }],
      }),
      object('heater', {
        wattage: '900',
        position: { x: 1, y: 0, z: 0.1 },
        ports: [{ id: 'in', name: 'in', type: 'ac_input', direction: 'input' }],
      }),
      { id: 'noPos', name: 'noPos', type: 'device', ports: [{ id: 'in', name: 'in', type: 'ac_input', direction: 'input' }] },
    ],
    connections: [
      { id: 'c', name: 'c', cableType: 'power', length: 2, fromObjectId: 'strip', fromPortId: 'out', toObjectId: 'heater', toPortId: 'in' },
    ],
  };

  let result;
  assert.doesNotThrow(() => { result = buildRecommendations(project); });
  assert.equal(typeof result.total, 'number');
});

test('buildRecommendations ignores malformed live port collections and entries', () => {
  assert.deepEqual(buildRecommendations({
    objects: [
      object('bad-collection', { ports: {} }),
      object('bad-entry', { ports: [null] }),
    ],
    connections: [],
  }), {
    freeImprovements: [],
    purchases: [],
    total: 0,
  });
});

test('live recommendations tolerate non-string port names already diagnosed by wiring analysis', () => {
  const router = object('router', {
    type: 'router',
    modelId: 'router',
    position: { x: -1.5, y: 0, z: 0.5 },
    ports: [{ id: 'lan-1', name: 'LAN 1', type: 'ethernet', direction: 'bidirectional' }],
  });
  const pc = object('pc', {
    type: 'desktop-pc',
    modelId: 'desktop-pc',
    position: { x: 1.5, y: 0, z: 0.5 },
    ports: [{ id: 'eth-1', name: 42, type: 'ethernet', direction: 'bidirectional' }],
  });
  const objects = [router, pc];
  const wiringIssues = analyzeProjectWiring(objects, []);

  const recommendations = engineRecommendations(
    { room, objects, connections: [] },
    { wiringIssues }
  );

  assert.deepEqual({
    portNameIssues: wiringIssues
      .filter(issue => issue.code === 'invalid_port_name_definition')
      .map(({ code, severity, objectIds }) => ({ code, severity, objectIds })),
    freeCodes: recommendations.freeImprovements.map(item => item.code),
    purchaseCodes: recommendations.purchases.map(item => item.code),
    total: recommendations.total,
  }, {
    portNameIssues: [{
      code: 'invalid_port_name_definition',
      severity: 'error',
      objectIds: ['pc'],
    }],
    freeCodes: ['auto_network_device'],
    purchaseCodes: [],
    total: 1,
  });
});

test('live recommendations ignore invalid port IDs without hiding valid network fixes', () => {
  const router = object('router', {
    type: 'router',
    modelId: 'router',
    position: { x: -1.5, y: 0, z: 0.5 },
    ports: [{ id: 'lan-1', name: 'LAN 1', type: 'ethernet', direction: 'output' }],
  });
  const invalidEndpoint = object('invalid-endpoint', {
    position: { x: 0, y: 0, z: 0.5 },
    ports: [{ id: 42, name: 'Ethernet', type: 'ethernet', direction: 'input' }],
  });
  const validEndpoint = object('valid-endpoint', {
    position: { x: 1.5, y: 0, z: 0.5 },
    ports: [{ id: 'eth-in', name: 'Ethernet', type: 'ethernet', direction: 'input' }],
  });
  const project = {
    room,
    objects: [router, invalidEndpoint, validEndpoint],
    connections: [],
  };
  const wiringIssues = analyzeProjectWiring(project.objects, project.connections);

  const recommendations = engineRecommendations(project, { wiringIssues });

  assert.deepEqual({
    invalidPortIssues: wiringIssues
      .filter(issue => issue.code === 'invalid_port_id_definition')
      .map(({ code, severity, objectIds }) => ({ code, severity, objectIds })),
    free: recommendations.freeImprovements.map(item => ({
      code: item.code,
      toObjectId: item.patch.newConnection?.toObjectId,
      toPortId: item.patch.newConnection?.toPortId,
    })),
    purchases: recommendations.purchases.map(item => item.code),
    total: recommendations.total,
  }, {
    invalidPortIssues: [{
      code: 'invalid_port_id_definition',
      severity: 'error',
      objectIds: ['invalid-endpoint'],
    }],
    free: [{
      code: 'auto_network_device',
      toObjectId: 'valid-endpoint',
      toPortId: 'eth-in',
    }],
    purchases: [],
    total: 1,
  });
});

test('live recommendations ignore duplicate port IDs without hiding valid network fixes', () => {
  const router = object('router', {
    type: 'router',
    modelId: 'router',
    position: { x: -1.5, y: 0, z: 0.5 },
    ports: [{ id: 'lan-1', name: 'LAN 1', type: 'ethernet', direction: 'output' }],
  });
  const duplicatePortEndpoint = object('duplicate-port-endpoint', {
    name: 'Duplicate port endpoint',
    position: { x: 0, y: 0, z: 0.5 },
    ports: [
      { id: 'eth-dup', name: 'Ethernet A', type: 'ethernet', direction: 'input' },
      { id: 'eth-dup', name: 'Ethernet B', type: 'ethernet', direction: 'input' },
    ],
  });
  const validEndpoint = object('valid-endpoint', {
    name: 'Valid endpoint',
    position: { x: 1.5, y: 0, z: 0.5 },
    ports: [{ id: 'eth-in', name: 'Ethernet', type: 'ethernet', direction: 'input' }],
  });
  const project = {
    room,
    objects: [router, duplicatePortEndpoint, validEndpoint],
    connections: [],
  };
  const wiringIssues = analyzeProjectWiring(project.objects, project.connections);

  const recommendations = engineRecommendations(project, { wiringIssues });
  const next = applyAllImprovements(project, recommendations.freeImprovements);
  const nextIssues = analyzeProjectWiring(next.objects, next.connections);

  assert.deepEqual({
    duplicatePortIssues: wiringIssues
      .filter(issue => issue.code === 'duplicate_port_id_definition')
      .map(({ code, severity, objectIds }) => ({ code, severity, objectIds })),
    free: recommendations.freeImprovements.map(item => ({
      code: item.code,
      toObjectId: item.patch.newConnection?.toObjectId,
      toPortId: item.patch.newConnection?.toPortId,
    })),
    purchases: recommendations.purchases.map(item => item.code),
    total: recommendations.total,
    connections: next.connections.map(({
      fromObjectId, fromPortId, toObjectId, toPortId,
    }) => ({ fromObjectId, fromPortId, toObjectId, toPortId })),
    introducedAmbiguousConnections: nextIssues
      .filter(issue => issue.code === 'ambiguous_connection_port')
      .map(issue => issue.code),
  }, {
    duplicatePortIssues: [{
      code: 'duplicate_port_id_definition',
      severity: 'error',
      objectIds: ['duplicate-port-endpoint'],
    }],
    free: [{
      code: 'auto_network_device',
      toObjectId: 'valid-endpoint',
      toPortId: 'eth-in',
    }],
    purchases: [],
    total: 1,
    connections: [{
      fromObjectId: 'router',
      fromPortId: 'lan-1',
      toObjectId: 'valid-endpoint',
      toPortId: 'eth-in',
    }],
    introducedAmbiguousConnections: [],
  });
});

test('live recommendations ignore invalid object IDs without hiding valid network fixes', () => {
  const router = object('router', {
    type: 'router',
    modelId: 'router',
    position: { x: -1.5, y: 0, z: 0.5 },
    ports: [{ id: 'lan-1', name: 'LAN 1', type: 'ethernet', direction: 'output' }],
  });
  const invalidEndpoint = object(42, {
    name: 'Invalid endpoint',
    position: { x: 0, y: 0, z: 0.5 },
    ports: [{ id: 'eth-in', name: 'Ethernet', type: 'ethernet', direction: 'input' }],
  });
  const validEndpoint = object('valid-endpoint', {
    name: 'Valid endpoint',
    position: { x: 1.5, y: 0, z: 0.5 },
    ports: [{ id: 'eth-in', name: 'Ethernet', type: 'ethernet', direction: 'input' }],
  });
  const project = {
    room,
    objects: [router, invalidEndpoint, validEndpoint],
    connections: [],
  };
  const wiringIssues = analyzeProjectWiring(project.objects, project.connections);

  const recommendations = engineRecommendations(project, { wiringIssues });
  const next = applyAllImprovements(project, recommendations.freeImprovements);
  const nextIssues = analyzeProjectWiring(next.objects, next.connections);

  assert.deepEqual({
    invalidObjectIssues: wiringIssues
      .filter(issue => issue.code === 'invalid_object_id_definition')
      .map(({ code, severity, objectIds }) => ({ code, severity, objectIds })),
    free: recommendations.freeImprovements.map(item => ({
      code: item.code,
      toObjectId: item.patch.newConnection?.toObjectId,
      toPortId: item.patch.newConnection?.toPortId,
    })),
    purchases: recommendations.purchases.map(item => item.code),
    total: recommendations.total,
    introducedInvalidConnections: nextIssues
      .filter(issue => issue.code === 'invalid_connection_object_id')
      .map(issue => issue.code),
  }, {
    invalidObjectIssues: [{
      code: 'invalid_object_id_definition',
      severity: 'error',
      objectIds: [42],
    }],
    free: [{
      code: 'auto_network_device',
      toObjectId: 'valid-endpoint',
      toPortId: 'eth-in',
    }],
    purchases: [],
    total: 1,
    introducedInvalidConnections: [],
  });
});

test('live recommendations ignore duplicate object IDs without hiding valid network fixes', () => {
  const router = object('router', {
    type: 'router',
    modelId: 'router',
    position: { x: -1.5, y: 0, z: 0.5 },
    ports: [{ id: 'lan-1', name: 'LAN 1', type: 'ethernet', direction: 'output' }],
  });
  const firstDuplicate = object('duplicate', {
    name: 'Duplicate A',
    position: { x: -0.5, y: 0, z: 0.5 },
    ports: [{ id: 'eth-a', name: 'Ethernet A', type: 'ethernet', direction: 'input' }],
  });
  const secondDuplicate = object('duplicate', {
    name: 'Duplicate B',
    position: { x: 0.5, y: 0, z: 0.5 },
    ports: [{ id: 'eth-b', name: 'Ethernet B', type: 'ethernet', direction: 'input' }],
  });
  const validEndpoint = object('valid-endpoint', {
    name: 'Valid endpoint',
    position: { x: 1.5, y: 0, z: 0.5 },
    ports: [{ id: 'eth-in', name: 'Ethernet', type: 'ethernet', direction: 'input' }],
  });
  const project = {
    room,
    objects: [router, firstDuplicate, secondDuplicate, validEndpoint],
    connections: [],
  };
  const wiringIssues = analyzeProjectWiring(project.objects, project.connections);

  const recommendations = engineRecommendations(project, { wiringIssues });
  const next = applyAllImprovements(project, recommendations.freeImprovements);
  const nextIssues = analyzeProjectWiring(next.objects, next.connections);

  assert.deepEqual({
    duplicateObjectIssues: wiringIssues
      .filter(issue => issue.code === 'duplicate_object_id_definition')
      .map(({ code, severity, objectIds }) => ({ code, severity, objectIds })),
    free: recommendations.freeImprovements.map(item => ({
      code: item.code,
      toObjectId: item.patch.newConnection?.toObjectId,
      toPortId: item.patch.newConnection?.toPortId,
    })),
    purchases: recommendations.purchases.map(item => item.code),
    total: recommendations.total,
    connections: next.connections.map(({
      fromObjectId, fromPortId, toObjectId, toPortId,
    }) => ({ fromObjectId, fromPortId, toObjectId, toPortId })),
    introducedAmbiguousConnections: nextIssues
      .filter(issue => issue.code === 'ambiguous_connection_object')
      .map(issue => issue.code),
  }, {
    duplicateObjectIssues: [{
      code: 'duplicate_object_id_definition',
      severity: 'error',
      objectIds: ['duplicate'],
    }],
    free: [{
      code: 'auto_network_device',
      toObjectId: 'valid-endpoint',
      toPortId: 'eth-in',
    }],
    purchases: [],
    total: 1,
    connections: [{
      fromObjectId: 'router',
      fromPortId: 'lan-1',
      toObjectId: 'valid-endpoint',
      toPortId: 'eth-in',
    }],
    introducedAmbiguousConnections: [],
  });
});

test('live recommendations ignore duplicate connection IDs without hiding valid cable fixes', () => {
  const source = object('source', {
    position: { x: -1, y: 0, z: 0.5 },
    ports: [
      { id: 'out-1', name: 'OUT 1', type: 'other', direction: 'output' },
      { id: 'out-2', name: 'OUT 2', type: 'other', direction: 'output' },
      { id: 'out-3', name: 'OUT 3', type: 'other', direction: 'output' },
    ],
  });
  const target = object('target', {
    position: { x: 1, y: 0, z: 0.5 },
    ports: [
      { id: 'in-1', name: 'IN 1', type: 'other', direction: 'input' },
      { id: 'in-2', name: 'IN 2', type: 'other', direction: 'input' },
      { id: 'in-3', name: 'IN 3', type: 'other', direction: 'input' },
    ],
  });
  const project = {
    room,
    objects: [source, target],
    connections: [
      {
        id: 'duplicate-link', name: 'Duplicate short cable', cableType: 'other', length: 0.5,
        fromObjectId: 'source', fromPortId: 'out-1', toObjectId: 'target', toPortId: 'in-1',
      },
      {
        id: 'duplicate-link', name: 'Duplicate long cable', cableType: 'other', length: 9,
        fromObjectId: 'source', fromPortId: 'out-2', toObjectId: 'target', toPortId: 'in-2',
      },
      {
        id: 'valid-link', name: 'Valid short cable', cableType: 'other', length: 0.5,
        fromObjectId: 'source', fromPortId: 'out-3', toObjectId: 'target', toPortId: 'in-3',
      },
    ],
  };
  const wiringIssues = analyzeProjectWiring(project.objects, project.connections);

  const recommendations = buildRecommendations(project, { wiringIssues });

  assert.deepEqual({
    duplicateIssues: wiringIssues
      .filter(issue => issue.code === 'duplicate_connection_id')
      .map(({ code, severity, connectionIds }) => ({ code, severity, connectionIds })),
    free: recommendations.freeImprovements.map(item => ({
      code: item.code,
      connectionIds: item.connectionIds,
    })),
    purchases: recommendations.purchases.map(item => ({
      code: item.code,
      connectionIds: item.connectionIds,
    })),
    total: recommendations.total,
  }, {
    duplicateIssues: [{
      code: 'duplicate_connection_id',
      severity: 'error',
      connectionIds: ['duplicate-link'],
    }],
    free: [{ code: 'extend_cable', connectionIds: ['valid-link'] }],
    purchases: [{ code: 'buy_cable', connectionIds: ['valid-link'] }],
    total: 2,
  });
});

test('live insight APIs ignore non-record entries without hiding valid suggestions', () => {
  const floating = object('floating', {
    position: { x: 1.5, y: 0, z: 1.5 },
    scale: { x: 0.2, y: 0.2, z: 0.2 },
  });
  const grounded = object('grounded', { position: { x: -1.5, y: 0, z: 0.5 } });
  const arrayObject = Object.assign([], object('array-floating', {
    position: { x: 0, y: 1, z: 1.5 },
    scale: { x: 0.2, y: 0.2, z: 0.2 },
  }));
  const arrayConnection = Object.assign([], {
    id: 'array-connection',
    name: 'array-connection',
    cableType: 'other',
    length: 1,
    fromObjectId: 'grounded',
    toObjectId: 'floating',
  });
  const objects = [floating, grounded, null, undefined, 42, 'draft', arrayObject];
  const connections = [null, undefined, 42, 'draft', arrayConnection];

  const wiringIssues = analyzeProjectWiring(objects, connections);
  const powerGraph = buildPowerGraph(objects, connections);
  const recommendations = buildRecommendations({ room, objects, connections }, { wiringIssues });

  assert.deepEqual({
    wiringCodes: wiringIssues.map(issue => issue.code),
    powerObjectIds: [...powerGraph.objectById.keys()],
    layoutCodes: analyzeProjectLayout(room, objects).map(issue => issue.code),
    freeCodes: buildFreeImprovements(room, objects, connections).map(item => item.code),
    purchaseCodes: buildPurchaseSuggestions(objects, connections).map(item => item.code),
    facadeFreeCodes: recommendations.freeImprovements.map(item => item.code),
    facadePurchaseCodes: recommendations.purchases.map(item => item.code),
    facadeTotal: recommendations.total,
  }, {
    wiringCodes: [],
    powerObjectIds: ['floating', 'grounded'],
    layoutCodes: ['floating_object'],
    freeCodes: ['drop_to_support'],
    purchaseCodes: [],
    facadeFreeCodes: ['drop_to_support'],
    facadePurchaseCodes: [],
    facadeTotal: 1,
  });
});

test('recommendation builders can reuse precomputed wiring issues', () => {
  const source = object('source', {
    type: 'outlet',
    modelId: 'wall-outlet',
    position: { x: 0, y: 0, z: 0.5 },
    ports: [{ id: 'out', name: 'OUT', type: 'ac_output', direction: 'output' }],
  });
  const device = object('device', {
    type: 'desktop-pc',
    modelId: 'desktop-pc',
    position: { x: 1, y: 0, z: 0.5 },
    ports: [{ id: 'in', name: 'IN', type: 'ac_input', direction: 'input' }],
  });
  const objects = [source, device];

  const computed = buildFreeImprovements(room, objects, []);
  const reusedEmpty = buildFreeImprovements(room, objects, [], { wiringIssues: [] });
  const reusedByFacade = buildRecommendations({ room, objects, connections: [] }, { wiringIssues: [] });

  assert.equal(computed.some(item => item.code === 'auto_power_device'), true);
  assert.equal(reusedEmpty.some(item => item.code === 'auto_power_device'), false);
  assert.equal(reusedByFacade.freeImprovements.some(item => item.code === 'auto_power_device'), false);
});

test('recommendations preserve opaque object and port IDs containing colons', () => {
  const source = object('source:ac', {
    type: 'power_source',
    shape: 'box',
    position: { x: -1.5, y: 0, z: 0.1 },
    scale: { x: 0.2, y: 0.2, z: 0.2 },
    ports: [{ id: 'out:ac', name: 'AC OUT', type: 'ac_output', direction: 'output' }],
  });
  const acDevice = object('device:ac', {
    shape: 'box',
    position: { x: 0, y: 0, z: 0.1 },
    scale: { x: 0.2, y: 0.2, z: 0.2 },
    ports: [{ id: 'in:ac', name: 'AC IN', type: 'ac_input', direction: 'input' }],
  });
  const dcDevice = object('device:dc', {
    shape: 'box',
    position: { x: 1.5, y: 0, z: 0.1 },
    scale: { x: 0.2, y: 0.2, z: 0.2 },
    ports: [{ id: 'in:dc', name: 'DC IN', type: 'dc_input', direction: 'input' }],
  });
  const project = { room, objects: [source, acDevice, dcDevice], connections: [] };

  assert.equal(isProjectEnvelope(project), true, 'colon-delimited IDs are valid project data');
  const wiringIssues = analyzeProjectWiring(project.objects, project.connections);
  const recommendations = buildRecommendations(project, { wiringIssues });

  assert.deepEqual({
    unpoweredObjectIds: wiringIssues
      .filter(issue => issue.code === 'unpowered_input')
      .map(issue => issue.objectIds[0])
      .sort(),
    free: buildFreeImprovements(project.room, project.objects, project.connections, { wiringIssues }).map(item => ({
      code: item.code,
      objectIds: item.objectIds,
      toPortId: item.patch.newConnection?.toPortId,
    })),
    purchases: recommendations.purchases.map(item => ({
      code: item.code,
      product: item.product,
    })),
    total: recommendations.total,
  }, {
    unpoweredObjectIds: ['device:ac', 'device:dc'],
    free: [{
      code: 'auto_power_device',
      objectIds: ['source:ac', 'device:ac'],
      toPortId: 'in:ac',
    }],
    purchases: [{
      code: 'buy_power_strip_for_outlets',
      product: { category: 'power', modelId: 'power-strip', quantity: 1 },
    }],
    total: 1,
  });
});

test('suggestions come in a stable, deterministic order', () => {
  const objects = [
    object('floating', { position: { x: 1.5, y: 0, z: 1.5 }, scale: { x: 0.2, y: 0.2, z: 0.2 } }),
    object('stray', { position: { x: 10, y: 0, z: 0.5 } }),
  ];

  const codes = buildFreeImprovements(room, objects, []).map(item => item.code);
  const sorted = [...codes].sort();
  // move_inside_room (rank 0) must precede drop_to_support (rank 1).
  assert.deepEqual(codes, ['move_inside_room', 'drop_to_support']);
  // And the order must be independent of input object order.
  const reversed = buildFreeImprovements(room, [...objects].reverse(), []).map(item => item.code);
  assert.deepEqual(reversed, codes);
  assert.notDeepEqual(codes, sorted); // guards against accidental alphabetic sort
});

test('applyAllImprovements resolves every reported issue at once', () => {
  const objects = [
    object('floating', { position: { x: 1.5, y: 0, z: 1.5 }, scale: { x: 0.2, y: 0.2, z: 0.2 } }),
    object('stray', { position: { x: 10, y: 0, z: 0.5 } }),
  ];
  const project = { room, objects, connections: [] };

  const suggestions = buildFreeImprovements(room, project.objects, project.connections);
  const next = applyAllImprovements(project, suggestions);

  assert.equal(buildFreeImprovements(next.room, next.objects, next.connections).length, 0);
  assert.equal(project.objects[0].position.z, 1.5, 'original project must be untouched');
});

test('applyAllAvailableImprovements wires power and network in one action', () => {
  const outlet = object('outlet', {
    type: 'outlet', modelId: 'wall-outlet',
    ports: [{ id: 'ac-out', name: 'AC OUT', type: 'ac_output', direction: 'output' }],
  });
  const adapter = object('adapter', {
    type: 'power-adapter', modelId: 'power-adapter',
    ports: [
      { id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' },
      { id: 'dc-out', name: 'DC OUT', type: 'dc_output', direction: 'output' },
    ],
  });
  const router = object('router', {
    type: 'router', modelId: 'router',
    ports: [
      { id: 'dc-in', name: 'DC IN', type: 'dc_input', direction: 'input' },
      { id: 'lan-1', name: 'LAN 1', type: 'ethernet', direction: 'bidirectional' },
    ],
  });
  const pc = object('pc', {
    ports: [{ id: 'eth-1', name: 'LAN', type: 'ethernet', direction: 'bidirectional' }],
  });
  const project = { room, objects: [outlet, adapter, router, pc], connections: [] };

  const next = applyAllAvailableImprovements(project);

  assert.equal(next.connections.some(connection =>
    connection.cableType === 'power'
    && connection.fromObjectId === 'adapter'
    && connection.toObjectId === 'router'
  ), true, 'the router should be powered through the adapter');
  assert.equal(next.connections.some(connection =>
    connection.cableType === 'ethernet'
    && connection.fromObjectId === 'router'
    && connection.toObjectId === 'pc'
  ), true, 'the PC is networked through the router');
  assert.equal(buildFreeImprovements(next.room, next.objects, next.connections).length, 0);
});

test('never recommends network hardware purchases for home desks', () => {
  const router = object('router-1', {
    type: 'router',
    modelId: 'router',
    ports: [
      { id: 'lan-1', name: 'LAN 1', type: 'ethernet', direction: 'bidirectional' },
      { id: 'lan-2', name: 'LAN 2', type: 'ethernet', direction: 'bidirectional' },
      { id: 'lan-3', name: 'LAN 3', type: 'ethernet', direction: 'bidirectional' },
    ],
  });
  const pc = id => object(id, {
    modelId: 'desktop-pc',
    ports: [{ id: 'eth-1', name: 'LAN', type: 'ethernet', direction: 'bidirectional' }],
  });

  for (const objects of [[router, pc('pc1'), pc('pc2'), pc('pc3'), pc('pc4')], [pc('pc1'), pc('pc2')]]) {
    const purchases = buildPurchaseSuggestions(objects, []);
    assert.deepEqual(purchases.filter(item => item.product?.category === 'network'), []);
  }
});

test('applyAllAvailableImprovements reapplies a cable fix after an outlet snap changes its length', () => {
  const outlet = object('outlet', {
    type: 'outlet', modelId: 'wall-outlet',
    position: { x: 0, y: 0, z: 1 },
    scale: { x: 0.08, y: 0.02, z: 0.08 },
    ports: [{ id: 'ac-out', name: 'AC', type: 'ac_output', direction: 'output', anchor: { x: 0, y: -0.5, z: 0 } }],
  });
  const device = object('device', {
    position: { x: 0, y: 0.5, z: 0.5 },
    ports: [{ id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' }],
  });
  const project = {
    room,
    objects: [outlet, device],
    connections: [{
      id: 'c1', name: 'power', cableType: 'power', length: 0.2,
      fromObjectId: 'outlet', fromPortId: 'ac-out', toObjectId: 'device', toPortId: 'ac-in',
    }],
  };

  const next = applyAllAvailableImprovements(project);

  assert.equal(buildFreeImprovements(next.room, next.objects, next.connections)
    .some(item => item.code === 'extend_cable'), false,
  'the cable must be extended again after the outlet snap changes its required length');
  assert.ok(next.connections[0].length > 2,
    'the final cable length should satisfy the larger post-snap distance');
});

test('suggests networking an unconnected ethernet device and the fix creates a valid connection', () => {
  const router = object('router', {
    type: 'router',
    modelId: 'router',
    position: { x: 0, y: 0, z: 0.1 },
    ports: [
      { id: 'lan-1', name: 'LAN 1', type: 'ethernet', direction: 'bidirectional' },
      { id: 'lan-2', name: 'LAN 2', type: 'ethernet', direction: 'bidirectional' }
    ]
  });

  const pc = object('pc', {
    type: 'desktop-pc',
    modelId: 'desktop-pc',
    position: { x: 2, y: 0, z: 0.1 },
    ports: [
      { id: 'eth-1', name: '网口', type: 'ethernet', direction: 'bidirectional' }
    ]
  });

  const objects = [router, pc];

  const suggestions1 = buildFreeImprovements(room, objects, []);
  const connect1 = suggestions1.find(item => item.code === 'auto_network_device');
  assert.ok(connect1, 'expected an auto_network_device suggestion');
  assert.deepEqual(connect1.objectIds, ['router', 'pc']);
  assert.equal(connect1.patch.newConnection.fromObjectId, 'router');
  assert.equal(connect1.patch.newConnection.fromPortId, 'lan-1');
  assert.equal(connect1.patch.newConnection.toObjectId, 'pc');
  assert.equal(connect1.patch.newConnection.toPortId, 'eth-1');
  assert.equal(connect1.patch.newConnection.cableType, 'ethernet');

  const project = { room, objects, connections: [] };
  const next = applyImprovement(project, connect1);
  assert.equal(next.connections.length, 1);

  const suggestions2 = buildFreeImprovements(room, next.objects, next.connections);
  const connect2 = suggestions2.find(item => item.code === 'auto_network_device');
  assert.equal(connect2, undefined, 'recommendation should disappear after connection is applied');
});

test('automatic network fixes remain independently applicable when composite endpoint IDs collide', () => {
  const router = object('router', {
    type: 'router',
    modelId: 'router',
    shape: 'box',
    position: { x: -1.5, y: 0, z: 0.1 },
    scale: { x: 0.2, y: 0.2, z: 0.2 },
    ports: [
      { id: 'lan-1', name: 'LAN 1', type: 'ethernet', direction: 'output' },
      { id: 'lan-2', name: 'LAN 2', type: 'ethernet', direction: 'output' },
    ],
  });
  const firstEndpoint = object('a-b', {
    shape: 'box',
    position: { x: 0, y: 0, z: 0.1 },
    scale: { x: 0.2, y: 0.2, z: 0.2 },
    ports: [{ id: 'c', name: 'Ethernet A', type: 'ethernet', direction: 'input' }],
  });
  const secondEndpoint = object('a', {
    shape: 'box',
    position: { x: 1.5, y: 0, z: 0.1 },
    scale: { x: 0.2, y: 0.2, z: 0.2 },
    ports: [{ id: 'b-c', name: 'Ethernet B', type: 'ethernet', direction: 'input' }],
  });
  const project = {
    room,
    objects: [router, firstEndpoint, secondEndpoint],
    connections: [],
  };
  assert.equal(isProjectEnvelope(project), true);

  const recommendations = engineRecommendations(project);
  const networkSuggestions = recommendations.freeImprovements
    .filter(item => item.code === 'auto_network_device');
  const next = applyAllImprovements(project, networkSuggestions);
  const nextRecommendations = engineRecommendations(next);

  assert.deepEqual({
    suggestedTargets: networkSuggestions
      .map(item => item.patch.newConnection.toObjectId)
      .sort(),
    uniquePatchIds: new Set(networkSuggestions
      .map(item => item.patch.newConnection.id)).size,
    connectedTargets: next.connections.map(connection => connection.toObjectId).sort(),
    uniqueConnectionIds: new Set(next.connections.map(connection => connection.id)).size,
    remainingTargets: nextRecommendations.freeImprovements
      .filter(item => item.code === 'auto_network_device')
      .map(item => item.patch.newConnection.toObjectId)
      .sort(),
  }, {
    suggestedTargets: ['a', 'a-b'],
    uniquePatchIds: 2,
    connectedTargets: ['a', 'a-b'],
    uniqueConnectionIds: 2,
    remainingTargets: [],
  });
});

test('network completion does not depend on whether the router power line is drawn', () => {
  const adapter = object('adapter', {
    type: 'power-adapter', modelId: 'power-adapter',
    ports: [
      { id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' },
      { id: 'dc-out', name: 'DC OUT', type: 'dc_output', direction: 'output' },
    ],
  });
  const router = object('router', {
    type: 'router', modelId: 'router',
    ports: [
      { id: 'dc-in', name: 'DC IN', type: 'dc_input', direction: 'input' },
      { id: 'lan-1', name: 'LAN 1', type: 'ethernet', direction: 'bidirectional' },
    ],
  });
  const pc = object('pc', {
    modelId: 'desktop-pc',
    ports: [{ id: 'eth-1', name: 'LAN', type: 'ethernet', direction: 'bidirectional' }],
  });
  const connections = [{
    id: 'adapter-router', name: 'Adapter router power', cableType: 'power', length: 1,
    fromObjectId: 'adapter', fromPortId: 'dc-out', toObjectId: 'router', toPortId: 'dc-in',
  }];

  const suggestions = buildFreeImprovements(room, [adapter, router, pc], connections);

  assert.equal(suggestions.some(item => item.code === 'auto_network_device'), true,
    'the real router is plugged in even if its adapter is not drawn to an outlet');
});

test('does not suggest networking an ethernet output-only device port', () => {
  const router = object('router', {
    type: 'router',
    modelId: 'router',
    position: { x: 0, y: 0, z: 0.1 },
    ports: [{ id: 'lan-1', name: 'LAN 1', type: 'ethernet', direction: 'bidirectional' }],
  });
  const device = object('uplink-only', {
    position: { x: 1, y: 0, z: 0.1 },
    ports: [{ id: 'uplink', name: 'Uplink', type: 'ethernet', direction: 'output' }],
  });

  const suggestions = buildFreeImprovements(room, [router, device], []);
  assert.equal(suggestions.some(item => item.code === 'auto_network_device'), false);
});

test('suggests splitting load to another outlet when a power hub is overloaded', () => {
  const hub = object('my-strip', {
    type: 'power_strip',
    modelId: 'power-strip',
    maxLoad: 500,
    ports: [
      { id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' },
      { id: 'ac-out-1', name: 'AC OUT 1', type: 'ac_output', direction: 'output' },
      { id: 'ac-out-2', name: 'AC OUT 2', type: 'ac_output', direction: 'output' },
    ]
  });

  const pc = object('my-pc', {
    type: 'desktop-pc',
    wattage: 350,
    ports: [
      { id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' }
    ]
  });

  const monitor = object('my-monitor', {
    type: 'monitor',
    wattage: 200,
    ports: [
      { id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' }
    ]
  });

  const objects = [hub, pc, monitor];

  const connections = [
    { id: 'c1', name: 'c1', cableType: 'power', length: 1, fromObjectId: 'my-strip', fromPortId: 'ac-out-1', toObjectId: 'my-pc', toPortId: 'ac-in' },
    { id: 'c2', name: 'c2', cableType: 'power', length: 1, fromObjectId: 'my-strip', fromPortId: 'ac-out-2', toObjectId: 'my-monitor', toPortId: 'ac-in' }
  ];

  const suggestions = buildPurchaseSuggestions(objects, connections);
  const overloadSuggest = suggestions.find(item => item.code === 'split_overloaded_power');
  assert.ok(overloadSuggest, 'expected a split_overloaded_power purchase suggestion');
  assert.deepEqual(overloadSuggest.objectIds, ['my-strip']);
  assert.equal(overloadSuggest.product.category, 'power');
  assert.equal(overloadSuggest.product.modelId, 'power-strip');
  assert.match(overloadSuggest.description, /另一个墙壁插座/);
  assert.doesNotMatch(overloadSuggest.description, /UPS/);
});

test('App power safety falls back to catalog maxLoad only for unusable live overrides', () => {
  const cases = [
    { label: 'missing', includeOverride: false, expected: true },
    { label: 'null', maxLoad: null, expected: true },
    { label: 'zero', maxLoad: 0, expected: false },
    { label: 'negative', maxLoad: -1, expected: true },
    { label: 'NaN', maxLoad: Number.NaN, expected: true },
    { label: 'blank string', maxLoad: '   ', expected: true },
    { label: 'numeric string', maxLoad: '4000', expected: false },
    { label: 'nonnumeric string', maxLoad: 'oops', expected: true },
  ];

  const actual = cases.map(({
    label,
    includeOverride = true,
    maxLoad,
  }) => {
    const strip = object('catalog-strip', {
      type: 'power_strip',
      modelId: 'power-strip',
      ports: [{ id: 'out', name: 'OUT', type: 'ac_output', direction: 'output' }],
      ...(includeOverride ? { maxLoad } : {}),
    });
    const load = object('heavy-load', {
      wattage: 3000,
      ports: [{ id: 'in', name: 'IN', type: 'ac_input', direction: 'input' }],
    });
    const objects = [strip, load];
    const connections = [{
      id: 'power',
      name: 'Power',
      cableType: 'power',
      length: 1,
      fromObjectId: 'catalog-strip',
      fromPortId: 'out',
      toObjectId: 'heavy-load',
      toPortId: 'in',
    }];
    const wiringIssues = analyzeProjectWiring(objects, connections);
    const recommendations = buildRecommendations(
      { room, objects, connections },
      { wiringIssues }
    );

    return {
      label,
      wiringOverload: wiringIssues.some(issue => issue.code === 'power_overload'),
      purchaseOverload: recommendations.purchases.some(
        item => item.code === 'split_overloaded_power'
      ),
    };
  });

  assert.deepEqual(actual, cases.map(({ label, expected }) => ({
    label,
    wiringOverload: expected,
    purchaseOverload: expected,
  })));
});

test('App power safety falls back to catalog wattage only for unusable live overrides', () => {
  const cases = [
    { label: 'missing', includeOverride: false, expected: true },
    { label: 'null', wattage: null, expected: true },
    { label: 'zero', wattage: 0, expected: false },
    { label: 'negative', wattage: -1, expected: true },
    { label: 'NaN', wattage: Number.NaN, expected: true },
    { label: 'blank string', wattage: '   ', expected: true },
    { label: 'numeric string', wattage: '250', expected: false },
    { label: 'nonnumeric string', wattage: 'oops', expected: true },
  ];

  const actual = cases.map(({
    label,
    includeOverride = true,
    wattage,
  }) => {
    const strip = object('limited-strip', {
      type: 'power_strip',
      modelId: 'power-strip',
      maxLoad: 300,
      ports: [{ id: 'out', name: 'OUT', type: 'ac_output', direction: 'output' }],
    });
    const load = object('catalog-load', {
      type: 'desktop-pc',
      modelId: 'desktop-pc',
      ports: [{ id: 'in', name: 'IN', type: 'ac_input', direction: 'input' }],
      ...(includeOverride ? { wattage } : {}),
    });
    const objects = [strip, load];
    const connections = [{
      id: 'power',
      name: 'Power',
      cableType: 'power',
      length: 1,
      fromObjectId: 'limited-strip',
      fromPortId: 'out',
      toObjectId: 'catalog-load',
      toPortId: 'in',
    }];
    const wiringIssues = analyzeProjectWiring(objects, connections);
    const recommendations = buildRecommendations(
      { room, objects, connections },
      { wiringIssues }
    );

    return {
      label,
      wiringOverload: wiringIssues.some(issue => issue.code === 'power_overload'),
      purchaseOverload: recommendations.purchases.some(
        item => item.code === 'split_overloaded_power'
      ),
    };
  });

  assert.deepEqual(actual, cases.map(({ label, expected }) => ({
    label,
    wiringOverload: expected,
    purchaseOverload: expected,
  })));
});

test('the catalog no longer offers a UPS to home users', () => {
  assert.equal(findModelTemplate({ modelId: 'ups' }), null);
});

test('suggests connecting an unconnected HDMI output to a nearby monitor', () => {
  const pc = object('pc', {
    type: 'desktop-pc',
    modelId: 'desktop-pc',
    position: { x: 0, y: 0, z: 0.5 },
    ports: [{ id: 'hdmi-out', name: 'HDMI OUT', type: 'hdmi', direction: 'output' }],
  });
  const monitor = object('monitor1', {
    type: 'monitor',
    modelId: 'monitor-24',
    position: { x: 1, y: 0, z: 0.5 },
    ports: [{ id: 'hdmi-in', name: 'HDMI IN', type: 'hdmi', direction: 'input' }],
  });
  const objects = [pc, monitor];

  const suggestions = buildFreeImprovements(room, objects, []);
  const connect = suggestions.find(item => item.code === 'auto_connect_display');
  assert.ok(connect, 'expected an auto_connect_display suggestion');
  assert.equal(connect.patch.newConnection.fromObjectId, 'pc');
  assert.equal(connect.patch.newConnection.fromPortId, 'hdmi-out');
  assert.equal(connect.patch.newConnection.toObjectId, 'monitor1');
  assert.equal(connect.patch.newConnection.toPortId, 'hdmi-in');
  assert.equal(connect.patch.newConnection.cableType, 'hdmi');

  // Apply and verify
  const project = { room, objects, connections: [] };
  const next = applyImprovement(project, connect);
  assert.equal(next.connections.length, 1);

  const suggestions2 = buildFreeImprovements(room, next.objects, next.connections);
  assert.equal(suggestions2.some(item => item.code === 'auto_connect_display'), false,
    'suggestion should disappear after connection is applied');
});

test('live recommendations tolerate non-string model IDs when the display type is known', () => {
  const source = object('source', {
    position: { x: 0, y: 0, z: 0.5 },
    ports: [{ id: 'hdmi-out', name: 'HDMI OUT', type: 'hdmi', direction: 'output' }],
  });
  const display = object('display', {
    type: 'monitor',
    modelId: 42,
    position: { x: 1, y: 0, z: 0.5 },
    ports: [{ id: 'hdmi-in', name: 'HDMI IN', type: 'hdmi', direction: 'input' }],
  });
  const project = { room, objects: [source, display], connections: [] };
  const wiringIssues = analyzeProjectWiring(project.objects, project.connections);

  const recommendations = engineRecommendations(project, { wiringIssues });

  assert.deepEqual({
    free: recommendations.freeImprovements.map(item => ({
      code: item.code,
      objectIds: item.objectIds,
      cableType: item.patch.newConnection?.cableType,
    })),
    purchases: recommendations.purchases,
    total: recommendations.total,
  }, {
    free: [{
      code: 'auto_connect_display',
      objectIds: ['source', 'display'],
      cableType: 'hdmi',
    }],
    purchases: [],
    total: 1,
  });
});

test('does not suggest display connection when monitor HDMI input is occupied', () => {
  const pc = object('pc', {
    type: 'desktop-pc',
    modelId: 'desktop-pc',
    position: { x: 0, y: 0, z: 0.5 },
    ports: [{ id: 'hdmi-out', name: 'HDMI OUT', type: 'hdmi', direction: 'output' }],
  });
  const monitor = object('monitor1', {
    type: 'monitor',
    modelId: 'monitor-24',
    position: { x: 1, y: 0, z: 0.5 },
    ports: [{ id: 'hdmi-in', name: 'HDMI IN', type: 'hdmi', direction: 'input' }],
  });
  const otherPc = object('pc2', {
    type: 'desktop-pc',
    modelId: 'desktop-pc',
    position: { x: 2, y: 0, z: 0.5 },
    ports: [{ id: 'hdmi-out', name: 'HDMI OUT', type: 'hdmi', direction: 'output' }],
  });
  const objects = [pc, monitor, otherPc];
  // Monitor's HDMI-in is already used by otherPc
  const connections = [
    { id: 'existing', name: 'existing', cableType: 'hdmi', length: 1,
      fromObjectId: 'pc2', fromPortId: 'hdmi-out', toObjectId: 'monitor1', toPortId: 'hdmi-in' },
  ];

  const suggestions = buildFreeImprovements(room, objects, connections);
  assert.equal(suggestions.some(item => item.code === 'auto_connect_display'), false,
    'should not suggest when monitor input is already occupied');
});

test('suggests connecting DisplayPort output to nearby monitor with DP input', () => {
  const pc = object('pc', {
    type: 'desktop-pc',
    modelId: 'desktop-pc',
    position: { x: 0, y: 0, z: 0.5 },
    ports: [
      { id: 'dp-out', name: 'DP OUT', type: 'displayport', direction: 'output' },
      { id: 'hdmi-out', name: 'HDMI OUT', type: 'hdmi', direction: 'output' },
    ],
  });
  const monitor = object('monitor1', {
    type: 'monitor',
    modelId: 'monitor-24',
    position: { x: 1, y: 0, z: 0.5 },
    ports: [
      { id: 'dp-in', name: 'DP IN', type: 'displayport', direction: 'input' },
      { id: 'hdmi-in', name: 'HDMI IN', type: 'hdmi', direction: 'input' },
    ],
  });
  const objects = [pc, monitor];

  const suggestions = buildFreeImprovements(room, objects, []);
  const displaySuggestions = suggestions.filter(item => item.code === 'auto_connect_display');
  assert.equal(displaySuggestions.length, 1, 'one cable per computer-monitor pair is enough');
  assert.equal(displaySuggestions[0].patch.newConnection.cableType, 'displayport');
});

test('does not suggest a second video cable to a monitor the computer already feeds', () => {
  const pc = object('pc', {
    type: 'desktop-pc',
    modelId: 'desktop-pc',
    position: { x: 0, y: 0, z: 0.5 },
    ports: [
      { id: 'dp-out', name: 'DP OUT', type: 'displayport', direction: 'output' },
      { id: 'hdmi-out', name: 'HDMI OUT', type: 'hdmi', direction: 'output' },
    ],
  });
  const monitor = object('monitor1', {
    type: 'monitor',
    modelId: 'monitor-24',
    position: { x: 1, y: 0, z: 0.5 },
    ports: [
      { id: 'dp-in', name: 'DP IN', type: 'displayport', direction: 'input' },
      { id: 'hdmi-in', name: 'HDMI IN', type: 'hdmi', direction: 'input' },
    ],
  });
  const secondMonitor = object('monitor2', {
    type: 'monitor',
    modelId: 'monitor-24',
    position: { x: -1, y: 0, z: 0.5 },
    ports: [{ id: 'hdmi-in', name: 'HDMI IN', type: 'hdmi', direction: 'input' }],
  });
  const connections = [{
    id: 'pc-dp', name: 'PC DP', cableType: 'displayport', length: 2,
    fromObjectId: 'pc', fromPortId: 'dp-out', toObjectId: 'monitor1', toPortId: 'dp-in',
  }];

  const onlyOneMonitor = buildFreeImprovements(room, [pc, monitor], connections)
    .filter(item => item.code === 'auto_connect_display');
  assert.deepEqual(onlyOneMonitor, [], 'the spare HDMI output should not nag about the same screen');

  const withSecondMonitor = buildFreeImprovements(room, [pc, monitor, secondMonitor], connections)
    .filter(item => item.code === 'auto_connect_display');
  assert.equal(withSecondMonitor.length, 1);
  assert.equal(withSecondMonitor[0].patch.newConnection.toObjectId, 'monitor2',
    'the spare output goes to the screen that still needs a signal');
});

test('suggests connecting USB-C display output to nearby monitor with USB-C input', () => {
  const laptop = object('laptop', {
    type: 'laptop',
    modelId: 'laptop-15',
    position: { x: 0, y: 0, z: 0.5 },
    ports: [{ id: 'usb-c', name: 'USB-C', type: 'usb_c', direction: 'bidirectional' }],
  });
  const monitor = object('monitor1', {
    type: 'monitor',
    modelId: 'monitor-27',
    position: { x: 1, y: 0, z: 0.5 },
    ports: [{ id: 'usb-c-in', name: 'USB-C IN', type: 'usb_c', direction: 'input' }],
  });
  const objects = [laptop, monitor];

  const suggestions = buildFreeImprovements(room, objects, []);
  const connect = suggestions.find(item => item.code === 'auto_connect_display');
  assert.ok(connect, 'expected an auto_connect_display suggestion');
  assert.equal(connect.patch.newConnection.fromObjectId, 'laptop');
  assert.equal(connect.patch.newConnection.fromPortId, 'usb-c');
  assert.equal(connect.patch.newConnection.toObjectId, 'monitor1');
  assert.equal(connect.patch.newConnection.toPortId, 'usb-c-in');
  assert.equal(connect.patch.newConnection.cableType, 'usb_c');

  const project = { room, objects, connections: [] };
  const next = applyImprovement(project, connect);
  assert.equal(next.connections.length, 1);

  const suggestions2 = buildFreeImprovements(room, next.objects, next.connections);
  assert.equal(suggestions2.some(item => item.code === 'auto_connect_display'), false,
    'suggestion should disappear after USB-C display connection is applied');
});

test('a device without a drawn power line is assumed powered, not a problem', () => {
  const outlet = object('outlet', {
    ports: [{ id: 'ac-out-1', name: '插座 1', type: 'ac_output', direction: 'output' }, { id: 'ac-out-2', name: '插座 2', type: 'ac_output', direction: 'output' }],
  });
  const pc = object('pc', { ports: [{ id: 'ac-in', name: '电源输入', type: 'ac_input', direction: 'input' }] });

  const unpowered = analyzeProjectWiring([outlet, pc], []).filter(issue => issue.code === 'unpowered_input');
  assert.equal(unpowered.length, 1);
  assert.equal(unpowered[0].severity, 'info', 'a missing line in the model is only a note');
  assert.match(unpowered[0].description, /按已通电处理/);

  const recommendations = buildRecommendations({ room, objects: [outlet, pc], connections: [] });
  assert.deepEqual(recommendations, { freeImprovements: [], purchases: [], total: 0 },
    'no "connect power" nag and nothing to buy');
});

const acDevice = id => object(id, { ports: [{ id: 'ac-in', name: '电源输入', type: 'ac_input', direction: 'input' }] });
const wallOutlet = id => object(id, {
  type: 'outlet', modelId: 'wall-outlet',
  ports: [1, 2].map(n => ({ id: `ac-out-${n}`, name: `插座 ${n}`, type: 'ac_output', direction: 'output' })),
});
const sixWayStrip = id => object(id, {
  type: 'power_strip', modelId: 'power-strip',
  ports: [
    { id: 'ac-in', name: '电源输入', type: 'ac_input', direction: 'input' },
    ...[1, 2, 3, 4, 5, 6].map(n => ({ id: `ac-out-${n}`, name: `插孔 ${n}`, type: 'ac_output', direction: 'output' })),
  ],
});
const outletPurchase = objects => buildPurchaseSuggestions(objects, [])
  .find(item => item.code === 'buy_power_strip_for_outlets');

test('suggests strips only when devices that need a plug outnumber the modeled outlets', () => {
  const fourDevices = ['a', 'b', 'c', 'd'].map(acDevice);
  const short = outletPurchase([wallOutlet('wall'), ...fourDevices]);
  assert.ok(short);
  assert.deepEqual(short.product, { category: 'power', modelId: 'power-strip', quantity: 1 });
  assert.match(short.title, /插孔不够/);
  assert.match(short.description, /4 个设备需要插电，现有插孔 2 个/);

  assert.equal(outletPurchase([wallOutlet('wall'), sixWayStrip('strip'), ...['a', 'b', 'c', 'd', 'e'].map(acDevice)]), undefined,
    'a modeled strip adds its outlets (it uses one itself)');

  const many = outletPurchase([wallOutlet('wall'), ...Array.from({ length: 13 }, (_, index) => acDevice(`d${index}`))]);
  assert.equal(many.product.quantity, 3, 'each extra strip adds five usable outlets');
});

test('a laptop counts as one plug through its charger unless it is wired to a modeled adapter', () => {
  const laptop = object('laptop', { ports: [{ id: 'dc-in', name: 'DC 输入', type: 'dc_input', direction: 'input' }] });
  const adapter = object('adapter', {
    type: 'power-adapter', modelId: 'power-adapter',
    ports: [
      { id: 'ac-in', name: 'AC 插头', type: 'ac_input', direction: 'input' },
      { id: 'dc-out', name: 'DC 输出', type: 'dc_output', direction: 'output' },
    ],
  });
  const outlet = object('outlet', { type: 'outlet', modelId: 'wall-outlet', ports: [{ id: 'ac-out-1', name: '插座', type: 'ac_output', direction: 'output' }] });

  assert.ok(outletPurchase([outlet, acDevice('pc'), laptop]), 'pc + laptop charger need two plugs, one is modeled');
  const charged = buildPurchaseSuggestions([outlet, acDevice('pc'), laptop, adapter], [{
    id: 'adapter-laptop', name: '笔记本电源线', cableType: 'power', length: 1.5,
    fromObjectId: 'adapter', fromPortId: 'dc-out', toObjectId: 'laptop', toPortId: 'dc-in',
  }]).find(item => item.code === 'buy_power_strip_for_outlets');
  assert.ok(charged, 'the adapter now takes the plug instead of the laptop, still two plugs for one outlet');
});

test('no outlet check when the user has not modeled any outlets', () => {
  assert.equal(outletPurchase(['a', 'b', 'c'].map(acDevice)), undefined);
});


test('unconnected video and network ports are completed, not suggested as fixes', () => {
  const pc = object('pc', {
    position: { x: 0, y: 0, z: 0.5 },
    ports: [
      { id: 'hdmi-out', name: 'HDMI 输出', type: 'hdmi', direction: 'output' },
      { id: 'eth-1', name: '网口', type: 'ethernet', direction: 'bidirectional' },
    ],
  });
  const monitor = object('monitor', {
    type: 'monitor', modelId: 'monitor-24', position: { x: 1, y: 0, z: 0.5 },
    ports: [{ id: 'hdmi-in', name: 'HDMI 输入', type: 'hdmi', direction: 'input' }],
  });
  const router = object('router', {
    type: 'router', modelId: 'router', position: { x: -1, y: 0, z: 0.5 },
    ports: [{ id: 'lan-1', name: '网口 1', type: 'ethernet', direction: 'bidirectional' }],
  });
  const project = { room, objects: [pc, monitor, router], connections: [] };

  const engine = buildFreeImprovements(room, project.objects, []).map(item => item.code).sort();
  assert.deepEqual(engine, ['auto_connect_display', 'auto_network_device'], 'the engine still knows how to draw them');
  assert.deepEqual(buildRecommendations(project).freeImprovements, [], 'but a user is not told to plug in their own monitor');
});

const poweredSetup = () => {
  const outlet = object('outlet', {
    position: { x: -1.5, y: 0, z: 0.3 },
    ports: [1, 2].map(n => ({ id: `ac-out-${n}`, name: `插座 ${n}`, type: 'ac_output', direction: 'output' })),
  });
  const strip = { ...sixWayStrip('strip'), position: { x: 0, y: 0, z: 0.05 } };
  const router = object('router', {
    type: 'router', modelId: 'router', position: { x: -1, y: 1, z: 0.05 },
    ports: [
      { id: 'ac-in', name: '电源输入', type: 'ac_input', direction: 'input' },
      { id: 'lan-1', name: '网口 1', type: 'ethernet', direction: 'bidirectional' },
    ],
  });
  const monitor = object('monitor', {
    type: 'monitor', modelId: 'monitor-24', position: { x: 0.5, y: 0.5, z: 1 },
    ports: [
      { id: 'ac-in', name: '电源输入', type: 'ac_input', direction: 'input' },
      { id: 'hdmi-in', name: 'HDMI 输入', type: 'hdmi', direction: 'input' },
      { id: 'dp-in', name: 'DP 输入', type: 'displayport', direction: 'input' },
    ],
  });
  const connections = [
    { id: 'outlet-strip', name: '插排电源线', cableType: 'power', length: 3, fromObjectId: 'outlet', fromPortId: 'ac-out-1', toObjectId: 'strip', toPortId: 'ac-in' },
    { id: 'strip-router', name: '路由器电源线', cableType: 'power', length: 3, fromObjectId: 'strip', fromPortId: 'ac-out-1', toObjectId: 'router', toPortId: 'ac-in' },
    { id: 'strip-monitor', name: '显示器电源线', cableType: 'power', length: 3, fromObjectId: 'strip', fromPortId: 'ac-out-2', toObjectId: 'monitor', toPortId: 'ac-in' },
  ];
  return { outlet, strip, router, monitor, connections };
};

test('completing a newly added computer draws its power, video and network lines', () => {
  const { outlet, strip, router, monitor, connections } = poweredSetup();
  const pc = object('pc', {
    position: { x: 1, y: 0, z: 0.25 },
    ports: [
      { id: 'ac-in', name: '电源输入', type: 'ac_input', direction: 'input' },
      { id: 'hdmi-out', name: 'HDMI 输出', type: 'hdmi', direction: 'output' },
      { id: 'dp-out', name: 'DP 输出', type: 'displayport', direction: 'output' },
      { id: 'eth-1', name: '网口', type: 'ethernet', direction: 'bidirectional' },
    ],
  });
  const project = { room, objects: [outlet, strip, router, monitor, pc], connections };

  const lines = buildConnectionCompletion(project, 'pc');
  const kind = line => (['hdmi', 'displayport'].includes(line.cableType) ? 'video' : line.cableType);
  assert.deepEqual(lines.map(line => [kind(line), line.fromObjectId, line.toObjectId]).sort(), [
    ['ethernet', 'router', 'pc'],
    ['power', 'strip', 'pc'],
    ['video', 'pc', 'monitor'],
  ], 'one video cable to the monitor, not two');

  const completed = { ...project, connections: [...connections, ...lines] };
  assert.deepEqual(analyzeProjectWiring(completed.objects, completed.connections)
    .filter(issue => issue.severity !== 'info').map(issue => issue.title), []);
});

test('adding a strip first plugs it in, then powers the devices around it', () => {
  const outlet = object('outlet', {
    position: { x: -1.5, y: 0, z: 0.3 },
    ports: [{ id: 'ac-out-1', name: '插座', type: 'ac_output', direction: 'output' }],
  });
  const pc = { ...acDevice('pc'), position: { x: 1, y: 0, z: 0.25 } };
  const lamp = { ...acDevice('lamp'), position: { x: 1.5, y: 1, z: 0.25 } };
  const strip = { ...sixWayStrip('strip'), position: { x: 0, y: 0, z: 0.05 } };

  const lines = buildConnectionCompletion({ room, objects: [outlet, pc, lamp, strip], connections: [] }, 'strip');
  assert.deepEqual(lines.map(line => [line.fromObjectId, line.toObjectId]).sort(), [
    ['outlet', 'strip'],
    ['strip', 'lamp'],
    ['strip', 'pc'],
  ]);
});

test('completion returns nothing when there is nothing to connect', () => {
  assert.deepEqual(buildConnectionCompletion({ room, objects: [acDevice('pc')], connections: [] }, 'pc'), []);
  assert.deepEqual(buildConnectionCompletion({ room, objects: [], connections: [] }, 'missing'), []);
  assert.deepEqual(buildConnectionCompletion({ objects: [acDevice('pc')], connections: [] }, 'pc'), []);
});

test('a new power strip goes into a free wall outlet, never into another strip', async () => {
  const { buildTemplateScene } = await import('../src/domain/desk-templates.js');
  const { findModelTemplate } = await import('../src/domain/catalog.js');
  const { placeCatalogObject } = await import('../src/domain/placement.js');
  const { analyzeProjectWiring } = await import('../src/domain/analysis.js');
  const scene = buildTemplateScene('gaming');
  const { object: strip } = placeCatalogObject({
    modelTemplate: findModelTemplate({ modelId: 'power-strip' }), categoryId: 'power', room: scene.room, id: 'strip-2', objects: scene.objects,
  });
  const objects = [...scene.objects, strip];
  const outlet = objects.find(object => object.modelId === 'wall-outlet');

  const lines = buildConnectionCompletion({ room: scene.room, objects, connections: scene.connections }, 'strip-2');
  assert.deepEqual(lines.map(line => [line.fromObjectId, line.toObjectId, line.toPortId]), [[outlet.id, 'strip-2', 'ac-in']]);
  assert.deepEqual(analyzeProjectWiring(objects, [...scene.connections, ...lines]).filter(issue => issue.severity !== 'info'), []);

  // With every wall socket taken, the strip is left undrawn rather than chained.
  const blocker = { id: 'lamp', name: '台灯', type: 'lamp', shape: 'rect', position: { ...outlet.position }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 0.1, y: 0.1, z: 0.1 },
    ports: [{ id: 'ac-in', name: '电源', type: 'ac_input', direction: 'input' }] };
  const busyConnections = [...scene.connections, {
    id: 'lamp-power', name: '台灯电源线', cableType: 'power', length: 1.5,
    fromObjectId: outlet.id, fromPortId: 'ac-out-2', toObjectId: 'lamp', toPortId: 'ac-in',
  }];
  const noLines = buildConnectionCompletion({ room: scene.room, objects: [...objects, blocker], connections: busyConnections }, 'strip-2');
  assert.deepEqual(noLines, []);
  const issues = analyzeProjectWiring([...objects, blocker], busyConnections).filter(issue => issue.severity !== 'info');
  assert.ok(!issues.some(issue => issue.code === 'power_strip_chain'));
});
