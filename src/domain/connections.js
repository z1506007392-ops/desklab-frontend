import { getPortRecords } from './port-collections.js';

export const CABLE_SERVICE_LOOP_FACTOR = 1.1;
export const CABLE_TYPE_VALUES = ['power', 'hdmi', 'usb_c', 'usb', 'ethernet', 'displayport', 'other'];
export const CABLE_TYPE_NAMES = Object.freeze({
  power: '电源线',
  hdmi: 'HDMI 线',
  usb_c: 'USB-C 线',
  usb: 'USB 线',
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

export function arePortTypesCompatible(fromType, toType) {
  if (fromType === toType) return true;
  if (fromType === 'ac_output' && toType === 'ac_input') return true;
  if (fromType === 'dc_output' && toType === 'dc_input') return true;
  return false;
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

export function inferCableType(fromPort, toPort) {
  if (!fromPort || !toPort) return 'other';
  if (POWER_PORT_TYPES.has(fromPort.type) && POWER_PORT_TYPES.has(toPort.type)) return 'power';
  if (fromPort.type === toPort.type && CABLE_TYPE_VALUES.includes(fromPort.type)) {
    return fromPort.type;
  }
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

export function evaluateConnectionLength(connection, objects, knownEndpoints = null) {
  const endpoints = knownEndpoints || getConnectionEndpoints(connection, objects);
  const distance = calculatePositionDistance(endpoints?.from, endpoints?.to);
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
    hasRecommendedSlack: recommendedSlack >= -0.001,
  };
}
