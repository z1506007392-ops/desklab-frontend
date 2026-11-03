import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeProjectWiring,
  buildPowerGraph,
  getInvalidConnectionIds,
  summarizeWiringIssues,
  computeDevicePowerLoad,
  classifyPowerLoad,
} from '../src/domain/analysis.js';
import { placeCatalogObject } from '../src/domain/placement.js';
import { DEVICE_CATALOG, findModelTemplate } from '../src/domain/catalog.js';
import { PASSIVE_CABLE_LIMITS } from '../src/domain/cable-limits.js';
import { isProjectEnvelope } from '../src/domain/project-validation.js';
import { DESK_TEMPLATES, buildTemplateScene } from '../src/domain/desk-templates.js';
import { buildDeskScene } from '../src/domain/scene-builder.js';

const port = (id, type, direction) => ({ id, name: id, type, direction });
const object = (id, ports, overrides = {}) => ({
  id,
  name: id,
  type: 'device',
  position: { x: 0, y: 0, z: 0 },
  ports,
  ...overrides,
});
const connection = (id, fromObjectId, fromPortId, toObjectId, toPortId, length = 1) => ({
  id,
  name: id,
  cableType: 'power',
  fromObjectId,
  fromPortId,
  toObjectId,
  toPortId,
  length,
});

test('reports short cables and unconnected power inputs', () => {
  const objects = [
    object('source', [port('out', 'dc_output', 'output')]),
    object('target', [port('in', 'dc_input', 'input')], { position: { x: 3, y: 4, z: 0 } }),
    object('unpowered', [port('in', 'ac_input', 'input')]),
  ];
  const issues = analyzeProjectWiring(objects, [connection('c1', 'source', 'out', 'target', 'in', 4)]);
  assert.ok(issues.some(issue => issue.code === 'short_cable'));
  assert.ok(issues.some(issue => issue.id === 'unpowered:unpowered:in'));
  // A missing power line is only a note: the real device is plugged in.
  assert.deepEqual(summarizeWiringIssues(issues), { error: 0, warning: 1, info: 1 });
});

test('the catalog wall outlet overloads above 2500W and warns above 90 percent', () => {
  const outletPorts = findModelTemplate({ modelId: 'wall-outlet' }).ports;
  const outlet = object('墙壁插座', outletPorts, { type: 'outlet', modelId: 'wall-outlet', name: '墙壁插座' });
  const load = watts => object('大功率设备', [port('in', 'ac_input', 'input')], { name: '大功率设备', wattage: watts });
  const wired = watts => analyzeProjectWiring([outlet, load(watts)], [
    connection('c1', '墙壁插座', 'ac-out-1', '大功率设备', 'in', 2),
  ]).map(issue => issue.code);
  assert.equal(wired(2000).includes('power_overload'), false);
  assert.equal(wired(2000).includes('power_warning'), false);
  assert.equal(wired(2400).includes('power_overload'), false);
  assert.equal(wired(2400).includes('power_warning'), true);
  assert.equal(wired(3000).includes('power_overload'), true);
});

test('a keyboard cabled to a mouse is invalid, and the project still loads', () => {
  const keyboard = object('键盘', [port('usb', 'usb', 'bidirectional')], { type: 'keyboard', modelId: 'keyboard', name: '键盘' });
  const mouse = object('鼠标', [port('usb', 'usb', 'bidirectional')], { type: 'mouse', modelId: 'mouse', name: '鼠标' });
  const link = connection('c1', '键盘', 'usb', '鼠标', 'usb', 1);
  link.cableType = 'usb';
  link.name = '键鼠线';
  const issues = analyzeProjectWiring([keyboard, mouse], [link]);
  const incompatible = issues.find(issue => issue.code === 'incompatible_port_types');
  assert.ok(incompatible);
  assert.match(incompatible.description, /都要接到电脑上/);
  assert.ok(incompatible.invalidConnectionIds.includes('c1'));
  const room = { length: 4, width: 3.5, height: 2.7 };
  const project = {
    room,
    objects: [keyboard, mouse].map(item => ({
      ...item,
      category: 'peripheral',
      shape: 'rect',
      position: { x: 0, y: 0, z: 0.02 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 0.2, y: 0.1, z: 0.03 },
    })),
    connections: [link],
  };
  assert.equal(isProjectEnvelope(project), true, 'an old save with this cable still opens');

  const drive = object('硬盘', [port('usb', 'usb', 'bidirectional')], { name: '移动硬盘' });
  const dock = object('扩展坞', [port('usb', 'usb', 'bidirectional')], { name: '扩展坞' });
  const other = connection('c2', '硬盘', 'usb', '扩展坞', 'usb', 1);
  other.cableType = 'usb';
  assert.equal(analyzeProjectWiring([drive, dock], [other]).some(issue => issue.code === 'incompatible_port_types'), false);
});

test('reports cables that can connect but lack recommended service slack', () => {
  const objects = [
    object('source', [port('out', 'ethernet', 'output')]),
    object('target', [port('in', 'ethernet', 'input')], { position: { x: 3, y: 4, z: 0 } }),
  ];
  const ethernetConnection = connection('c1', 'source', 'out', 'target', 'in', 5.2);
  ethernetConnection.cableType = 'ethernet';
  const issues = analyzeProjectWiring(objects, [ethernetConnection]);
  assert.equal(issues.some(issue => issue.code === 'short_cable'), false);
  assert.equal(issues.some(issue => issue.code === 'low_cable_slack'), true);
});

test('reports power-strip daisy chains and power cycles', () => {
  const stripA = object('a', [
    port('in', 'ac_input', 'input'),
    port('out', 'ac_output', 'output'),
  ], { type: 'power_strip', modelId: 'power-strip' });
  const stripB = object('b', [
    port('in', 'ac_input', 'input'),
    port('out', 'ac_output', 'output'),
  ], { type: 'power_strip', modelId: 'power-strip' });
  const connections = [
    connection('ab', 'a', 'out', 'b', 'in'),
    connection('ba', 'b', 'out', 'a', 'in'),
  ];
  const issues = analyzeProjectWiring([stripA, stripB], connections);
  assert.equal(issues.filter(issue => issue.code === 'power_strip_chain').length, 2);
  assert.ok(issues.some(issue => issue.code === 'power_cycle'));
});

test('does not report a power cycle for a branching power tree', () => {
  const objects = [
    object('outlet', [
      port('o1', 'ac_output', 'output'),
      port('o2', 'ac_output', 'output'),
    ], { type: 'outlet', modelId: 'wall-outlet' }),
    object('deviceA', [port('in', 'ac_input', 'input')]),
    object('deviceB', [port('in', 'ac_input', 'input')]),
  ];
  const connections = [
    connection('a', 'outlet', 'o1', 'deviceA', 'in'),
    connection('b', 'outlet', 'o2', 'deviceB', 'in'),
  ];

  const issues = analyzeProjectWiring(objects, connections);
  assert.equal(issues.some(issue => issue.code === 'power_cycle'), false);
  assert.equal(summarizeWiringIssues(issues).error, 0, JSON.stringify(issues));
});

test('detects a multi-hop power cycle spanning more than two devices', () => {
  const strip = (id) => object(id, [
    port('in', 'ac_input', 'input'),
    port('out', 'ac_output', 'output'),
  ], { type: 'power_strip', modelId: 'power-strip' });
  const objects = [strip('a'), strip('b'), strip('c')];
  const connections = [
    connection('ab', 'a', 'out', 'b', 'in'),
    connection('bc', 'b', 'out', 'c', 'in'),
    connection('ca', 'c', 'out', 'a', 'in'),
  ];

  const issues = analyzeProjectWiring(objects, connections);
  assert.ok(issues.some(issue => issue.code === 'power_cycle'));
});

test('reports legacy center-to-center connections as informational', () => {
  const objects = [object('a', []), object('b', [])];
  const issues = analyzeProjectWiring(objects, [{
    id: 'legacy',
    name: 'Legacy',
    cableType: 'other',
    fromObjectId: 'a',
    toObjectId: 'b',
    length: 1,
  }]);
  assert.equal(issues[0].code, 'legacy_connection');
  assert.equal(issues[0].severity, 'info');
  assert.deepEqual(getInvalidConnectionIds(issues), []);
});

test('rejects legacy connections with unknown cable types', () => {
  const objects = [object('a', []), object('b', [])];
  const issues = analyzeProjectWiring(objects, [{
    id: 'unknown-cable',
    name: 'Unknown cable',
    cableType: 'mystery',
    fromObjectId: 'a',
    toObjectId: 'b',
    length: 1,
  }]);

  assert.ok(issues.some(issue => issue.code === 'invalid_connection_cable_type'));
  assert.equal(issues.some(issue => issue.code === 'legacy_connection'), false);
  assert.deepEqual(getInvalidConnectionIds(issues), ['unknown-cable']);
});

test('reports stale object and port references as errors', () => {
  const objects = [
    object('source', [port('out', 'hdmi', 'output')]),
    object('target', [port('in', 'hdmi', 'input')]),
  ];
  const danglingObject = connection('missing-object', 'source', 'out', 'ghost', 'in');
  danglingObject.cableType = 'hdmi';
  const missingPort = connection('missing-port', 'source', 'old-out', 'target', 'in');
  missingPort.cableType = 'hdmi';
  const partialPort = {
    ...connection('partial', 'source', 'out', 'target', undefined),
    cableType: 'hdmi',
  };

  const issues = analyzeProjectWiring(objects, [danglingObject, missingPort, partialPort]);
  assert.ok(issues.some(issue => issue.code === 'dangling_connection_object'));
  assert.ok(issues.some(issue => issue.code === 'missing_connection_port'));
  assert.ok(issues.some(issue => issue.code === 'partial_port_binding'));
});

test('does not treat blank port ids as legacy unbound connections', () => {
  const objects = [
    object('source', [port('out', 'hdmi', 'output')]),
    object('target', [port('in', 'hdmi', 'input')]),
  ];
  const blankPorts = connection('blank-ports', 'source', '', 'target', '');
  blankPorts.cableType = 'hdmi';

  const issues = analyzeProjectWiring(objects, [blankPorts]);

  assert.ok(issues.some(issue => issue.code === 'invalid_connection_port_id'));
  assert.equal(issues.some(issue => issue.code === 'legacy_connection'), false);
  assert.deepEqual(getInvalidConnectionIds(issues), ['blank-ports']);
});

test('rejects blank connection ids without occupying power ports', () => {
  const objects = [
    object('source', [port('out', 'ac_output', 'output')]),
    object('target', [port('in', 'ac_input', 'input')]),
  ];
  const blankId = connection('   ', 'source', 'out', 'target', 'in');

  const issues = analyzeProjectWiring(objects, [blankId]);

  assert.ok(issues.some(issue => issue.code === 'invalid_connection_id'));
  assert.ok(issues.some(issue => issue.id === 'unpowered:target:in'));
  assert.deepEqual(getInvalidConnectionIds(issues), ['   ']);
});

test('rejects blank connection names without occupying power ports', () => {
  const objects = [
    object('source', [port('out', 'ac_output', 'output')]),
    object('target', [port('in', 'ac_input', 'input')]),
  ];
  const blankName = connection('blank-name', 'source', 'out', 'target', 'in');
  blankName.name = '   ';

  const issues = analyzeProjectWiring(objects, [blankName]);

  assert.ok(issues.some(issue => issue.code === 'invalid_connection_name'));
  assert.ok(issues.some(issue => issue.id === 'unpowered:target:in'));
  assert.deepEqual(getInvalidConnectionIds(issues), ['blank-name']);
});

test('reports duplicate connection ids even when their ports differ', () => {
  const objects = [
    object('source', [
      port('out-1', 'hdmi', 'output'),
      port('out-2', 'hdmi', 'output'),
    ]),
    object('target-a', [port('in', 'hdmi', 'input')]),
    object('target-b', [port('in', 'hdmi', 'input')]),
  ];
  const first = connection('duplicate-id', 'source', 'out-1', 'target-a', 'in');
  const duplicate = connection('duplicate-id', 'source', 'out-2', 'target-b', 'in');
  first.cableType = 'hdmi';
  duplicate.cableType = 'hdmi';

  const issues = analyzeProjectWiring(objects, [first, duplicate]);

  assert.ok(issues.some(issue => issue.code === 'duplicate_connection_id'));
  assert.deepEqual(getInvalidConnectionIds(issues), ['duplicate-id']);
});

test('reports self-referencing connections as invalid instead of a power loop', () => {
  const device = object('device', [
    port('ac-in', 'ac_input', 'input'),
    port('ac-out', 'ac_output', 'output'),
  ]);
  const selfConnection = connection('self-power', 'device', 'ac-out', 'device', 'ac-in');

  const issues = analyzeProjectWiring([device], [selfConnection]);

  assert.ok(issues.some(issue => issue.code === 'self_connection'));
  assert.equal(issues.some(issue => issue.code === 'power_cycle'), false);
  assert.deepEqual(getInvalidConnectionIds(issues), ['self-power']);
});

test('rejects non-positive cable lengths without occupying power ports', () => {
  const objects = [
    object('source', [port('out', 'ac_output', 'output')]),
    object('target', [port('in', 'ac_input', 'input')]),
  ];
  const invalidLength = connection('zero-length', 'source', 'out', 'target', 'in', 0);

  const issues = analyzeProjectWiring(objects, [invalidLength]);

  assert.ok(issues.some(issue => issue.code === 'invalid_connection_length'));
  assert.ok(issues.some(issue => issue.id === 'unpowered:target:in'));
  assert.deepEqual(getInvalidConnectionIds(issues), ['zero-length']);
});

test('reports invalid semantics and duplicate physical port occupancy', () => {
  const objects = [
    object('source', [port('out', 'hdmi', 'output')]),
    object('target-a', [port('in', 'hdmi', 'input')]),
    object('target-b', [port('in', 'hdmi', 'input')]),
  ];
  const wrongCable = connection('wrong-cable', 'source', 'out', 'target-a', 'in');
  wrongCable.cableType = 'power';
  const valid = connection('valid', 'source', 'out', 'target-a', 'in');
  valid.cableType = 'hdmi';
  const duplicate = connection('duplicate', 'source', 'out', 'target-b', 'in');
  duplicate.cableType = 'hdmi';

  const issues = analyzeProjectWiring(objects, [wrongCable, valid, duplicate]);
  assert.ok(issues.some(issue => issue.code === 'cable_type_mismatch'));
  assert.ok(issues.some(issue => issue.code === 'port_overbooked'));
  assert.deepEqual(getInvalidConnectionIds(issues).sort(), ['duplicate', 'wrong-cable']);
});

test('does not confuse distinct occupied ports whose ids contain the occupancy delimiter', () => {
  const objects = [
    object('source\0x', [port('out', 'hdmi', 'output')]),
    object('source', [port('x\0out', 'hdmi', 'output')]),
    object('target-a', [port('in', 'hdmi', 'input')]),
    object('target-b', [port('in', 'hdmi', 'input')]),
  ];
  const first = connection('first', 'source\0x', 'out', 'target-a', 'in');
  first.cableType = 'hdmi';
  const second = connection('second', 'source', 'x\0out', 'target-b', 'in');
  second.cableType = 'hdmi';

  const issues = analyzeProjectWiring(objects, [first, second]);

  assert.equal(issues.some(issue => issue.code === 'port_overbooked'), false);
  assert.deepEqual(getInvalidConnectionIds(issues), []);
});

test('does not mark advisory wiring issues for automatic deletion', () => {
  const issues = [
    { code: 'short_cable', connectionIds: ['short'] },
    { code: 'power_strip_chain', connectionIds: ['chain'] },
    { code: 'legacy_connection', connectionIds: ['legacy'] },
  ];
  assert.deepEqual(getInvalidConnectionIds(issues), []);
});

test('shipped catalog devices connected through compatible ports raise no wiring errors', () => {
  const room = { length: 100, width: 100, height: 100 };
  const placeByModelId = (modelId, id) => {
    for (const category of DEVICE_CATALOG) {
      const model = category.models.find(candidate => candidate.modelId === modelId);
      if (model) {
        return placeCatalogObject({ modelTemplate: model, categoryId: category.category, room, id }).object;
      }
    }
    throw new Error(`unknown model ${modelId}`);
  };

  const objects = [
    placeByModelId('wall-outlet', 'outlet'),
    placeByModelId('power-strip', 'strip'),
    placeByModelId('monitor-24', 'monitor'),
    placeByModelId('desktop-pc', 'pc'),
  ];

  const cable = (id, fromObjectId, fromPortId, toObjectId, toPortId, cableType) => ({
    id, name: id, cableType, fromObjectId, fromPortId, toObjectId, toPortId, length: 2,
  });
  const connections = [
    cable('outlet-strip', 'outlet', 'ac-out-1', 'strip', 'ac-in', 'power'),
    cable('strip-monitor', 'strip', 'ac-out-1', 'monitor', 'ac-in', 'power'),
    cable('strip-pc', 'strip', 'ac-out-2', 'pc', 'ac-in', 'power'),
    cable('pc-monitor', 'pc', 'hdmi-out', 'monitor', 'hdmi-in', 'hdmi'),
  ];

  const issues = analyzeProjectWiring(objects, connections);
  assert.equal(summarizeWiringIssues(issues).error, 0, JSON.stringify(issues.filter(i => i.severity === 'error')));
  assert.deepEqual(getInvalidConnectionIds(issues), []);
});

test('does not flag matching custom/future port types carried as other cables', () => {
  const objects = [
    object('source', [port('out', 'thunderbolt', 'output')]),
    object('target', [port('in', 'thunderbolt', 'input')]),
  ];
  const custom = connection('custom', 'source', 'out', 'target', 'in');
  custom.cableType = 'other';

  const issues = analyzeProjectWiring(objects, [custom]);
  assert.equal(summarizeWiringIssues(issues).error, 0, JSON.stringify(issues));
  assert.deepEqual(getInvalidConnectionIds(issues), []);
});

test('reports unused ports with unsupported directions', () => {
  const device = object('device', [port('hdmi', 'hdmi', 'sideways')]);

  const issues = analyzeProjectWiring([device], []);

  const invalidDirection = issues.find(issue => issue.code === 'invalid_port_direction_definition');
  assert.equal(invalidDirection?.severity, 'error');
  assert.deepEqual(invalidDirection?.connectionIds, []);
  assert.deepEqual(invalidDirection?.objectIds, ['device']);
});

test('reports blank port ids even when unused', () => {
  const device = object('device', [port('   ', 'hdmi', 'output')]);

  const issues = analyzeProjectWiring([device], []);

  const invalidPort = issues.find(issue => issue.code === 'invalid_port_id_definition');
  assert.equal(invalidPort?.severity, 'error');
  assert.deepEqual(invalidPort?.connectionIds, []);
  assert.deepEqual(invalidPort?.objectIds, ['device']);
});

test('reports blank port types even when unused', () => {
  const device = object('device', [port('custom', '   ', 'output')]);

  const issues = analyzeProjectWiring([device], []);

  const invalidType = issues.find(issue => issue.code === 'invalid_port_type_definition');
  assert.equal(invalidType?.severity, 'error');
  assert.deepEqual(invalidType?.connectionIds, []);
  assert.deepEqual(invalidType?.objectIds, ['device']);
});

test('reports blank port names even when unused', () => {
  const unnamedPort = { ...port('custom', 'hdmi', 'output'), name: '   ' };
  const device = object('device', [unnamedPort]);

  const issues = analyzeProjectWiring([device], []);

  const invalidName = issues.find(issue => issue.code === 'invalid_port_name_definition');
  assert.equal(invalidName?.severity, 'error');
  assert.deepEqual(invalidName?.connectionIds, []);
  assert.deepEqual(invalidName?.objectIds, ['device']);
});

test('reports invalid port anchors even when unused', () => {
  const invalidPort = {
    ...port('out', 'hdmi', 'output'),
    anchor: { x: 0.75, y: 0, z: 0 },
  };
  const issues = analyzeProjectWiring([object('device', [invalidPort])], []);

  assert.deepEqual(
    issues
      .filter(issue => issue.code === 'invalid_port_anchor_definition')
      .map(({ id, code, severity, connectionIds, objectIds }) => ({
        id,
        code,
        severity,
        connectionIds,
        objectIds,
      })),
    [{
      id: 'invalid-port-anchor:device:out',
      code: 'invalid_port_anchor_definition',
      severity: 'error',
      connectionIds: [],
      objectIds: ['device'],
    }]
  );
});

test('rejects connections that use blank port types', () => {
  const objects = [
    object('source', [port('out', '   ', 'output')]),
    object('target', [port('in', '   ', 'input')]),
  ];
  const invalidEndpoint = connection('blank-type', 'source', 'out', 'target', 'in');
  invalidEndpoint.cableType = 'other';

  const issues = analyzeProjectWiring(objects, [invalidEndpoint]);

  assert.ok(issues.some(issue => issue.code === 'invalid_connection_port_type'));
  assert.deepEqual(getInvalidConnectionIds(issues), ['blank-type']);
});

test('rejects blank connection port ids without occupying power inputs', () => {
  const objects = [
    object('source', [port('   ', 'ac_output', 'output')]),
    object('target', [port('in', 'ac_input', 'input')]),
  ];
  const invalidEndpoint = connection('blank-port', 'source', '   ', 'target', 'in');

  const issues = analyzeProjectWiring(objects, [invalidEndpoint]);

  assert.ok(issues.some(issue => issue.code === 'invalid_connection_port_id'));
  assert.ok(issues.some(issue => issue.id === 'unpowered:target:in'));
  assert.deepEqual(getInvalidConnectionIds(issues), ['blank-port']);
});

test('analyzes connections through valid ports after malformed port entries', () => {
  const objects = [
    object('source', [null, port('out', 'dc_output', 'output')]),
    object('target', [null, port('in', 'dc_input', 'input')]),
  ];

  const issues = analyzeProjectWiring(
    objects,
    [connection('valid-after-null', 'source', 'out', 'target', 'in')]
  );

  assert.deepEqual({
    invalidPortDefinitions: issues.filter(issue => issue.code === 'invalid_port_id_definition').length,
    invalidConnectionIds: getInvalidConnectionIds(issues),
    targetIsUnpowered: issues.some(issue => issue.id === 'unpowered:target:in'),
  }, {
    invalidPortDefinitions: 2,
    invalidConnectionIds: [],
    targetIsUnpowered: false,
  });
});

test('reports non-array port collections even when unused', () => {
  const objects = [
    object('record-ports', {}),
    object('string-ports', 'invalid'),
    object('number-ports', 42),
  ];

  const issues = analyzeProjectWiring(objects, []);

  assert.deepEqual(
    issues
      .filter(issue => issue.code === 'invalid_port_collection_definition')
      .map(({ id, code, severity, connectionIds, objectIds }) => ({
        id,
        code,
        severity,
        connectionIds,
        objectIds,
      })),
    [
      {
        id: 'invalid-port-collection:record-ports',
        code: 'invalid_port_collection_definition',
        severity: 'error',
        connectionIds: [],
        objectIds: ['record-ports'],
      },
      {
        id: 'invalid-port-collection:string-ports',
        code: 'invalid_port_collection_definition',
        severity: 'error',
        connectionIds: [],
        objectIds: ['string-ports'],
      },
      {
        id: 'invalid-port-collection:number-ports',
        code: 'invalid_port_collection_definition',
        severity: 'error',
        connectionIds: [],
        objectIds: ['number-ports'],
      },
    ]
  );
});

test('reports duplicate port ids even when unused', () => {
  const device = object('device', [
    port('duplicate', 'hdmi', 'output'),
    port('duplicate', 'ethernet', 'output'),
  ]);

  const issues = analyzeProjectWiring([device], []);

  const duplicatePort = issues.find(issue => issue.code === 'duplicate_port_id_definition');
  assert.equal(duplicatePort?.severity, 'error');
  assert.deepEqual(duplicatePort?.connectionIds, []);
  assert.deepEqual(duplicatePort?.objectIds, ['device']);
});

test('reports duplicate object ids even when unused', () => {
  const objects = [
    object('duplicate', [], { name: 'First device' }),
    object('duplicate', [], { name: 'Second device' }),
  ];

  const issues = analyzeProjectWiring(objects, []);

  const duplicateObject = issues.find(issue => issue.code === 'duplicate_object_id_definition');
  assert.equal(duplicateObject?.severity, 'error');
  assert.deepEqual(duplicateObject?.connectionIds, []);
  assert.deepEqual(duplicateObject?.objectIds, ['duplicate']);
});

test('reports blank object ids even when unused', () => {
  const device = object('   ', [], { name: 'Unnamed device' });

  const issues = analyzeProjectWiring([device], []);

  const invalidObject = issues.find(issue => issue.code === 'invalid_object_id_definition');
  assert.equal(invalidObject?.severity, 'error');
  assert.deepEqual(invalidObject?.connectionIds, []);
  assert.deepEqual(invalidObject?.objectIds, ['   ']);
});

test('rejects blank connection object ids without occupying power inputs', () => {
  const objects = [
    object('   ', [port('out', 'ac_output', 'output')], { name: 'Invalid source' }),
    object('target', [port('in', 'ac_input', 'input')]),
  ];
  const invalidEndpoint = connection('blank-object', '   ', 'out', 'target', 'in');

  const issues = analyzeProjectWiring(objects, [invalidEndpoint]);

  assert.ok(issues.some(issue => issue.code === 'invalid_connection_object_id'));
  assert.ok(issues.some(issue => issue.id === 'unpowered:target:in'));
  assert.deepEqual(getInvalidConnectionIds(issues), ['blank-object']);
});

test('rejects connections that reference duplicate object ids without occupying power inputs', () => {
  const objects = [
    object('source', [port('out', 'hdmi', 'output')], { name: 'First source' }),
    object('source', [port('out', 'ac_output', 'output')], { name: 'Second source' }),
    object('target', [port('in', 'ac_input', 'input')]),
  ];
  const ambiguous = connection('ambiguous-object', 'source', 'out', 'target', 'in');

  const issues = analyzeProjectWiring(objects, [ambiguous]);

  assert.ok(issues.some(issue => issue.code === 'ambiguous_connection_object'));
  assert.ok(issues.some(issue => issue.id === 'unpowered:target:in'));
  assert.deepEqual(getInvalidConnectionIds(issues), ['ambiguous-object']);
});

test('rejects connections that reference duplicate port ids without occupying power inputs', () => {
  const objects = [
    object('source', [
      port('out', 'ac_output', 'output'),
      port('out', 'hdmi', 'output'),
    ]),
    object('target', [port('in', 'ac_input', 'input')]),
  ];
  const ambiguous = connection('ambiguous', 'source', 'out', 'target', 'in');

  const issues = analyzeProjectWiring(objects, [ambiguous]);

  assert.ok(issues.some(issue => issue.code === 'ambiguous_connection_port'));
  assert.ok(issues.some(issue => issue.id === 'unpowered:target:in'));
  assert.deepEqual(getInvalidConnectionIds(issues), ['ambiguous']);
});

test('reports power ports whose direction contradicts their type', () => {
  const objects = [
    object('bad-source', [port('bad-out', 'ac_input', 'output')]),
    object('bad-target', [port('bad-in', 'ac_output', 'input')]),
  ];
  const badPowerConnection = connection(
    'bad-power',
    'bad-source',
    'bad-out',
    'bad-target',
    'bad-in'
  );

  const issues = analyzeProjectWiring(objects, [badPowerConnection]);
  assert.ok(issues.some(issue => issue.code === 'invalid_power_port_direction'));
  assert.ok(issues.some(issue => issue.code === 'invalid_power_port_definition'));
  assert.deepEqual(getInvalidConnectionIds(issues), ['bad-power']);
});

test('reports power overload and power warning for power hubs', () => {
  const ups = object('my-ups', [
    port('ac-in', 'ac_input', 'input'),
    port('ac-out-1', 'ac_output', 'output'),
    port('ac-out-2', 'ac_output', 'output'),
  ], { type: 'ups', modelId: 'ups', maxLoad: 500 });

  const pc = object('my-pc', [
    port('ac-in', 'ac_input', 'input')
  ], { type: 'desktop-pc', modelId: 'desktop-pc', wattage: 350 });

  const monitor = object('my-monitor', [
    port('ac-in', 'ac_input', 'input')
  ], { type: 'monitor', modelId: 'monitor-27', wattage: 200 });

  const objects = [ups, pc, monitor];

  const conns1 = [
    connection('c1', 'my-ups', 'ac-out-1', 'my-pc', 'ac-in', 1.5)
  ];
  const issues1 = analyzeProjectWiring(objects, conns1);
  assert.equal(issues1.some(i => i.code === 'power_overload' || i.code === 'power_warning'), false);

  const conns2 = [
    connection('c1', 'my-ups', 'ac-out-1', 'my-pc', 'ac-in', 1.5),
    connection('c2', 'my-ups', 'ac-out-2', 'my-monitor', 'ac-in', 1.5)
  ];
  const issues2 = analyzeProjectWiring(objects, conns2);
  assert.ok(issues2.some(i => i.code === 'power_overload'));
  const overloadIssue = issues2.find(i => i.code === 'power_overload');
  assert.deepEqual(overloadIssue.objectIds, ['my-ups']);

  const lightMonitor = object('my-monitor', [
    port('ac-in', 'ac_input', 'input')
  ], { type: 'monitor', modelId: 'monitor-27', wattage: 120 });
  const issues3 = analyzeProjectWiring([ups, pc, lightMonitor], conns2);
  assert.ok(issues3.some(i => i.code === 'power_warning'));
});

test('classifyPowerLoad reports overload, warning, and ok consistently', () => {
  // No / non-positive limit means there is nothing to classify against.
  assert.equal(classifyPowerLoad(1000, 0), 'ok');
  assert.equal(classifyPowerLoad(1000, undefined), 'ok');

  // Strictly over the limit is an overload; exactly at the limit is a warning.
  assert.equal(classifyPowerLoad(501, 500), 'overload');
  assert.equal(classifyPowerLoad(500, 500), 'warning');
  // The warning threshold is strict: exactly 90% is still ok, just above it warns.
  assert.equal(classifyPowerLoad(450, 500), 'ok');
  assert.equal(classifyPowerLoad(451, 500), 'warning');

  // String/invalid inputs are coerced, not concatenated or NaN-compared.
  assert.equal(classifyPowerLoad('900', '500'), 'overload');
  assert.equal(classifyPowerLoad('oops', '500'), 'ok');
});

test('computeDevicePowerLoad correctly aggregates power load recursively', () => {
  const ups = object('my-ups', [
    port('ac-in', 'ac_input', 'input'),
    port('ac-out-1', 'ac_output', 'output'),
  ], { type: 'ups', modelId: 'ups', maxLoad: 500 });

  const strip = object('my-strip', [
    port('ac-in', 'ac_input', 'input'),
    port('ac-out-1', 'ac_output', 'output'),
    port('ac-out-2', 'ac_output', 'output'),
  ], { type: 'power_strip', modelId: 'power-strip', wattage: 0, maxLoad: 2500 });

  const pc = object('my-pc', [
    port('ac-in', 'ac_input', 'input')
  ], { type: 'desktop-pc', wattage: 350 });

  const monitor = object('my-monitor', [
    port('ac-in', 'ac_input', 'input')
  ], { type: 'monitor', wattage: 60 });

  const objects = [ups, strip, pc, monitor];

  // ups -> strip -> (pc, monitor)
  const conns = [
    connection('c1', 'my-ups', 'ac-out-1', 'my-strip', 'ac-in', 1.0),
    connection('c2', 'my-strip', 'ac-out-1', 'my-pc', 'ac-in', 1.5),
    connection('c3', 'my-strip', 'ac-out-2', 'my-monitor', 'ac-in', 1.5),
  ];

  const upsLoad = computeDevicePowerLoad('my-ups', objects, conns);
  const stripLoad = computeDevicePowerLoad('my-strip', objects, conns);
  const pcLoad = computeDevicePowerLoad('my-pc', objects, conns);

  assert.equal(upsLoad, 350 + 60); // 410W
  assert.equal(stripLoad, 350 + 60); // 410W
  assert.equal(pcLoad, 0); // 没有外接设备，外接负载为0
});

test('computes an independent power branch despite an unrelated power cycle', () => {
  const hub = object('hub', [port('ac-out', 'ac_output', 'output')]);
  const load = object('load', [port('ac-in', 'ac_input', 'input')], { wattage: 300 });
  const cycleA = object('cycle-a', [
    port('in-1', 'ac_input', 'input'),
    port('out-1', 'ac_output', 'output'),
  ]);
  const cycleB = object('cycle-b', [
    port('in-1', 'ac_input', 'input'),
    port('out-1', 'ac_output', 'output'),
  ]);
  const connections = [
    connection('hub-load', 'hub', 'ac-out', 'load', 'ac-in'),
    connection('cycle-ab', 'cycle-a', 'out-1', 'cycle-b', 'in-1'),
    connection('cycle-ba', 'cycle-b', 'out-1', 'cycle-a', 'in-1'),
  ];

  assert.equal(computeDevicePowerLoad('hub', [hub, load, cycleA, cycleB], connections), 300,
    'an unrelated invalid cycle must not suppress the known load on a separate branch');
});

test('power graph ignores invalid direction and type power connections', () => {
  const wrongDirectionSource = object('wrong-direction-source', [
    port('ac-out', 'ac_output', 'input'),
  ]);
  const wrongDirectionLoad = object('wrong-direction-load', [
    port('ac-in', 'ac_input', 'input'),
  ], { wattage: 600 });
  const incompatibleSource = object('incompatible-source', [
    port('dc-out', 'dc_output', 'output'),
  ]);
  const incompatibleLoad = object('incompatible-load', [
    port('ac-in', 'ac_input', 'input'),
  ], { wattage: 700 });
  const wrongCableSource = object('wrong-cable-source', [
    port('ac-out', 'ac_output', 'output'),
  ]);
  const wrongCableLoad = object('wrong-cable-load', [
    port('ac-in', 'ac_input', 'input'),
  ], { wattage: 800 });
  const wrongCable = connection('wrong-cable', 'wrong-cable-source', 'ac-out', 'wrong-cable-load', 'ac-in');
  wrongCable.cableType = 'hdmi';
  const objects = [
    wrongDirectionSource, wrongDirectionLoad,
    incompatibleSource, incompatibleLoad,
    wrongCableSource, wrongCableLoad,
  ];
  const connections = [
    connection('wrong-direction', 'wrong-direction-source', 'ac-out', 'wrong-direction-load', 'ac-in'),
    connection('incompatible', 'incompatible-source', 'dc-out', 'incompatible-load', 'ac-in'),
    wrongCable,
  ];

  const graph = buildPowerGraph(objects, connections);
  assert.equal(computeDevicePowerLoad('wrong-direction-source', objects, connections, graph), 0);
  assert.equal(computeDevicePowerLoad('incompatible-source', objects, connections, graph), 0);
  assert.equal(computeDevicePowerLoad('wrong-cable-source', objects, connections, graph), 0);
});

test('power graph ignores connections with invalid cable lengths', () => {
  const objects = [
    object('source', [port('out', 'ac_output', 'output')]),
    object('target', [port('in', 'ac_input', 'input')], { wattage: 300 }),
  ];
  const invalidLength = connection('zero-length', 'source', 'out', 'target', 'in', 0);

  assert.equal(computeDevicePowerLoad('source', objects, [invalidLength]), 0);
});

test('power graph ignores connections with blank ids', () => {
  const objects = [
    object('source', [port('out', 'ac_output', 'output')]),
    object('target', [port('in', 'ac_input', 'input')], { wattage: 300 }),
  ];
  const blankId = connection('   ', 'source', 'out', 'target', 'in');

  assert.equal(computeDevicePowerLoad('source', objects, [blankId]), 0);
});

test('power graph ignores connections with blank names', () => {
  const objects = [
    object('source', [port('out', 'ac_output', 'output')]),
    object('target', [port('in', 'ac_input', 'input')], { wattage: 300 }),
  ];
  const blankName = connection('blank-name', 'source', 'out', 'target', 'in');
  blankName.name = '   ';

  assert.equal(computeDevicePowerLoad('source', objects, [blankName]), 0);
});

test('power graph ignores connections that reference duplicate port ids', () => {
  const objects = [
    object('source', [
      port('out', 'ac_output', 'output'),
      port('out', 'hdmi', 'output'),
    ]),
    object('target', [port('in', 'ac_input', 'input')], { wattage: 300 }),
  ];
  const ambiguous = connection('ambiguous', 'source', 'out', 'target', 'in');

  assert.equal(computeDevicePowerLoad('source', objects, [ambiguous]), 0);
});

test('power graph ignores connections that reference duplicate object ids', () => {
  const objects = [
    object('source', [port('out', 'hdmi', 'output')], { name: 'First source' }),
    object('source', [port('out', 'ac_output', 'output')], { name: 'Second source' }),
    object('target', [port('in', 'ac_input', 'input')], { wattage: 300 }),
  ];
  const ambiguous = connection('ambiguous-object', 'source', 'out', 'target', 'in');

  assert.equal(computeDevicePowerLoad('source', objects, [ambiguous]), 0);
});

test('power graph ignores connections with blank object ids', () => {
  const objects = [
    object('   ', [port('out', 'ac_output', 'output')], { name: 'Invalid source' }),
    object('target', [port('in', 'ac_input', 'input')], { wattage: 300 }),
  ];
  const invalidEndpoint = connection('blank-object', '   ', 'out', 'target', 'in');

  assert.equal(computeDevicePowerLoad('   ', objects, [invalidEndpoint]), 0);
});

test('power graph ignores connections with blank port ids', () => {
  const objects = [
    object('source', [port('   ', 'ac_output', 'output')]),
    object('target', [port('in', 'ac_input', 'input')], { wattage: 300 }),
  ];
  const invalidEndpoint = connection('blank-port', 'source', '   ', 'target', 'in');

  assert.equal(computeDevicePowerLoad('source', objects, [invalidEndpoint]), 0);
});

test('power graph ignores a later connection that reuses a physical port', () => {
  const source = object('source', [
    port('ac-out', 'ac_output', 'output'),
  ]);
  const firstLoad = object('first-load', [
    port('ac-in', 'ac_input', 'input'),
  ], { wattage: 300 });
  const duplicateLoad = object('duplicate-load', [
    port('ac-in', 'ac_input', 'input'),
  ], { wattage: 300 });
  const objects = [source, firstLoad, duplicateLoad];
  const connections = [
    connection('first', 'source', 'ac-out', 'first-load', 'ac-in'),
    connection('duplicate', 'source', 'ac-out', 'duplicate-load', 'ac-in'),
  ];

  const graph = buildPowerGraph(objects, connections);
  assert.equal(computeDevicePowerLoad('source', objects, connections, graph), 300);
});

test('power graph ignores a later connection that reuses a connection id', () => {
  const source = object('source', [
    port('ac-out-1', 'ac_output', 'output'),
    port('ac-out-2', 'ac_output', 'output'),
  ]);
  const firstLoad = object('first-load', [port('ac-in', 'ac_input', 'input')], { wattage: 300 });
  const duplicateLoad = object('duplicate-load', [port('ac-in', 'ac_input', 'input')], { wattage: 300 });
  const first = connection('duplicate-id', 'source', 'ac-out-1', 'first-load', 'ac-in');
  const duplicate = connection('duplicate-id', 'source', 'ac-out-2', 'duplicate-load', 'ac-in');
  const objects = [source, firstLoad, duplicateLoad];

  const graph = buildPowerGraph(objects, [first, duplicate]);

  assert.equal(computeDevicePowerLoad('source', objects, [first, duplicate], graph), 300);
});

test('power load coerces string/invalid wattage and maxLoad instead of corrupting math', () => {
  // Drafts/imports can carry numeric fields as strings; isProjectObject does not
  // validate wattage/maxLoad, so the engine must coerce them. String "+" must not
  // turn the running load total into a concatenated string.
  const strip = object('my-strip', [
    port('ac-in', 'ac_input', 'input'),
    port('ac-out-1', 'ac_output', 'output'),
    port('ac-out-2', 'ac_output', 'output'),
  ], { type: 'power_strip', modelId: 'power-strip', maxLoad: '2500' });
  const heater = object('heater', [port('ac-in', 'ac_input', 'input')], { wattage: '900' });
  const fan = object('fan', [port('ac-in', 'ac_input', 'input')], { wattage: 'oops' });

  const conns = [
    connection('c1', 'my-strip', 'ac-out-1', 'heater', 'ac-in', 1.5),
    connection('c2', 'my-strip', 'ac-out-2', 'fan', 'ac-in', 1.5),
  ];

  const stripLoad = computeDevicePowerLoad('my-strip', [strip, heater, fan], conns);
  assert.equal(typeof stripLoad, 'number');
  assert.equal(stripLoad, 900); // "900" -> 900, invalid "oops" -> 0

  // String maxLoad must still be comparable for overload detection.
  const overheated = object('my-strip', [
    port('ac-in', 'ac_input', 'input'),
    port('ac-out-1', 'ac_output', 'output'),
  ], { type: 'power_strip', modelId: 'power-strip', maxLoad: '500' });
  const bigLoad = object('big', [port('ac-in', 'ac_input', 'input')], { wattage: '900' });
  const issues = analyzeProjectWiring(
    [overheated, bigLoad],
    [connection('c', 'my-strip', 'ac-out-1', 'big', 'ac-in', 1.5)]
  );
  const overload = issues.find(i => i.code === 'power_overload');
  assert.ok(overload, 'expected power_overload with string maxLoad/wattage');
  assert.match(overload.description, /900W/);
});

test('shared power graph produces the same load totals as standalone load checks', () => {
  const ups = object('my-ups', [
    port('ac-in', 'ac_input', 'input'),
    port('ac-out-1', 'ac_output', 'output'),
  ], { type: 'ups', modelId: 'ups', maxLoad: 500 });

  const strip = object('my-strip', [
    port('ac-in', 'ac_input', 'input'),
    port('ac-out-1', 'ac_output', 'output'),
    port('ac-out-2', 'ac_output', 'output'),
  ], { type: 'power_strip', modelId: 'power-strip', wattage: 0, maxLoad: 2500 });

  const pc = object('my-pc', [
    port('ac-in', 'ac_input', 'input')
  ], { type: 'desktop-pc', wattage: 350 });

  const monitor = object('my-monitor', [
    port('ac-in', 'ac_input', 'input')
  ], { type: 'monitor', wattage: 60 });

  const objects = [ups, strip, pc, monitor];
  const conns = [
    connection('c1', 'my-ups', 'ac-out-1', 'my-strip', 'ac-in', 1.0),
    connection('c2', 'my-strip', 'ac-out-1', 'my-pc', 'ac-in', 1.5),
    connection('c3', 'my-strip', 'ac-out-2', 'my-monitor', 'ac-in', 1.5),
  ];

  const powerGraph = buildPowerGraph(objects, conns);

  assert.equal(computeDevicePowerLoad('my-ups', objects, conns, powerGraph), computeDevicePowerLoad('my-ups', objects, conns));
  assert.equal(computeDevicePowerLoad('my-strip', objects, conns, powerGraph), computeDevicePowerLoad('my-strip', objects, conns));
  assert.equal(computeDevicePowerLoad('my-pc', objects, conns, powerGraph), computeDevicePowerLoad('my-pc', objects, conns));
});

test('a passive cable past its common length is a warning with a way to fix it', () => {
  const hdmi = (id, type, direction) => object(id, [port(id, type, direction)], {
    position: { x: 0, y: 0, z: 0 },
  });
  const screen = hdmi('screen', 'hdmi', 'input');
  screen.position = { x: 1, y: 0, z: 0 };
  const host = hdmi('host', 'hdmi', 'output');
  const line = (length, cableType = 'hdmi', fromType = 'hdmi', toType = 'hdmi') => {
    const link = connection('c', 'host', 'host', 'screen', 'screen', length);
    link.cableType = cableType;
    host.ports[0].type = fromType;
    screen.ports[0].type = toType;
    return link;
  };

  const within = analyzeProjectWiring([host, screen], [line(PASSIVE_CABLE_LIMITS.hdmi.maxMetres)]);
  assert.equal(within.some(issue => issue.code === 'passive_cable_too_long'), false);

  const over = analyzeProjectWiring([host, screen], [line(PASSIVE_CABLE_LIMITS.hdmi.maxMetres + 0.01)]);
  const warning = over.find(issue => issue.code === 'passive_cable_too_long');
  assert.equal(warning.severity, 'warning');
  assert.match(warning.description, /有源线、光纤线/);
  assert.match(warning.description, /挪近/);
  assert.match(warning.title, /HDMI/);

  const routeHost = object('far-host', [port('out', 'hdmi', 'output')], { position: { x: 0, y: 0, z: 0 } });
  const routeScreen = object('far-screen', [port('in', 'hdmi', 'input')], { position: { x: 4, y: 0, z: 0 } });
  const routed = connection('long-run', 'far-host', 'out', 'far-screen', 'in', 1);
  routed.cableType = 'hdmi';
  const routedIssues = analyzeProjectWiring([routeHost, routeScreen], [routed]);
  assert.ok(routedIssues.some(issue => issue.code === 'passive_cable_too_long'));
  assert.ok(routedIssues.some(issue => issue.code === 'short_cable'));

  const power = connection('mains', 'host', 'host', 'screen', 'screen', 30);
  host.ports[0].type = 'ac_output';
  host.ports[0].direction = 'output';
  screen.ports[0].type = 'ac_input';
  screen.ports[0].direction = 'input';
  const powerIssues = analyzeProjectWiring([host, screen], [power]);
  assert.equal(powerIssues.some(issue => issue.code === 'passive_cable_too_long'), false);

  for (const [cableType, limit] of Object.entries(PASSIVE_CABLE_LIMITS)) {
    const from = object('a', [port('out', cableType, 'output')]);
    const to = object('b', [port('in', cableType, 'input')], { position: { x: 0.2, y: 0, z: 0 } });
    const ok = connection('ok', 'a', 'out', 'b', 'in', limit.maxMetres);
    ok.cableType = cableType;
    assert.equal(analyzeProjectWiring([from, to], [ok]).some(issue => issue.code === 'passive_cable_too_long'), false, cableType);
    const tooLong = connection('over', 'a', 'out', 'b', 'in', limit.maxMetres + 0.05);
    tooLong.cableType = cableType;
    const hit = analyzeProjectWiring([from, to], [tooLong]).find(issue => issue.code === 'passive_cable_too_long');
    assert.ok(hit, cableType);
    assert.match(hit.description, new RegExp(`${limit.maxMetres} 米`));
  }
});

test('built-in desks do not warn about passive cable length', () => {
  for (const template of DESK_TEMPLATES) {
    const scene = buildTemplateScene(template.id);
    const issues = analyzeProjectWiring(scene.objects, scene.connections);
    assert.equal(issues.some(issue => issue.code === 'passive_cable_too_long'), false, template.name);
  }
  const scene = buildDeskScene({
    desk: { length: 3, depth: 1.2 },
    devices: [
      { modelId: 'desktop-pc', count: 1 },
      { modelId: 'laptop-15', count: 1 },
      { modelId: 'monitor-27', count: 2 },
      { modelId: 'ultrawide-monitor', count: 1 },
      { modelId: 'router', count: 1 },
      { modelId: 'keyboard', count: 1 },
      { modelId: 'mouse', count: 1 },
      { modelId: 'speakers', count: 1 },
      { modelId: 'game-console', count: 1 },
    ],
  });
  const issues = analyzeProjectWiring(scene.objects, scene.connections);
  assert.equal(issues.some(issue => issue.code === 'passive_cable_too_long'), false, 'largest generated desk');
});

test('wiring problems on odd imported data are explained without internal type names', async () => {
  const { analyzeProjectWiring } = await import('../src/domain/analysis.js');
  const device = (id, ports) => ({
    id, name: id, type: 'device', shape: 'rect',
    position: { x: 0, y: 0, z: 0.5 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 0.2, y: 0.2, z: 0.2 }, ports,
  });
  const objects = [
    device('主机', [
      { id: 'hdmi-out', name: 'HDMI 输出', type: 'hdmi', direction: 'output' },
      { id: 'usb', name: 'USB-C', type: 'usb_c', direction: 'output' },
      { id: 'odd', name: '奇怪接口', type: 'hdmi', direction: 'sideways' },
      { id: 'power', name: '电源', type: 'ac_input', direction: 'output' },
    ]),
    device('显示器', [
      { id: 'dp-in', name: 'DP 输入', type: 'displayport', direction: 'input' },
      { id: 'hdmi-in', name: 'HDMI 输入', type: 'hdmi', direction: 'input' },
    ]),
  ];
  const connections = [
    { id: 'c1', name: '视频线', fromObjectId: '主机', fromPortId: 'usb', toObjectId: '显示器', toPortId: 'dp-in', cableType: 'usb_c', length: 2 },
    { id: 'c2', name: '另一根', fromObjectId: '主机', fromPortId: 'hdmi-out', toObjectId: '显示器', toPortId: 'hdmi-in', cableType: 'ethernet', length: 2 },
  ];
  const issues = analyzeProjectWiring(objects, connections);
  const codes = issues.map(issue => issue.code);
  for (const code of ['incompatible_port_types', 'cable_type_mismatch', 'invalid_port_direction_definition', 'invalid_power_port_definition']) {
    assert.ok(codes.includes(code), `expected ${code} in ${codes.join(', ')}`);
  }
  for (const issue of issues) {
    assert.doesNotMatch(`${issue.title} ${issue.description}`,
      /\b(ac_input|ac_output|usb_c|displayport|ethernet|hdmi|input|output|bidirectional)\b/, issue.code);
  }
});
