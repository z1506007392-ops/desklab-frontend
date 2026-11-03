import { routeCable } from './cable-route.js';
import { getPortRecords } from './port-collections.js';

export const CABLE_SERVICE_LOOP_FACTOR = 1.1;
// A shop length a couple of centimetres under the 10% loop is still enough
// to plug in. 2 cm is smaller than the gap between standard lengths, so a
// cable that is actually short of the next size (5.2 m against a 5.5 m
// recommendation) still warns.
export const CABLE_SLACK_TOLERANCE_METRES = 0.02;
export const CABLE_TYPE_VALUES = ['power', 'hdmi', 'usb_c', 'usb', 'audio', 'ethernet', 'displayport', 'other'];
export const CABLE_TYPE_NAMES = Object.freeze({
  power: '电源线',
  hdmi: 'HDMI 线',
  usb_c: 'USB-C 线',
  usb: 'USB 线',
  audio: '音频线',
  ethernet: '网线',
  displayport: 'DP 线',
  other: '连接线',
});

// Plain names for the stored port types and directions, for any message a
// user can see. Unknown values come from imported data and are shown as is.
export const PORT_TYPE_NAMES = Object.freeze({
  ac_input: '电源输入',
  ac_output: '电源插孔',
  dc_input: 'DC 电源输入',
  dc_output: 'DC 输出',
  hdmi: 'HDMI',
  displayport: 'DP',
  usb_c: 'USB-C',
  usb: 'USB',
  audio: '3.5mm',
  ethernet: '网口',
});

export const PORT_DIRECTION_NAMES = Object.freeze({
  input: '输入',
  output: '输出',
  bidirectional: '双向',
});

export function describePortType(type) {
  return PORT_TYPE_NAMES[type] ?? `其他（${type}）`;
}

export function describePortDirection(direction) {
  return PORT_DIRECTION_NAMES[direction] ?? `未知（${direction}）`;
}

export function describeCableType(type) {
  return CABLE_TYPE_NAMES[type] ?? '连接线';
}

// Lengths cables are commonly sold in, in metres.
export const STANDARD_CABLE_LENGTHS = Object.freeze([0.5, 1, 1.5, 1.8, 2, 3, 5, 10]);

/** Shortest standard store length that covers the required length. */
export function standardCableLength(minimumLength) {
  return STANDARD_CABLE_LENGTHS.find(length => length >= minimumLength - 1e-9)
    ?? Math.ceil(minimumLength);
}

const POWER_PORT_TYPES = new Set(['ac_input', 'ac_output', 'dc_input', 'dc_output']);

export function parsePositiveCableLength(value) {
  const length = Number(value);
  return Number.isFinite(length) && length > 0 ? length : null;
}

export function shouldResetConnectionDraftForSelection(draft, selectedObjectId) {
  return Boolean(draft?.fromObjectId
    && selectedObjectId
    && draft.fromObjectId !== selectedObjectId);
}

export function requiredPowerPortDirection(type) {
  if (type === 'ac_input' || type === 'dc_input') return 'input';
  if (type === 'ac_output' || type === 'dc_output') return 'output';
  return null;
}

export function isPortDirectionConsistent(port) {
  if (!port) return false;
  const requiredDirection = requiredPowerPortDirection(port.type);
  return !requiredDirection || port.direction === requiredDirection;
}

const USB_PORT_TYPES = new Set(['usb', 'usb_c']);
const USB_PERIPHERAL_IDS = new Set(['keyboard', 'mouse']);

export function arePortTypesCompatible(fromType, toType) {
  if (fromType === toType) return true;
  if (fromType === 'ac_output' && toType === 'ac_input') return true;
  if (fromType === 'dc_output' && toType === 'dc_input') return true;
  // A USB-A peripheral can use a computer's USB-C port. Same-type pairs
  // still win in auto-wiring; this only says the two families can meet.
  if (USB_PORT_TYPES.has(fromType) && USB_PORT_TYPES.has(toType)) return true;
  return false;
}

export function isUsbPeripheral(object) {
  return USB_PERIPHERAL_IDS.has(object?.type) || USB_PERIPHERAL_IDS.has(object?.modelId);
}

/** Keyboard and mouse plug into a computer, not into each other. */
export function isPeripheralToPeripheralUsb(fromObject, toObject, fromPort, toPort) {
  return isUsbPeripheral(fromObject)
    && isUsbPeripheral(toObject)
    && USB_PORT_TYPES.has(fromPort?.type)
    && USB_PORT_TYPES.has(toPort?.type);
}

export function arePortsCompatible(fromPort, toPort) {
  if (!fromPort || !toPort) return false;
  if (!isPortDirectionConsistent(fromPort) || !isPortDirectionConsistent(toPort)) return false;
  const sourceDirectionValid = fromPort.direction === 'output' || fromPort.direction === 'bidirectional';
  const targetDirectionValid = toPort.direction === 'input' || toPort.direction === 'bidirectional';
  return sourceDirectionValid
    && targetDirectionValid
    && arePortTypesCompatible(fromPort.type, toPort.type);
}

/**
 * Two ports a cable can join, given in either order (the user may start
 * from the screen or from the computer). A stored connection always runs
 * from the sending end to the receiving end, so this returns
 * { from, to } in that order, each the end that was passed in, or null
 * when the ports cannot be joined either way.
 */
export function orientPortPair(first, second) {
  if (arePortsCompatible(first?.port, second?.port)) return { from: first, to: second };
  if (arePortsCompatible(second?.port, first?.port)) return { from: second, to: first };
  return null;
}

/**
 * After devices moved: their cables that are now short for the route get
 * the length a fresh cable would (the shortest common length covering the
 * route plus 10%). Every other cable is returned unchanged.
 */
export function lengthenCablesFor(connections, objects, objectIds) {
  return connections.map(connection => {
    if (!objectIds.has(connection.fromObjectId) && !objectIds.has(connection.toObjectId)) return connection;
    const status = evaluateConnectionLength(connection, objects);
    if (!status || status.hasRecommendedSlack) return connection;
    return { ...connection, length: standardCableLength(status.recommendedLength) };
  });
}

export function canJoinPorts(firstPort, secondPort) {
  return orientPortPair({ port: firstPort }, { port: secondPort }) !== null;
}

/**
 * Ports that may be joined, including which devices they belong to.
 * Type and direction are not enough: two USB peripherals cannot cable to
 * each other. Kept out of the save-file check so an old project still opens.
 */
export function canJoinDevicePorts(firstObject, firstPort, secondObject, secondPort) {
  const oriented = orientPortPair({ port: firstPort }, { port: secondPort });
  if (!oriented) return false;
  const fromObject = oriented.from.port === firstPort ? firstObject : secondObject;
  const toObject = fromObject === firstObject ? secondObject : firstObject;
  return !isPeripheralToPeripheralUsb(fromObject, toObject, oriented.from.port, oriented.to.port);
}

export function inferCableType(fromPort, toPort) {
  if (!fromPort || !toPort) return 'other';
  if (POWER_PORT_TYPES.has(fromPort.type) && POWER_PORT_TYPES.has(toPort.type)) return 'power';
  if (fromPort.type === toPort.type && CABLE_TYPE_VALUES.includes(fromPort.type)) {
    return fromPort.type;
  }
  // USB-A to USB-C is still a USB cable. Two USB-C ports stay usb_c above.
  if (USB_PORT_TYPES.has(fromPort.type) && USB_PORT_TYPES.has(toPort.type)) return 'usb';
  return 'other';
}

const isFinitePosition = (position) =>
  position && ['x', 'y', 'z'].every(axis => Number.isFinite(position[axis]));

export function calculatePositionDistance(fromPosition, toPosition) {
  if (!isFinitePosition(fromPosition) || !isFinitePosition(toPosition)) return null;
  const dx = toPosition.x - fromPosition.x;
  const dy = toPosition.y - fromPosition.y;
  const dz = toPosition.z - fromPosition.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function getPortWorldPosition(object, portId) {
  if (!isFinitePosition(object?.position)) return null;
  const port = getPortRecords(object).find(candidate => candidate.id === portId);
  const anchor = port?.anchor;
  const hasAnchor = anchor && ['x', 'y', 'z'].every(axis =>
    Number.isFinite(anchor[axis]) && anchor[axis] >= -0.5 && anchor[axis] <= 0.5
  );
  if (!hasAnchor) return { ...object.position };

  const scale = object.scale;
  if (!scale || !['x', 'y', 'z'].every(axis => Number.isFinite(scale[axis]) && scale[axis] > 0)) {
    return { ...object.position };
  }

  const radians = (Number.isFinite(object.rotation?.z) ? object.rotation.z : 0) * Math.PI / 180;
  const localX = anchor.x * scale.x;
  const localY = anchor.y * scale.y;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: object.position.x + localX * cosine - localY * sine,
    y: object.position.y + localX * sine + localY * cosine,
    z: object.position.z + anchor.z * scale.z,
  };
}

export function getConnectionEndpoints(connection, objects, objectById = null) {
  const fromObject = objectById?.get(connection.fromObjectId)
    || objects.find(object => object.id === connection.fromObjectId);
  const toObject = objectById?.get(connection.toObjectId)
    || objects.find(object => object.id === connection.toObjectId);
  if (!fromObject || !toObject) return null;
  const from = getPortWorldPosition(fromObject, connection.fromPortId);
  const to = getPortWorldPosition(toObject, connection.toPortId);
  return from && to ? { from, to } : null;
}

/**
 * The way the cable runs between its two ports (cable-route.js): the points
 * and the length. `objects` should be the whole room, so the desks the
 * devices stand on are known. Null when an end or its position is missing.
 */
export function getConnectionRoute(connection, objects, knownEndpoints = null) {
  const endpoints = knownEndpoints || getConnectionEndpoints(connection, objects);
  if (!isFinitePosition(endpoints?.from) || !isFinitePosition(endpoints?.to)) return null;
  const fromObject = objects.find(object => object.id === connection.fromObjectId);
  const toObject = objects.find(object => object.id === connection.toObjectId);
  return routeCable(endpoints.from, endpoints.to, fromObject, toObject, objects);
}

// `distance` is how far the cable has to run (the route above), not the
// straight line between the plugs.
export function evaluateConnectionLength(connection, objects, knownEndpoints = null) {
  const distance = getConnectionRoute(connection, objects, knownEndpoints)?.length ?? null;
  const cableLength = Number(connection.length);

  if (distance === null || !Number.isFinite(cableLength) || cableLength <= 0) {
    return null;
  }

  const slack = cableLength - distance;
  const recommendedLength = distance * CABLE_SERVICE_LOOP_FACTOR;
  const recommendedSlack = cableLength - recommendedLength;
  return {
    distance,
    cableLength,
    slack,
    sufficient: slack >= -0.001,
    recommendedLength,
    recommendedSlack,
    hasRecommendedSlack: recommendedSlack >= -CABLE_SLACK_TOLERANCE_METRES,
  };
}
