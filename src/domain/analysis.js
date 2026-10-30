import {
  arePortTypesCompatible,
  CABLE_TYPE_VALUES,
  describeCableType,
  describePortDirection,
  describePortType,
  evaluateConnectionLength,
  inferCableType,
  isPortDirectionConsistent,
} from './connections.js';
import { findModelTemplate } from './catalog.js';
import { getPortRecords } from './port-collections.js';
import { getRecordItems } from './record-collections.js';
import { isValidPortAnchor } from './project-validation.js';

const POWER_INPUT_TYPES = new Set(['ac_input', 'dc_input']);
const POWER_OUTPUT_TYPES = new Set(['ac_output', 'dc_output']);
const VALID_CABLE_TYPES = new Set(CABLE_TYPE_VALUES);
const VALID_PORT_DIRECTIONS = new Set(['input', 'output', 'bidirectional']);
const isNonBlankString = value => typeof value === 'string' && value.trim().length > 0;

// Coerce a stored wattage/maxLoad to a safe non-negative number. Imported or
// draft-restored data can carry these as strings (isProjectObject does not
// validate them), which would otherwise corrupt load arithmetic via string
// concatenation or produce misleading comparisons.
export function toPowerValue(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function parsePowerValue(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function getEffectiveCatalogPowerValue(object, property) {
  const override = parsePowerValue(object?.[property]);
  if (override !== null) return override;
  return parsePowerValue(findModelTemplate(object)?.[property]) ?? 0;
}

export function getEffectiveMaxLoad(object) {
  return getEffectiveCatalogPowerValue(object, 'maxLoad');
}

export function getEffectiveWattage(object) {
  return getEffectiveCatalogPowerValue(object, 'wattage');
}

// Fraction of maxLoad at/above which a power hub is flagged as "approaching limit".
export const POWER_WARNING_RATIO = 0.9;

// Classify a device's external power load against its safe maximum, coercing
// both values first. Returns 'overload' (strictly over the limit), 'warning'
// (at or above the warning ratio), or 'ok' (within limits, or no usable limit).
export function classifyPowerLoad(currentLoad, maxLoad) {
  const load = toPowerValue(currentLoad);
  const limit = toPowerValue(maxLoad);
  if (limit <= 0) return 'ok';
  if (load > limit) return 'overload';
  if (load > limit * POWER_WARNING_RATIO) return 'warning';
  return 'ok';
}

const getPortItems = object => Array.isArray(object?.ports) ? object.ports : [];
const getPort = (object, portId) => getPortRecords(object).find(port => port.id === portId);
export const isPowerStrip = (object) =>
  object?.modelId === 'power-strip' || object?.type === 'power_strip';

function getDuplicateIds(items) {
  const seenIds = new Set();
  const duplicateIds = new Set();
  for (const item of items) {
    if (seenIds.has(item.id)) {
      duplicateIds.add(item.id);
    } else {
      seenIds.add(item.id);
    }
  }
  return duplicateIds;
}

const getDuplicatePortIds = object => getDuplicateIds(getPortRecords(object));

function getOccupiedPort(occupiedPorts, objectId, portId) {
  return occupiedPorts.get(objectId)?.get(portId) || null;
}

function occupyPort(occupiedPorts, objectId, portId, connectionId) {
  let objectPorts = occupiedPorts.get(objectId);
  if (!objectPorts) {
    objectPorts = new Map();
    occupiedPorts.set(objectId, objectPorts);
  }
  objectPorts.set(portId, connectionId);
}

function findPowerCycle(edges) {
  const graph = new Map();
  for (const [fromId, toId] of edges) {
    if (!graph.has(fromId)) graph.set(fromId, []);
    graph.get(fromId).push(toId);
  }

  const visiting = new Set();
  const visited = new Set();

  const visit = (node) => {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    for (const next of graph.get(node) || []) {
      if (visit(next)) return true;
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  };

  return [...graph.keys()].some(visit);
}

function appendLengthIssues(issues, connection, objects) {
  const lengthStatus = evaluateConnectionLength(connection, objects);
  if (lengthStatus && !lengthStatus.sufficient) {
    issues.push({
      id: `short-cable:${connection.id}`,
      code: 'short_cable',
      severity: 'warning',
      title: `线材“${connection.name}”可能过短`,
      description: `线长 ${lengthStatus.cableLength.toFixed(2)}m，接口端点估算距离 ${lengthStatus.distance.toFixed(2)}m，差 ${Math.abs(lengthStatus.slack).toFixed(2)}m。`,
      connectionIds: [connection.id],
      objectIds: [connection.fromObjectId, connection.toObjectId],
    });
  } else if (lengthStatus && !lengthStatus.hasRecommendedSlack) {
    issues.push({
      id: `low-cable-slack:${connection.id}`,
      code: 'low_cable_slack',
      severity: 'warning',
      title: `线材“${connection.name}”维护余量较少`,
      description: `线长 ${lengthStatus.cableLength.toFixed(2)}m 可直连，但建议至少 ${lengthStatus.recommendedLength.toFixed(2)}m（含 10% 插拔与绕行余量）。`,
      connectionIds: [connection.id],
      objectIds: [connection.fromObjectId, connection.toObjectId],
    });
  }
}

export function buildPowerGraph(rawObjects, rawConnections) {
  const objects = getRecordItems(rawObjects);
  const connections = getRecordItems(rawConnections);
  const objectById = new Map(objects.map(object => [object.id, object]));
  const duplicateObjectIds = getDuplicateIds(objects);
  const duplicatePortIdsByObject = new Map(
    objects.map(object => [object.id, getDuplicatePortIds(object)])
  );
  const powerEdges = [];
  const occupiedPorts = new Map();
  const seenConnectionIds = new Set();

  for (const connection of connections) {
    if (!isNonBlankString(connection.id)) continue;
    if (seenConnectionIds.has(connection.id)) continue;
    seenConnectionIds.add(connection.id);
    if (!isNonBlankString(connection.name)) continue;
    if (!Number.isFinite(connection.length) || connection.length <= 0) continue;
    if (!isNonBlankString(connection.fromObjectId)) continue;
    if (!isNonBlankString(connection.toObjectId)) continue;
    if (!isNonBlankString(connection.fromPortId)) continue;
    if (!isNonBlankString(connection.toPortId)) continue;
    if (duplicateObjectIds.has(connection.fromObjectId)) continue;
    if (duplicateObjectIds.has(connection.toObjectId)) continue;

    const fromObj = objectById.get(connection.fromObjectId);
    const toObj = objectById.get(connection.toObjectId);
    if (!fromObj || !toObj) continue;
    if (duplicatePortIdsByObject.get(fromObj.id)?.has(connection.fromPortId)) continue;
    if (duplicatePortIdsByObject.get(toObj.id)?.has(connection.toPortId)) continue;
    const fromPort = getPort(fromObj, connection.fromPortId);
    const toPort = getPort(toObj, connection.toPortId);
    const sourceDirectionValid = fromPort?.direction === 'output' || fromPort?.direction === 'bidirectional';
    const targetDirectionValid = toPort?.direction === 'input' || toPort?.direction === 'bidirectional';
    const isValidPowerConnection = fromPort
      && toPort
      && POWER_OUTPUT_TYPES.has(fromPort.type)
      && POWER_INPUT_TYPES.has(toPort.type)
      && isPortDirectionConsistent(fromPort)
      && isPortDirectionConsistent(toPort)
      && sourceDirectionValid
      && targetDirectionValid
      && arePortTypesCompatible(fromPort.type, toPort.type)
      && connection.cableType === inferCableType(fromPort, toPort);
    if (!isValidPowerConnection) continue;

    const endpointRefs = [
      [connection.fromObjectId, connection.fromPortId],
      [connection.toObjectId, connection.toPortId],
    ];
    if (endpointRefs.some(([objectId, portId]) => getOccupiedPort(occupiedPorts, objectId, portId))) {
      continue;
    }
    endpointRefs.forEach(([objectId, portId]) => {
      occupyPort(occupiedPorts, objectId, portId, connection.id);
    });
    powerEdges.push([connection.fromObjectId, connection.toObjectId]);
  }

  const childrenBySource = new Map();
  for (const [fromId, toId] of powerEdges) {
    let children = childrenBySource.get(fromId);
    if (!children) {
      children = [];
      childrenBySource.set(fromId, children);
    }
    children.push(toId);
  }

  return {
    objectById,
    childrenBySource,
    hasCycle: findPowerCycle(powerEdges),
  };
}

export function analyzeProjectWiring(rawObjects, rawConnections) {
  const objects = getRecordItems(rawObjects);
  const connections = getRecordItems(rawConnections);
  const issues = [];
  const objectById = new Map(objects.map(object => [object.id, object]));
  const duplicateObjectIds = getDuplicateIds(objects);
  const duplicatePortIdsByObject = new Map(
    objects.map(object => [object.id, getDuplicatePortIds(object)])
  );
  const occupiedPorts = new Map();
  const powerEdges = [];
  const seenConnectionIds = new Set();

  for (const connection of connections) {
    if (!isNonBlankString(connection.id)) {
      issues.push({
        id: `invalid-connection-id:${String(connection.id)}`,
        code: 'invalid_connection_id',
        severity: 'error',
        title: '连接 ID 不能为空',
        description: '每条连接必须使用非空 ID。请删除该连接后重新创建。',
        connectionIds: [connection.id],
        invalidConnectionIds: [connection.id],
        objectIds: [connection.fromObjectId, connection.toObjectId],
      });
      continue;
    }
    if (seenConnectionIds.has(connection.id)) {
      issues.push({
        id: `duplicate-connection-id:${connection.id}`,
        code: 'duplicate_connection_id',
        severity: 'error',
        title: `连接 ID “${connection.id}”重复`,
        description: '每条连接必须使用唯一 ID。请删除或重新创建重复连接。',
        connectionIds: [connection.id],
        invalidConnectionIds: [connection.id],
        objectIds: [connection.fromObjectId, connection.toObjectId],
      });
      continue;
    }
    seenConnectionIds.add(connection.id);

    if (!isNonBlankString(connection.name)) {
      issues.push({
        id: `invalid-connection-name:${connection.id}`,
        code: 'invalid_connection_name',
        severity: 'error',
        title: `连接“${connection.id}”的名称不能为空`,
        description: '连接名称必须是非空字符串。请删除该连接后重新创建。',
        connectionIds: [connection.id],
        invalidConnectionIds: [connection.id],
        objectIds: [connection.fromObjectId, connection.toObjectId],
      });
      continue;
    }

    if (!isNonBlankString(connection.fromObjectId)
      || !isNonBlankString(connection.toObjectId)) {
      issues.push({
        id: `invalid-connection-object-id:${connection.id}`,
        code: 'invalid_connection_object_id',
        severity: 'error',
        title: `连接“${connection.name}”的设备 ID 无效`,
        description: '连接起点和终点必须使用非空设备 ID。请删除该连接后重新创建。',
        connectionIds: [connection.id],
        invalidConnectionIds: [connection.id],
        objectIds: [connection.fromObjectId, connection.toObjectId],
      });
      continue;
    }

    const fromObject = objectById.get(connection.fromObjectId);
    const toObject = objectById.get(connection.toObjectId);
    const existingObjectIds = [connection.fromObjectId, connection.toObjectId]
      .filter(objectId => objectById.has(objectId));
    if (!fromObject || !toObject) {
      issues.push({
        id: `dangling-object:${connection.id}`,
        code: 'dangling_connection_object',
        severity: 'error',
        title: `连接“${connection.name}”引用了不存在的设备`,
        description: '连接端点设备已被删除或导入数据不完整。请删除该连接后重新创建。',
        connectionIds: [connection.id],
        invalidConnectionIds: [connection.id],
        objectIds: existingObjectIds,
      });
      continue;
    }

    if (duplicateObjectIds.has(connection.fromObjectId)
      || duplicateObjectIds.has(connection.toObjectId)) {
      issues.push({
        id: `ambiguous-object:${connection.id}`,
        code: 'ambiguous_connection_object',
        severity: 'error',
        title: `连接“${connection.name}”引用了重复设备 ID`,
        description: '连接端点设备无法唯一解析。请修复设备 ID 并重新创建连接。',
        connectionIds: [connection.id],
        invalidConnectionIds: [connection.id],
        objectIds: [connection.fromObjectId, connection.toObjectId],
      });
      continue;
    }

    if (connection.fromObjectId === connection.toObjectId) {
      issues.push({
        id: `self-connection:${connection.id}`,
        code: 'self_connection',
        severity: 'error',
        title: `连接“${connection.name}”不能连接同一设备`,
        description: '连接的起点和终点必须是不同设备。请删除该连接后重新创建。',
        connectionIds: [connection.id],
        invalidConnectionIds: [connection.id],
        objectIds: [connection.fromObjectId],
      });
      continue;
    }

    if (!Number.isFinite(connection.length) || connection.length <= 0) {
      issues.push({
        id: `invalid-connection-length:${connection.id}`,
        code: 'invalid_connection_length',
        severity: 'error',
        title: `连接“${connection.name}”的线长无效`,
        description: '线材长度必须是大于 0 的有限数值。请删除该连接后重新创建。',
        connectionIds: [connection.id],
        invalidConnectionIds: [connection.id],
        objectIds: [connection.fromObjectId, connection.toObjectId],
      });
      continue;
    }

    if (!VALID_CABLE_TYPES.has(connection.cableType)) {
      issues.push({
        id: `invalid-connection-cable-type:${connection.id}`,
        code: 'invalid_connection_cable_type',
        severity: 'error',
        title: `连接“${connection.name}”的线材类型无效`,
        description: '线材类型不在支持范围内。请删除该连接后重新创建。',
        connectionIds: [connection.id],
        invalidConnectionIds: [connection.id],
        objectIds: [connection.fromObjectId, connection.toObjectId],
      });
      continue;
    }

    const hasFromPort = connection.fromPortId !== undefined && connection.fromPortId !== null;
    const hasToPort = connection.toPortId !== undefined && connection.toPortId !== null;
    if (!hasFromPort && !hasToPort) {
      appendLengthIssues(issues, connection, objects);
      issues.push({
        id: `legacy-connection:${connection.id}`,
        code: 'legacy_connection',
        severity: 'info',
        title: `连接“${connection.name}”未绑定具体端口`,
        description: '该连接仍可显示和保存，但无法进行完整的端口方向与占用检查。',
        connectionIds: [connection.id],
        objectIds: [connection.fromObjectId, connection.toObjectId],
      });
      continue;
    }

    if (hasFromPort !== hasToPort) {
      issues.push({
        id: `partial-port-binding:${connection.id}`,
        code: 'partial_port_binding',
        severity: 'error',
        title: `连接“${connection.name}”只绑定了一端端口`,
        description: '端口级连接必须同时指定起点和终点端口。请删除该连接后重新创建。',
        connectionIds: [connection.id],
        invalidConnectionIds: [connection.id],
        objectIds: [connection.fromObjectId, connection.toObjectId],
      });
      continue;
    }

    if (!isNonBlankString(connection.fromPortId)
      || !isNonBlankString(connection.toPortId)) {
      issues.push({
        id: `invalid-connection-port-id:${connection.id}`,
        code: 'invalid_connection_port_id',
        severity: 'error',
        title: `连接“${connection.name}”的端口 ID 无效`,
        description: '端口级连接的起点和终点必须使用非空端口 ID。请删除该连接后重新创建。',
        connectionIds: [connection.id],
        invalidConnectionIds: [connection.id],
        objectIds: [connection.fromObjectId, connection.toObjectId],
      });
      continue;
    }

    const hasAmbiguousPort = duplicatePortIdsByObject
      .get(fromObject.id)?.has(connection.fromPortId)
      || duplicatePortIdsByObject.get(toObject.id)?.has(connection.toPortId);
    if (hasAmbiguousPort) {
      issues.push({
        id: `ambiguous-port:${connection.id}`,
        code: 'ambiguous_connection_port',
        severity: 'error',
        title: `连接“${connection.name}”引用了重复端口 ID`,
        description: '连接端点无法唯一解析。请修复设备端口定义并重新创建连接。',
        connectionIds: [connection.id],
        invalidConnectionIds: [connection.id],
        objectIds: [connection.fromObjectId, connection.toObjectId],
      });
      continue;
    }

    const fromPort = getPort(fromObject, connection.fromPortId);
    const toPort = getPort(toObject, connection.toPortId);
    if (!fromPort || !toPort) {
      issues.push({
        id: `missing-port:${connection.id}`,
        code: 'missing_connection_port',
        severity: 'error',
        title: `连接“${connection.name}”引用了不存在的端口`,
        description: '设备型号或端口定义可能已更新。请删除该连接后重新选择端口。',
        connectionIds: [connection.id],
        invalidConnectionIds: [connection.id],
        objectIds: [connection.fromObjectId, connection.toObjectId],
      });
      continue;
    }

    if (!isNonBlankString(fromPort.type) || !isNonBlankString(toPort.type)) {
      issues.push({
        id: `invalid-connection-port-type:${connection.id}`,
        code: 'invalid_connection_port_type',
        severity: 'error',
        title: `连接“${connection.name}”使用了无效端口类型`,
        description: '连接端点必须使用非空端口类型。请修复设备端口定义并重新创建连接。',
        connectionIds: [connection.id],
        invalidConnectionIds: [connection.id],
        objectIds: [connection.fromObjectId, connection.toObjectId],
      });
      continue;
    }

    const sourceDirectionValid = fromPort.direction === 'output' || fromPort.direction === 'bidirectional';
    const targetDirectionValid = toPort.direction === 'input' || toPort.direction === 'bidirectional';
    if (!isPortDirectionConsistent(fromPort) || !isPortDirectionConsistent(toPort)) {
      issues.push({
        id: `power-port-direction:${connection.id}`,
        code: 'invalid_power_port_direction',
        severity: 'error',
        title: `连接“${connection.name}”使用了方向定义错误的电源端口`,
        description: 'AC/DC 输入端口只能作为输入，AC/DC 输出端口只能作为输出。',
        connectionIds: [connection.id],
        invalidConnectionIds: [connection.id],
        objectIds: [connection.fromObjectId, connection.toObjectId],
      });
      continue;
    }
    if (!sourceDirectionValid || !targetDirectionValid) {
      issues.push({
        id: `invalid-direction:${connection.id}`,
        code: 'invalid_port_direction',
        severity: 'error',
        title: `连接“${connection.name}”的端口方向错误`,
        description: '起点必须是输出或双向端口，终点必须是输入或双向端口。',
        connectionIds: [connection.id],
        invalidConnectionIds: [connection.id],
        objectIds: [connection.fromObjectId, connection.toObjectId],
      });
      continue;
    }

    if (!arePortTypesCompatible(fromPort.type, toPort.type)) {
      issues.push({
        id: `incompatible-ports:${connection.id}`,
        code: 'incompatible_port_types',
        severity: 'error',
        title: `连接“${connection.name}”的端口类型不兼容`,
        description: `${describePortType(fromPort.type)} 不能连接到 ${describePortType(toPort.type)}。`,
        connectionIds: [connection.id],
        invalidConnectionIds: [connection.id],
        objectIds: [connection.fromObjectId, connection.toObjectId],
      });
      continue;
    }

    const expectedCableType = inferCableType(fromPort, toPort);
    if (connection.cableType !== expectedCableType) {
      issues.push({
        id: `cable-type:${connection.id}`,
        code: 'cable_type_mismatch',
        severity: 'error',
        title: `连接“${connection.name}”的线材类型不匹配`,
        description: `当前记录为${describeCableType(connection.cableType)}，这两个接口需要${describeCableType(expectedCableType)}。`,
        connectionIds: [connection.id],
        invalidConnectionIds: [connection.id],
        objectIds: [connection.fromObjectId, connection.toObjectId],
      });
      continue;
    }

    const endpointRefs = [
      [connection.fromObjectId, connection.fromPortId],
      [connection.toObjectId, connection.toPortId],
    ];
    const conflictingConnectionId = endpointRefs
      .map(([objectId, portId]) => getOccupiedPort(occupiedPorts, objectId, portId))
      .find(Boolean);
    if (conflictingConnectionId) {
      issues.push({
        id: `port-overbooked:${connection.id}`,
        code: 'port_overbooked',
        severity: 'error',
        title: `连接“${connection.name}”重复占用了端口`,
        description: `同一物理端口已被连接“${conflictingConnectionId}”占用。`,
        connectionIds: [conflictingConnectionId, connection.id],
        invalidConnectionIds: [connection.id],
        objectIds: [connection.fromObjectId, connection.toObjectId],
      });
      continue;
    }
    endpointRefs.forEach(([objectId, portId]) => {
      occupyPort(occupiedPorts, objectId, portId, connection.id);
    });
    appendLengthIssues(issues, connection, objects);

    const isPowerConnection = POWER_OUTPUT_TYPES.has(fromPort?.type) && POWER_INPUT_TYPES.has(toPort?.type);
    if (!isPowerConnection) continue;

    powerEdges.push([connection.fromObjectId, connection.toObjectId]);
    if (isPowerStrip(fromObject) && isPowerStrip(toObject)) {
      issues.push({
        id: `power-strip-chain:${connection.id}`,
        code: 'power_strip_chain',
        severity: 'error',
        title: '检测到插排串联',
        description: `${fromObject.name} 连接到 ${toObject.name}。插排串联可能导致过载或接触点发热，建议把下游插排直接接到墙壁插座。`,
        connectionIds: [connection.id],
        objectIds: [fromObject.id, toObject.id],
      });
    }
  }

  if (findPowerCycle(powerEdges)) {
    issues.push({
      id: 'power-cycle',
      code: 'power_cycle',
      severity: 'error',
      title: '检测到电源连接环路',
      description: '电源设备之间形成了循环连接。请断开环路并确认每条电源线的实际方向。',
      connectionIds: [],
      objectIds: [],
    });
  }

  objects.forEach((object, index) => {
    if (isNonBlankString(object.id)) return;
    issues.push({
      id: `invalid-object-id:${index}`,
      code: 'invalid_object_id_definition',
      severity: 'error',
      title: '设备 ID 不能为空',
      description: '每台设备必须使用非空 ID。请修复导入或草稿数据。',
      connectionIds: [],
      objectIds: [object.id],
    });
  });

  for (const duplicateObjectId of duplicateObjectIds) {
    issues.push({
      id: `duplicate-object-id:${duplicateObjectId}`,
      code: 'duplicate_object_id_definition',
      severity: 'error',
      title: `设备 ID “${duplicateObjectId}”重复`,
      description: '每台设备必须使用唯一 ID。请修复导入或草稿数据。',
      connectionIds: [],
      objectIds: [duplicateObjectId],
    });
  }

  for (const object of objects) {
    if (object.ports !== undefined && object.ports !== null && !Array.isArray(object.ports)) {
      issues.push({
        id: `invalid-port-collection:${object.id}`,
        code: 'invalid_port_collection_definition',
        severity: 'error',
        title: '设备端口集合无效',
        description: '设备端口必须使用数组。请修复导入或草稿数据。',
        connectionIds: [],
        objectIds: [object.id],
      });
    }
    for (const duplicatePortId of duplicatePortIdsByObject.get(object.id) || []) {
      issues.push({
        id: `duplicate-port-id:${object.id}:${duplicatePortId}`,
        code: 'duplicate_port_id_definition',
        severity: 'error',
        title: `${object.name} 的端口 ID 重复`,
        description: `端口 ID “${duplicatePortId}”在同一设备内必须唯一。`,
        connectionIds: [],
        objectIds: [object.id],
      });
    }
    for (const [portIndex, port] of getPortItems(object).entries()) {
      if (port === null || typeof port !== 'object' || Array.isArray(port) || !isNonBlankString(port.id)) {
        issues.push({
          id: `invalid-port-id:${object.id}:${portIndex}`,
          code: 'invalid_port_id_definition',
          severity: 'error',
          title: `${object.name} 的端口 ID 不能为空`,
          description: '每个端口必须使用非空 ID。请修复设备端口定义。',
          connectionIds: [],
          objectIds: [object.id],
        });
        continue;
      }
      if (!isNonBlankString(port.name)) {
        issues.push({
          id: `invalid-port-name:${object.id}:${port.id}`,
          code: 'invalid_port_name_definition',
          severity: 'error',
          title: `${object.name} 的端口名称不能为空`,
          description: `端口 ID “${port.id}”必须使用非空名称。请修复设备端口定义。`,
          connectionIds: [],
          objectIds: [object.id],
        });
        continue;
      }
      if (!isNonBlankString(port.type)) {
        issues.push({
          id: `invalid-port-type:${object.id}:${port.id}`,
          code: 'invalid_port_type_definition',
          severity: 'error',
          title: `${object.name} 的端口类型不能为空`,
          description: `端口“${port.name}”必须使用非空类型。请修复设备端口定义。`,
          connectionIds: [],
          objectIds: [object.id],
        });
        continue;
      }
      if (!VALID_PORT_DIRECTIONS.has(port.direction)) {
        issues.push({
          id: `invalid-port-direction:${object.id}:${port.id}`,
          code: 'invalid_port_direction_definition',
          severity: 'error',
          title: `${object.name} 的端口方向无效`,
          description: `端口“${port.name}”的方向只能是输入、输出或双向。`,
          connectionIds: [],
          objectIds: [object.id],
        });
        continue;
      }
      if (!isValidPortAnchor(port.anchor)) {
        issues.push({
          id: `invalid-port-anchor:${object.id}:${port.id}`,
          code: 'invalid_port_anchor_definition',
          severity: 'error',
          title: `${object.name} 的端口锚点无效`,
          description: `端口“${port.name}”的锚点必须包含 x、y、z 三个介于 -0.5 和 0.5 之间的有限数值。`,
          connectionIds: [],
          objectIds: [object.id],
        });
      }
      if (!isPortDirectionConsistent(port)) {
        issues.push({
          id: `invalid-power-port:${object.id}:${port.id}`,
          code: 'invalid_power_port_definition',
          severity: 'error',
          title: `${object.name} 的电源端口方向定义错误`,
          description: `端口“${port.name}”是${describePortType(port.type)}，方向却记录为${describePortDirection(port.direction)}。`,
          connectionIds: [],
          objectIds: [object.id],
        });
      }
      if (!POWER_INPUT_TYPES.has(port.type)) continue;
      if (getOccupiedPort(occupiedPorts, object.id, port.id)) continue;
      // In reality the user's devices are plugged in; a missing line only means
      // the model is incomplete, so this is a note rather than a problem.
      issues.push({
        id: `unpowered:${object.id}:${port.id}`,
        code: 'unpowered_input',
        severity: 'info',
        title: `${object.name} 未画电源线`,
        description: `端口“${port.name}”还没有画电源线，系统按已通电处理。画上电源线后可以计算插排负载。`,
        connectionIds: [],
        objectIds: [object.id],
      });
    }
  }

  // --- 4. 电源功耗负载与过载分析 ---
  const powerGraph = {
    objectById,
    childrenBySource: new Map(),
    hasCycle: findPowerCycle(powerEdges),
  };
  for (const [fromId, toId] of powerEdges) {
    let children = powerGraph.childrenBySource.get(fromId);
    if (!children) {
      children = [];
      powerGraph.childrenBySource.set(fromId, children);
    }
    children.push(toId);
  }

  for (const object of objects) {
    const maxLoad = getEffectiveMaxLoad(object);
    if (maxLoad > 0) {
      const currentLoad = computeDevicePowerLoad(object.id, objects, connections, powerGraph);
      const loadStatus = classifyPowerLoad(currentLoad, maxLoad);
      if (loadStatus === 'overload') {
        issues.push({
          id: `power-overload:${object.id}`,
          code: 'power_overload',
          severity: 'error',
          title: `设备”${object.name}”电源负载超标`,
          description: `当前外接总负载为 ${currentLoad}W，已超出其安全承载功率 ${maxLoad}W。请减少接在该设备上的电器或改接其他插排。`,
          connectionIds: [],
          objectIds: [object.id],
        });
      } else if (loadStatus === 'warning') {
        issues.push({
          id: `power-warning:${object.id}`,
          code: 'power_warning',
          severity: 'warning',
          title: `设备”${object.name}”电源负载接近上限`,
          description: `当前外接总负载为 ${currentLoad}W，已达到其安全承载功率 ${maxLoad}W 的 90% 以上。请注意用电安全。`,
          connectionIds: [],
          objectIds: [object.id],
        });
      }
    }
  }

  const order = { error: 0, warning: 1, info: 2 };
  return issues.sort((a, b) => order[a.severity] - order[b.severity]);
}

export function summarizeWiringIssues(issues) {
  return issues.reduce((summary, issue) => {
    summary[issue.severity] += 1;
    return summary;
  }, { error: 0, warning: 0, info: 0 });
}

export function getInvalidConnectionIds(issues) {
  return [...new Set(issues.flatMap(issue => issue.invalidConnectionIds || []))];
}

export function computeDevicePowerLoad(deviceId, objects, connections, existingPowerGraph = null) {
  const graph = existingPowerGraph || buildPowerGraph(objects, connections);
  const { objectById, childrenBySource } = graph;

  const loadCache = new Map();
  const activeObjectIds = new Set();
  function getLoad(id) {
    if (loadCache.has(id)) return loadCache.get(id);
    if (activeObjectIds.has(id)) return 0;
    activeObjectIds.add(id);
    let sum = 0;
    const children = childrenBySource.get(id) || [];
    for (const childId of children) {
      if (activeObjectIds.has(childId)) continue;
      const childObj = objectById.get(childId);
      if (childObj) {
        const childSelfWattage = getEffectiveWattage(childObj);
        sum += getLoad(childId) + childSelfWattage;
      }
    }
    activeObjectIds.delete(id);
    loadCache.set(id, sum);
    return sum;
  }

  return getLoad(deviceId);
}
