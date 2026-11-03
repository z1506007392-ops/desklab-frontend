import test from 'node:test';
import assert from 'node:assert/strict';

import {
  arePortsCompatible,
  arePortTypesCompatible,
  calculatePositionDistance,
  canJoinDevicePorts,
  canJoinPorts,
  evaluateConnectionLength,
  getConnectionEndpoints,
  getPortWorldPosition,
  inferCableType,
  isPortDirectionConsistent,
  orientPortPair,
  parsePositiveCableLength,
  requiredPowerPortDirection,
  shouldResetConnectionDraftForSelection,
} from '../src/domain/connections.js';
import { toThreePosition, toThreeZRotation } from '../src/domain/coordinates.js';

test('infers the formal cable type from both endpoint ports', () => {
  assert.equal(inferCableType({ type: 'hdmi' }, { type: 'hdmi' }), 'hdmi');
  assert.equal(inferCableType({ type: 'usb_c' }, { type: 'usb_c' }), 'usb_c');
  assert.equal(inferCableType({ type: 'ac_output' }, { type: 'ac_input' }), 'power');
  assert.equal(inferCableType({ type: 'dc_output' }, { type: 'dc_input' }), 'power');
  assert.equal(inferCableType({ type: 'custom' }, { type: 'custom' }), 'other');
  assert.equal(inferCableType({ type: 'usb_c' }, { type: 'usb' }), 'usb');
  assert.equal(inferCableType({ type: 'usb' }, { type: 'usb_c' }), 'usb');
});

test('checks direction and type compatibility together', () => {
  assert.equal(
    arePortsCompatible(
      { type: 'hdmi', direction: 'output' },
      { type: 'hdmi', direction: 'input' }
    ),
    true
  );
  assert.equal(
    arePortsCompatible(
      { type: 'hdmi', direction: 'input' },
      { type: 'hdmi', direction: 'input' }
    ),
    false
  );
  assert.equal(
    arePortsCompatible(
      { type: 'hdmi', direction: 'output' },
      { type: 'ethernet', direction: 'input' }
    ),
    false
  );
});

test('power port type and direction cannot contradict each other', () => {
  assert.equal(requiredPowerPortDirection('ac_input'), 'input');
  assert.equal(requiredPowerPortDirection('dc_output'), 'output');
  assert.equal(requiredPowerPortDirection('hdmi'), null);
  assert.equal(isPortDirectionConsistent({ type: 'ac_input', direction: 'input' }), true);
  assert.equal(isPortDirectionConsistent({ type: 'ac_input', direction: 'output' }), false);
  assert.equal(arePortTypesCompatible('ac_input', 'ac_output'), false);
  assert.equal(arePortTypesCompatible('ac_output', 'ac_input'), true);
  assert.equal(arePortTypesCompatible('usb', 'usb_c'), true);
  assert.equal(arePortTypesCompatible('usb_c', 'usb'), true);
  assert.equal(arePortTypesCompatible('usb_c', 'hdmi'), false);
  assert.equal(
    arePortsCompatible(
      { type: 'ac_input', direction: 'output' },
      { type: 'ac_output', direction: 'input' }
    ),
    false
  );
});

test('calculates 3D distance in business XYZ coordinates', () => {
  assert.equal(
    calculatePositionDistance(
      { x: 0, y: 0, z: 0 },
      { x: 3, y: 4, z: 12 }
    ),
    13
  );
});

test('reports cable slack and sufficiency', () => {
  const objects = [
    { id: 'a', position: { x: 0, y: 0, z: 0 } },
    { id: 'b', position: { x: 0, y: 3, z: 4 } },
  ];

  assert.deepEqual(
    evaluateConnectionLength({ fromObjectId: 'a', toObjectId: 'b', length: 6 }, objects),
    {
      distance: 5,
      cableLength: 6,
      slack: 1,
      sufficient: true,
      recommendedLength: 5.5,
      recommendedSlack: 0.5,
      hasRecommendedSlack: true,
    }
  );
  assert.equal(
    evaluateConnectionLength({ fromObjectId: 'a', toObjectId: 'b', length: 4.5 }, objects)?.sufficient,
    false
  );
  assert.equal(evaluateConnectionLength({ fromObjectId: 'a', toObjectId: 'b', length: 5.2 }, objects)?.hasRecommendedSlack, false);
  // 1.5 cm under the 10% loop is within the 2 cm tolerance; 3 cm is not.
  assert.equal(evaluateConnectionLength({ fromObjectId: 'a', toObjectId: 'b', length: 5.485 }, objects)?.hasRecommendedSlack, true);
  assert.equal(evaluateConnectionLength({ fromObjectId: 'a', toObjectId: 'b', length: 5.47 }, objects)?.hasRecommendedSlack, false);

  // Applying the recommended length must itself satisfy both slack checks, so the
  // "increase cable length" suggestion always resolves the warning it raised.
  const recommended = evaluateConnectionLength({ fromObjectId: 'a', toObjectId: 'b', length: 5.2 }, objects).recommendedLength;
  const applied = evaluateConnectionLength({ fromObjectId: 'a', toObjectId: 'b', length: recommended }, objects);
  assert.equal(applied.sufficient, true);
  assert.equal(applied.hasRecommendedSlack, true);
});

test('returns null for missing endpoints or invalid lengths', () => {
  const objects = [{ id: 'a', position: { x: 0, y: 0, z: 0 } }];
  assert.equal(evaluateConnectionLength({ fromObjectId: 'a', toObjectId: 'missing', length: 1 }, objects), null);
  assert.equal(evaluateConnectionLength({ fromObjectId: 'a', toObjectId: 'a', length: 0 }, objects), null);
});

test('accepts only finite positive cable lengths from editor input', () => {
  assert.equal(parsePositiveCableLength('2.5'), 2.5);
  assert.equal(parsePositiveCableLength('1e309'), null);
  assert.equal(parsePositiveCableLength(Infinity), null);
  assert.equal(parsePositiveCableLength(0), null);
  assert.equal(parsePositiveCableLength(-1), null);
});

test('resets an in-progress connection draft when the selected source device changes', () => {
  assert.equal(
    shouldResetConnectionDraftForSelection({ fromObjectId: 'device-a', fromPortId: 'out' }, 'device-b'),
    true
  );
  assert.equal(
    shouldResetConnectionDraftForSelection({ fromObjectId: 'device-a', fromPortId: 'out' }, 'device-a'),
    false
  );
  assert.equal(
    shouldResetConnectionDraftForSelection({ fromPortId: 'legacy-draft-without-source' }, 'device-b'),
    false
  );
});

test('transforms normalized local port anchors with scale and Z rotation', () => {
  const device = {
    id: 'device',
    position: { x: 1, y: 2, z: 3 },
    rotation: { x: 0, y: 0, z: 90 },
    scale: { x: 2, y: 4, z: 6 },
    ports: [{
      id: 'port',
      anchor: { x: 0.5, y: 0, z: 0.5 },
    }],
  };

  const position = getPortWorldPosition(device, 'port');
  assert.ok(Math.abs(position.x - 1) < 1e-10);
  assert.ok(Math.abs(position.y - 3) < 1e-10);
  assert.equal(position.z, 6);
});

test('rendered marker rotation matches the business-space port endpoint', () => {
  const device = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { z: 90 },
    scale: { x: 2, y: 1, z: 1 },
    ports: [{ id: 'right', anchor: { x: 0.5, y: 0, z: 0 } }],
  };
  const businessEndpoint = getPortWorldPosition(device, 'right');
  assert.deepEqual(toThreePosition(businessEndpoint).map(value => Math.round(value)), [0, 0, 1]);

  const [, threeYRotation] = toThreeZRotation(device.rotation.z);
  const localX = device.ports[0].anchor.x * device.scale.x;
  const renderedMarker = [
    localX * Math.cos(threeYRotation),
    0,
    -localX * Math.sin(threeYRotation),
  ];
  assert.deepEqual(renderedMarker.map(value => Math.round(value)), [0, 0, 1]);
});

test('uses port anchors for connection endpoints and cable distance', () => {
  const objects = [
    { id: 'a', position: { x: 0, y: 0, z: 0 }, rotation: { z: 0 }, scale: { x: 2, y: 1, z: 1 }, ports: [{ id: 'out', anchor: { x: 0.5, y: 0, z: 0 } }] },
    { id: 'b', position: { x: 5, y: 0, z: 0 }, rotation: { z: 0 }, scale: { x: 2, y: 1, z: 1 }, ports: [{ id: 'in', anchor: { x: -0.5, y: 0, z: 0 } }] },
  ];
  const connection = { fromObjectId: 'a', fromPortId: 'out', toObjectId: 'b', toPortId: 'in', length: 3 };
  assert.deepEqual(getConnectionEndpoints(connection, objects), {
    from: { x: 1, y: 0, z: 0 },
    to: { x: 4, y: 0, z: 0 },
  });
  assert.equal(evaluateConnectionLength(connection, objects)?.distance, 3);
  const objectById = new Map(objects.map(object => [object.id, object]));
  const indexedEndpoints = getConnectionEndpoints(connection, objects, objectById);
  assert.deepEqual(indexedEndpoints, {
    from: { x: 1, y: 0, z: 0 },
    to: { x: 4, y: 0, z: 0 },
  });
  assert.equal(evaluateConnectionLength(connection, objects, indexedEndpoints)?.distance, 3);
});

test('port types, directions, and cable types have plain names for messages', async () => {
  const { describePortType, describePortDirection, describeCableType } = await import('../src/domain/connections.js');
  assert.equal(describePortType('ac_input'), '电源输入');
  assert.equal(describePortType('usb_c'), 'USB-C');
  assert.equal(describePortType('thunderbolt'), '其他（thunderbolt）');
  assert.equal(describePortDirection('bidirectional'), '双向');
  assert.equal(describePortDirection('sideways'), '未知（sideways）');
  assert.equal(describeCableType('hdmi'), 'HDMI 线');
  assert.equal(describeCableType('mystery'), '连接线');
});

test('a cable can be started from either end and is stored sending end first', () => {
  const pcOut = { id: 'hdmi-out', type: 'hdmi', direction: 'output' };
  const screenIn = { id: 'hdmi-in', type: 'hdmi', direction: 'input' };
  const pc = { objectId: 'pc', port: pcOut };
  const screen = { objectId: 'screen', port: screenIn };
  assert.deepEqual(orientPortPair(screen, pc), { from: pc, to: screen });
  assert.deepEqual(orientPortPair(pc, screen), { from: pc, to: screen });

  const outlet = { id: 'socket', type: 'ac_output', direction: 'output' };
  const plug = { id: 'ac-in', type: 'ac_input', direction: 'input' };
  assert.equal(canJoinPorts(plug, outlet), true);
  assert.equal(canJoinPorts(screenIn, { ...screenIn, id: 'other-in' }), false, 'two inputs');
  assert.equal(canJoinPorts(screenIn, plug), false, 'different kinds');

  const lanA = { id: 'lan', type: 'ethernet', direction: 'bidirectional' };
  const lanB = { id: 'lan-2', type: 'ethernet', direction: 'bidirectional' };
  assert.deepEqual(orientPortPair({ objectId: 'a', port: lanA }, { objectId: 'b', port: lanB }).from.objectId, 'a');
  assert.equal(orientPortPair(null, pc), null);
});

test('a keyboard and a mouse cannot be cabled to each other, other USB devices can', () => {
  const usb = { id: 'usb', type: 'usb', direction: 'bidirectional' };
  const keyboard = { id: 'keyboard', type: 'keyboard', modelId: 'keyboard', name: '键盘' };
  const mouse = { id: 'mouse', type: 'mouse', modelId: 'mouse', name: '鼠标' };
  const laptop = { id: 'laptop', type: 'laptop', modelId: 'laptop-15', name: '15 英寸笔记本' };
  const usbC = { id: 'usb-c', type: 'usb_c', direction: 'bidirectional' };
  assert.equal(canJoinPorts(usb, usb), true, 'the port types themselves still match');
  assert.equal(canJoinDevicePorts(keyboard, usb, mouse, { ...usb, id: 'usb-m' }), false);
  assert.equal(canJoinDevicePorts(mouse, usb, keyboard, { ...usb, id: 'usb-k' }), false);
  assert.equal(canJoinDevicePorts(keyboard, usb, laptop, usbC), true);
  const drive = { id: 'drive', type: 'device', name: '移动硬盘' };
  const dock = { id: 'dock', type: 'device', name: '扩展坞' };
  assert.equal(canJoinDevicePorts(drive, usb, dock, { ...usb, id: 'usb-d' }), true);
});
