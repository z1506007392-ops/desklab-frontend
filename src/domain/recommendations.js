import {
  analyzeProjectLayout,
  pushOntoSupport,
  snapObjectToSupport,
  snapWallOutletToNearestWall,
} from './layout-analysis.js';
import { analyzeProjectWiring, buildPowerGraph, computeDevicePowerLoad, getEffectiveMaxLoad, classifyPowerLoad, isPowerStrip } from './analysis.js';
import { calculatePositionDistance, evaluateConnectionLength, arePortsCompatible, arePortTypesCompatible, isPortDirectionConsistent, inferCableType, standardCableLength, CABLE_TYPE_NAMES } from './connections.js';
import { validateAndConstrainObject } from './geometry.js';
import { findModelTemplate } from './catalog.js';
import { getPortRecords } from './port-collections.js';
import { getRecordItems } from './record-collections.js';
import { updateWithRiders } from './riders.js';

// Round a recommended cable length up to the centimetre so the applied value is
// never shorter than the computed recommendation (which would leave the slack
// warning unresolved).
function ceilLength(value) {
  return Math.ceil(value * 100) / 100;
}

// A cable that auto-wiring adds, or that a free fix lengthens, is sized like
// a template's (scene-builder.js): the shortest common length that covers
// its route between the two ports plus 10%. `fallback` (metres) is used when
// a port has no position to measure from.
function autoCableLength(ends, objects, fallback) {
  const status = evaluateConnectionLength({ ...ends, length: 1 }, objects);
  return standardCableLength(status ? status.recommendedLength : fallback);
}

function hasSameOwnValues(current, next) {
  const currentKeys = Object.keys(current || {});
  const nextKeys = Object.keys(next || {});
  return currentKeys.length === nextKeys.length
    && nextKeys.every(key => current?.[key] === next?.[key]);
}

// Deterministic display order so the UI and tests see a stable list.
const SUGGESTION_ORDER = {
  move_inside_room: 0,
  drop_to_support: 1,
  push_onto_support: 1,
  snap_outlet_to_wall: 2,
  auto_power_device: 3,
  auto_network_device: 4,
  auto_connect_display: 5,
  auto_connect_peripheral: 6,
  extend_cable: 7,
};

function compareSuggestions(first, second) {
  const rank = (SUGGESTION_ORDER[first.code] ?? 99) - (SUGGESTION_ORDER[second.code] ?? 99);
  if (rank !== 0) return rank;
  return first.id < second.id ? -1 : first.id > second.id ? 1 : 0;
}

function getInvalidConnectionIds(wiringIssues) {
  return new Set(wiringIssues.flatMap(issue => issue?.invalidConnectionIds || []));
}

const isNonBlankString = value => typeof value === 'string' && value.trim().length > 0;

function getActionableObjectRecords(objects) {
  const records = getRecordItems(objects);
  const idCounts = new Map();
  for (const object of records) {
    if (!isNonBlankString(object.id)) continue;
    idCounts.set(object.id, (idCounts.get(object.id) || 0) + 1);
  }
  return records.filter(object => idCounts.get(object.id) === 1);
}

function getActionableConnectionRecords(connections) {
  const records = getRecordItems(connections);
  const idCounts = new Map();
  for (const connection of records) {
    if (!isNonBlankString(connection.id)) continue;
    idCounts.set(connection.id, (idCounts.get(connection.id) || 0) + 1);
  }
  return records.filter(connection => idCounts.get(connection.id) === 1);
}

function createConnectionIdAllocator(connections) {
  const reservedIds = new Set(getRecordItems(connections).map(connection => connection.id));
  return baseId => {
    let connectionId = baseId;
    for (let suffix = 2; reservedIds.has(connectionId); suffix += 1) {
      connectionId = `${baseId}-${suffix}`;
    }
    reservedIds.add(connectionId);
    return connectionId;
  };
}

function getActionablePortRecords(object) {
  const ports = getPortRecords(object);
  const idCounts = new Map();
  for (const port of ports) {
    if (!isNonBlankString(port.id)) continue;
    idCounts.set(port.id, (idCounts.get(port.id) || 0) + 1);
  }
  return ports.filter(port => idCounts.get(port.id) === 1);
}

function resolveUnpoweredInput(issue, objectsById) {
  const objectId = issue?.objectIds?.[0];
  if (!isNonBlankString(objectId)) return null;
  const object = objectsById.get(objectId);
  if (!object) return null;
  const port = getActionablePortRecords(object).find(candidate =>
    issue.id === `unpowered:${objectId}:${candidate.id}`
  );
  return port ? { object, port } : null;
}


function hasPowerInput(object) {
  return getPortRecords(object).some(port =>
    ['ac_input', 'dc_input'].includes(port.type)
  );
}

function getPoweredObjectIds(objects, powerGraph) {
  const poweredObjectIds = new Set(objects
    .filter(object => !hasPowerInput(object))
    .map(object => object.id));
  const pending = [...poweredObjectIds];

  while (pending.length > 0) {
    const objectId = pending.pop();
    for (const childId of powerGraph.childrenBySource.get(objectId) || []) {
      if (poweredObjectIds.has(childId)) continue;
      poweredObjectIds.add(childId);
      pending.push(childId);
    }
  }

  return poweredObjectIds;
}

function requiresPowerButIsUnpowered(object, poweredObjectIds) {
  return hasPowerInput(object) && !poweredObjectIds.has(object.id);
}

/**
 * Nearest free, compatible power output for an unpowered input. Powered
 * sources always win. A DC input may fall back to an unpowered source (in
 * practice the device's own power adapter that is not plugged in yet): wiring
 * the device to it is the right first step, and the adapter keeps its own
 * unpowered warning. AC inputs never chain through an unpowered strip.
 */
function findNearestFreePowerSource(object, port, candidates, occupiedPorts, poweredObjectIds) {
  const search = allowUnpowered => {
    let best = null;
    for (const candidate of candidates) {
      if (candidate.id === object.id) continue;
      // Plugging a strip into another strip is the daisy chain the wiring
      // check reports as a problem; a strip only goes into a wall outlet.
      if (isPowerStrip(object) && isPowerStrip(candidate)) continue;
      if (!allowUnpowered && requiresPowerButIsUnpowered(candidate, poweredObjectIds)) continue;
      for (const candidatePort of getActionablePortRecords(candidate)) {
        const hasFromDir = candidatePort.direction === 'output' || candidatePort.direction === 'bidirectional';
        if (!hasFromDir
          || !isPortDirectionConsistent(candidatePort)
          || occupiedPorts.get(candidate.id)?.has(candidatePort.id)
          || !arePortTypesCompatible(candidatePort.type, port.type)) continue;
        const distance = calculatePositionDistance(object.position, candidate.position);
        if (distance !== null && (!best || distance < best.distance)) {
          best = { device: candidate, port: candidatePort, distance };
        }
      }
    }
    return best;
  };
  return search(false) || (port.type === 'dc_input' ? search(true) : null);
}

function isRouter(object) {
  return object.modelId === 'router' || object.type === 'router';
}

/**
 * Compose detected layout/wiring issues into actionable "free improvement"
 * suggestions — changes the user can apply without buying anything. Each
 * suggestion carries a concrete `patch` the caller can apply directly.
 *
 * Returns an array of:
 *   { id, code, title, description, objectIds?, connectionIds?, patch }
 * where patch is { objectId, position, rotation? } for layout fixes or
 * { connectionId, length } or { newConnection } for cabling fixes.
 */
export function buildFreeImprovements(room, rawObjects, rawConnections = [], options = {}) {
  const objects = getRecordItems(rawObjects);
  const actionableObjects = getActionableObjectRecords(objects);
  const connections = getRecordItems(rawConnections);
  const actionableConnections = getActionableConnectionRecords(connections);
  const allocateConnectionId = createConnectionIdAllocator(connections);
  const suggestions = [];
  const objectsById = new Map(actionableObjects.map(object => [object.id, object]));
  const wiringIssues = Array.isArray(options.wiringIssues)
    ? options.wiringIssues
    : analyzeProjectWiring(objects, connections);
  const powerGraph = options.powerGraph || buildPowerGraph(objects, connections);
  const invalidConnectionIds = getInvalidConnectionIds(wiringIssues);
  const layoutIssues = Array.isArray(options.layoutIssues)
    ? options.layoutIssues
    : analyzeProjectLayout(room, objects);

  for (const issue of layoutIssues) {
    if (issue.code === 'floating_object') {
      const object = objectsById.get(issue.objectIds[0]);
      const fixed = object && snapObjectToSupport(room, object, objects);
      if (fixed) {
        suggestions.push({
          id: `drop-to-support:${object.id}`,
          code: 'drop_to_support',
          title: `${object.name} 落到下方支撑面`,
          description: '将悬空物体下移到最近的支撑面或地板，无需购买任何物品。',
          objectIds: [object.id],
          patch: { objectId: object.id, position: fixed.position },
        });
      }
    } else if (issue.code === 'overhanging_object') {
      const object = objectsById.get(issue.objectIds[0]);
      const pushed = object && pushOntoSupport(room, object, objects);
      if (pushed) {
        suggestions.push({
          id: `push-onto-support:${object.id}`,
          code: 'push_onto_support',
          title: `${object.name} 推回去，放稳`,
          description: '把大半悬空的物体推回到下面的桌面或支架上，挪动最少，无需购买任何物品。',
          objectIds: [object.id],
          patch: { objectId: object.id, position: pushed.position },
        });
      }
    } else if (issue.code === 'out_of_bounds') {
      const object = objectsById.get(issue.objectIds[0]);
      const constrained = object && validateAndConstrainObject(object, room);
      if (constrained && constrained.valid) {
        suggestions.push({
          id: `move-inside:${object.id}`,
          code: 'move_inside_room',
          title: `${object.name} 移回房间边界内`,
          description: '将超出房间边界的物体移动到最近的合法位置，无需购买任何物品。',
          objectIds: [object.id],
          patch: { objectId: object.id, position: constrained.object.position },
        });
      }
    } else if (issue.code === 'outlet_off_wall') {
      const object = objectsById.get(issue.objectIds[0]);
      const fixed = object && snapWallOutletToNearestWall(room, object);
      if (fixed) {
        suggestions.push({
          id: `snap-outlet:${object.id}`,
          code: 'snap_outlet_to_wall',
          title: `${object.name} 贴到最近的墙面`,
          description: '将墙壁插座移动并朝向最近的墙面，使外部供电布线估算更准确。',
          objectIds: [object.id],
          patch: { objectId: object.id, position: fixed.position, rotation: fixed.rotation },
        });
      }
    }
  }

  // Calculate occupied ports to find free ones
  const occupiedPorts = new Map();
  for (const connection of connections) {
    if (invalidConnectionIds.has(connection.id)) continue;
    if (connection.fromObjectId && connection.fromPortId && connection.toObjectId && connection.toPortId) {
      let fromPorts = occupiedPorts.get(connection.fromObjectId);
      if (!fromPorts) {
        fromPorts = new Set();
        occupiedPorts.set(connection.fromObjectId, fromPorts);
      }
      fromPorts.add(connection.fromPortId);

      let toPorts = occupiedPorts.get(connection.toObjectId);
      if (!toPorts) {
        toPorts = new Set();
        occupiedPorts.set(connection.toObjectId, toPorts);
      }
      toPorts.add(connection.toPortId);
    }
  }
  const poweredObjectIds = getPoweredObjectIds(actionableObjects, powerGraph);

  for (const issue of wiringIssues) {
    if (issue.code === 'unpowered_input') {
      const endpoint = resolveUnpoweredInput(issue, objectsById);
      const object = endpoint?.object;
      const port = endpoint?.port;
      if (object && port && isPortDirectionConsistent(port)) {
        const bestSource = findNearestFreePowerSource(object, port, actionableObjects, occupiedPorts, poweredObjectIds);

        if (bestSource) {
          const length = autoCableLength({
            fromObjectId: bestSource.device.id, fromPortId: bestSource.port.id, toObjectId: object.id, toPortId: port.id,
          }, actionableObjects, Math.max(1.5, bestSource.distance * 1.1 + 0.3));
          const cableType = inferCableType(bestSource.port, port);
          const sourceNeedsPower = requiresPowerButIsUnpowered(bestSource.device, poweredObjectIds);
          suggestions.push({
            id: `auto-power:${object.id}:${port.id}`,
            code: 'auto_power_device',
            title: `为“${object.name}”连接电源`,
            description: `检测到“${object.name}”的电源接口“${port.name}”未连接。可自动使用一根 ${length}m 的电源线连接到附近的“${bestSource.device.name}”的空闲插孔“${bestSource.port.name}”。${sourceNeedsPower ? `接好后还需要把“${bestSource.device.name}”插到插座上。` : ''}`,
            objectIds: [bestSource.device.id, object.id],
            patch: {
              newConnection: {
                id: allocateConnectionId(`c-auto-power-${object.id}-${port.id}`),
                name: `${object.name}电源线`,
                cableType,
                length,
                fromObjectId: bestSource.device.id,
                fromPortId: bestSource.port.id,
                toObjectId: object.id,
                toPortId: port.id,
              }
            }
          });
          
          let localPorts = occupiedPorts.get(bestSource.device.id);
          if (!localPorts) {
            localPorts = new Set();
            occupiedPorts.set(bestSource.device.id, localPorts);
          }
          localPorts.add(bestSource.port.id);
        }
      }
    } else if (issue.code === 'short_cable' || issue.code === 'low_cable_slack') {
      const connectionId = issue.connectionIds[0];
      const connection = actionableConnections.find(candidate => candidate.id === connectionId);
      const status = connection && evaluateConnectionLength(connection, objects);
      if (!status) continue;
      const length = standardCableLength(status.recommendedLength);
      if (length <= connection.length) continue;
      suggestions.push({
        id: `extend-cable:${connectionId}`,
        code: 'extend_cable',
        title: `线材“${connection.name}”延长到约 ${length}m`,
        description: '让线长够走线长度，再留 10% 插拔余量，属于免费布线调整建议。',
        connectionIds: [connectionId],
        patch: { connectionId, length },
      });
    }
  }

  // 3. 自动连接网络 (auto_network_device)：把有网口的设备接到已通电的路由器
  for (const object of actionableObjects) {
    if (isRouter(object)) continue;

    for (const port of getActionablePortRecords(object)) {
      if (port.type !== 'ethernet') continue;
      const canReceiveNetwork = port.direction === 'input' || port.direction === 'bidirectional';
      if (!canReceiveNetwork || !isPortDirectionConsistent(port)) continue;
      
      const isOccupied = occupiedPorts.get(object.id)?.has(port.id);
      if (isOccupied) continue;

      let bestDistributor = null;
      let minDistance = Number.MAX_VALUE;

      for (const candidate of actionableObjects) {
        if (candidate.id === object.id) continue;
        // A real router is powered even when its power line is not drawn.
        if (!isRouter(candidate)) continue;

        for (const candidatePort of getActionablePortRecords(candidate)) {
          if (candidatePort.type !== 'ethernet') continue;
          const canProvideNetwork = candidatePort.direction === 'output' || candidatePort.direction === 'bidirectional';
          if (!canProvideNetwork || !isPortDirectionConsistent(candidatePort)) continue;

          const isPortOccupied = occupiedPorts.get(candidate.id)?.has(candidatePort.id);
          if (isPortOccupied) continue;

          const dist = calculatePositionDistance(object.position, candidate.position);
          if (dist !== null && dist < minDistance) {
            minDistance = dist;
            bestDistributor = { device: candidate, port: candidatePort, distance: dist };
          }
        }
      }

      if (bestDistributor) {
        const length = autoCableLength({
          fromObjectId: bestDistributor.device.id, fromPortId: bestDistributor.port.id, toObjectId: object.id, toPortId: port.id,
        }, actionableObjects, Math.max(1.0, bestDistributor.distance * 1.1 + 0.3));
        suggestions.push({
          id: `auto-network:${object.id}:${port.id}`,
          code: 'auto_network_device',
          title: `为“${object.name}”连接网络`,
          description: `检测到“${object.name}”的网口“${port.name}”未连网。可自动使用一根 ${length}m 的以太网线连接到附近的“${bestDistributor.device.name}”的空闲端口“${bestDistributor.port.name}”。`,
          objectIds: [bestDistributor.device.id, object.id],
          patch: {
            newConnection: {
              id: allocateConnectionId(`c-auto-network-${object.id}-${port.id}`),
              name: `${object.name}网线`,
              cableType: 'ethernet',
              length,
              fromObjectId: bestDistributor.device.id,
              fromPortId: bestDistributor.port.id,
              toObjectId: object.id,
              toPortId: port.id,
            }
          }
        });

        let localPorts = occupiedPorts.get(bestDistributor.device.id);
        if (!localPorts) {
          localPorts = new Set();
          occupiedPorts.set(bestDistributor.device.id, localPorts);
        }
        localPorts.add(bestDistributor.port.id);
      }
    }
  }

  // 4. 自动连接显示器 (auto_connect_display)
  const DISPLAY_PORT_TYPES = new Set(['hdmi', 'displayport', 'usb_c']);
  // One video cable per computer-monitor pair is enough; a spare output should
  // only be offered to a screen this computer does not already feed.
  const linkedDisplayPairs = new Set(connections
    .filter(connection => !invalidConnectionIds.has(connection.id) && DISPLAY_PORT_TYPES.has(connection.cableType))
    .map(connection => `${connection.fromObjectId}\u0000${connection.toObjectId}`));
  for (const object of actionableObjects) {
    for (const port of getActionablePortRecords(object)) {
      if (!DISPLAY_PORT_TYPES.has(port.type)) continue;
      const isOutput = port.direction === 'output' || port.direction === 'bidirectional';
      if (!isOutput) continue;

      const isOccupied = occupiedPorts.get(object.id)?.has(port.id);
      if (isOccupied) continue;

      // Find nearest display with a matching input port
      let bestDisplay = null;
      let minDistance = Number.MAX_VALUE;

      for (const candidate of actionableObjects) {
        if (candidate.id === object.id) continue;
        const modelId = typeof candidate.modelId === 'string' ? candidate.modelId : '';
        const isDisplay = modelId.startsWith('monitor')
          || candidate.type === 'monitor'
          || modelId.startsWith('ultrawide');
        if (!isDisplay || linkedDisplayPairs.has(`${object.id}\u0000${candidate.id}`)) continue;

        for (const candidatePort of getActionablePortRecords(candidate)) {
          if (candidatePort.type !== port.type) continue;
          const isInput = candidatePort.direction === 'input' || candidatePort.direction === 'bidirectional';
          if (!isInput) continue;

          const isPortOccupied = occupiedPorts.get(candidate.id)?.has(candidatePort.id);
          if (isPortOccupied) continue;

          const dist = calculatePositionDistance(object.position, candidate.position);
          if (dist !== null && dist < minDistance) {
            minDistance = dist;
            bestDisplay = { device: candidate, port: candidatePort, distance: dist };
          }
        }
      }

      if (bestDisplay) {
        const cableType = inferCableType(port, bestDisplay.port);
        const typeLabel = { hdmi: 'HDMI', displayport: 'DP', usb_c: 'USB-C' }[port.type] || port.type;
        const length = autoCableLength({
          fromObjectId: object.id, fromPortId: port.id, toObjectId: bestDisplay.device.id, toPortId: bestDisplay.port.id,
        }, actionableObjects, Math.max(1.0, bestDisplay.distance * 1.1 + 0.3));
        suggestions.push({
          id: `auto-display:${object.id}:${port.id}`,
          code: 'auto_connect_display',
          title: `为"${object.name}"连接显示器`,
          description: `检测到"${object.name}"的${typeLabel}输出未连接。可自动使用一根 ${length}m 的${typeLabel}线连接到附近的"${bestDisplay.device.name}"。`,
          objectIds: [object.id, bestDisplay.device.id],
          patch: {
            newConnection: {
              id: allocateConnectionId(`c-auto-display-${object.id}-${port.id}`),
              name: `${object.name}${typeLabel}线`,
              cableType,
              length,
              fromObjectId: object.id,
              fromPortId: port.id,
              toObjectId: bestDisplay.device.id,
              toPortId: bestDisplay.port.id,
            }
          }
        });

        let localPorts = occupiedPorts.get(bestDisplay.device.id);
        if (!localPorts) {
          localPorts = new Set();
          occupiedPorts.set(bestDisplay.device.id, localPorts);
        }
        localPorts.add(bestDisplay.port.id);
        linkedDisplayPairs.add(`${object.id}\u0000${bestDisplay.device.id}`);
      }
    }
  }

  // 5. 自动连接键盘、鼠标、音箱 (auto_connect_peripheral, E60): a keyboard or
  // mouse goes on a free USB port of a computer, speakers on its headphone
  // jack. The tower comes before a laptop, then the nearest.
  const PERIPHERAL_LINKS = { keyboard: 'usb', mouse: 'usb', speakers: 'audio' };
  const isComputer = object => object.category === 'computer'
    || object.type === 'desktop-pc' || object.type === 'laptop';
  const computerRank = object => (object.type === 'desktop-pc' || object.modelId === 'desktop-pc' ? 0 : 1);
  for (const object of actionableObjects) {
    const portType = PERIPHERAL_LINKS[object.type] || PERIPHERAL_LINKS[object.modelId];
    if (!portType) continue;
    for (const port of getActionablePortRecords(object)) {
      if (port.type !== portType || port.direction === 'output') continue;
      if (occupiedPorts.get(object.id)?.has(port.id)) continue;

      // The port with the shortest route (a laptop has one on each side).
      let best = null;
      for (const candidate of actionableObjects) {
        if (candidate.id === object.id || !isComputer(candidate)) continue;
        const rank = computerRank(candidate);
        for (const candidatePort of getActionablePortRecords(candidate)) {
          if (candidatePort.type !== portType || candidatePort.direction === 'input') continue;
          if (occupiedPorts.get(candidate.id)?.has(candidatePort.id)) continue;
          const distance = evaluateConnectionLength({
            fromObjectId: candidate.id, fromPortId: candidatePort.id, toObjectId: object.id, toPortId: port.id, length: 1,
          }, actionableObjects)?.distance ?? calculatePositionDistance(object.position, candidate.position);
          if (distance === null || distance === undefined) continue;
          if (!best || rank < best.rank || (rank === best.rank && distance < best.distance)) {
            best = { device: candidate, port: candidatePort, distance, rank };
          }
        }
      }
      if (!best) continue;

      const audio = portType === 'audio';
      const length = autoCableLength({
        fromObjectId: best.device.id, fromPortId: best.port.id, toObjectId: object.id, toPortId: port.id,
      }, actionableObjects, Math.max(1.0, best.distance * 1.1 + 0.3));
      suggestions.push({
        id: `auto-peripheral:${object.id}:${port.id}`,
        code: 'auto_connect_peripheral',
        title: `把"${object.name}"接到电脑上`,
        description: `"${object.name}"还没有接到电脑。可自动用一根 ${length}m 的${audio ? '音频线' : ' USB 线'}接到"${best.device.name}"的"${best.port.name}"。`,
        objectIds: [best.device.id, object.id],
        patch: {
          newConnection: {
            id: allocateConnectionId(`c-auto-peripheral-${object.id}-${port.id}`),
            name: `${object.name}${audio ? '音频线' : ' USB 线'}`,
            cableType: inferCableType(best.port, port),
            length,
            fromObjectId: best.device.id,
            fromPortId: best.port.id,
            toObjectId: object.id,
            toPortId: port.id,
          },
        },
      });
      for (const [id, portId] of [[best.device.id, best.port.id], [object.id, port.id]]) {
        if (!occupiedPorts.has(id)) occupiedPorts.set(id, new Set());
        occupiedPorts.get(id).add(portId);
      }
      break;
    }
  }

  return suggestions.sort(compareSuggestions);
}

/**
 * Derive paid purchase recommendations from hazards that cannot be resolved by
 * rearranging existing items (for example, daisy-chained or overloaded power
 * strips, or devices with nowhere to plug in).
 * Returns suggestions with a `product` { category, modelId } pointer, deduped
 * per device pair.
 */
export function buildPurchaseSuggestions(rawObjects, rawConnections = [], options = {}) {
  const objects = getRecordItems(rawObjects);
  const actionableObjects = getActionableObjectRecords(objects);
  const connections = getRecordItems(rawConnections);
  const actionableConnections = getActionableConnectionRecords(connections);
  const suggestions = [];
  const seen = new Set();
  const wiringIssues = Array.isArray(options.wiringIssues)
    ? options.wiringIssues
    : analyzeProjectWiring(objects, connections);
  const powerGraph = options.powerGraph || buildPowerGraph(objects, connections);
  const invalidConnectionIds = getInvalidConnectionIds(wiringIssues);

  // 1. Calculate occupied ports per object
  const occupiedPorts = new Map();
  for (const connection of connections) {
    if (invalidConnectionIds.has(connection.id)) continue;
    if (connection.fromObjectId && connection.fromPortId && connection.toObjectId && connection.toPortId) {
      let fromPorts = occupiedPorts.get(connection.fromObjectId);
      if (!fromPorts) {
        fromPorts = new Set();
        occupiedPorts.set(connection.fromObjectId, fromPorts);
      }
      fromPorts.add(connection.fromPortId);

      let toPorts = occupiedPorts.get(connection.toObjectId);
      if (!toPorts) {
        toPorts = new Set();
        occupiedPorts.set(connection.toObjectId, toPorts);
      }
      toPorts.add(connection.toPortId);
    }
  }

  // 2. Original cable warning/short check
  for (const issue of wiringIssues) {
    if (issue.code === 'power_strip_chain') {
      const key = [...issue.objectIds].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      suggestions.push({
        id: `fix-power-strip-chain:${key}`,
        code: 'fix_power_strip_chain',
        title: '插排不要串着接',
        description: '插排串联可能导致过载或接触点发热。建议把下游插排直接改接到墙壁插座；如果插孔不够，换一个孔位更多的插排。',
        objectIds: [...issue.objectIds],
        product: { category: 'power', modelId: 'power-strip' },
      });
    } else if (issue.code === 'short_cable' || issue.code === 'low_cable_slack') {
      const connectionId = issue.connectionIds[0];
      const connection = actionableConnections.find(candidate => candidate.id === connectionId);
      const status = connection && evaluateConnectionLength(connection, objects);
      if (!status) continue;
      const length = ceilLength(status.recommendedLength);
      if (length <= connection.length) continue;

      const key = `buy-cable:${connectionId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const typeName = CABLE_TYPE_NAMES[connection.cableType] || CABLE_TYPE_NAMES.other;
      const storeLength = standardCableLength(length);

      suggestions.push({
        id: key,
        code: 'buy_cable',
        title: `加购一根 ${storeLength}m ${typeName}`,
        description: `现有线材“${connection.name}”长度不足（至少需要约 ${length}m），建议换一根 ${storeLength}m 的${typeName}，避免受力拉扯。`,
        connectionIds: [connectionId],
        product: { category: 'cable', modelId: connection.cableType, length: storeLength },
      });
    }
  }

  // 3. 插孔够不够：每个要插电的设备占一个插孔。没画适配器的笔记本等 DC
  // 设备按自带充电器算一个插孔；接在已画适配器上的，由适配器占插孔。
  // 没画任何插座时不做判断，避免凭空猜测用户家里的插座数量。
  {
    const outletCount = actionableObjects.reduce((count, object) => count + getActionablePortRecords(object)
      .filter(port => port.type === 'ac_output' && isPortDirectionConsistent(port)).length, 0);
    if (outletCount > 0) {
      const plugsNeeded = actionableObjects.reduce((count, object) => {
        const ports = getActionablePortRecords(object).filter(port => isPortDirectionConsistent(port));
        if (ports.some(port => port.type === 'ac_input')) return count + 1;
        const dcInputs = ports.filter(port => port.type === 'dc_input');
        const chargedByModeledAdapter = dcInputs.some(port => occupiedPorts.get(object.id)?.has(port.id));
        return dcInputs.length > 0 && !chargedByModeledAdapter ? count + 1 : count;
      }, 0);
      if (plugsNeeded > outletCount) {
        const stripOutlets = (findModelTemplate({ modelId: 'power-strip' })?.ports || [])
          .filter(port => port.type === 'ac_output').length || 6;
        // A new strip takes one outlet itself and adds its own.
        const quantity = Math.ceil((plugsNeeded - outletCount) / Math.max(1, stripOutlets - 1));
        suggestions.push({
          id: 'buy-power-strip-for-outlets',
          code: 'buy_power_strip_for_outlets',
          title: `插孔不够，建议加购 ${quantity} 个插排`,
          description: `桌面上有 ${plugsNeeded} 个设备需要插电，现有插孔 ${outletCount} 个。一个 ${stripOutlets} 孔插排插上后可多出 ${stripOutlets - 1} 个插孔。`,
          product: { category: 'power', modelId: 'power-strip', quantity },
        });
      }
    }
  }

  // 4. 电源过载：建议分流
  for (const object of actionableObjects) {
    const maxLoad = getEffectiveMaxLoad(object);
    if (maxLoad > 0) {
      const currentLoad = computeDevicePowerLoad(object.id, objects, connections, powerGraph);
      if (classifyPowerLoad(currentLoad, maxLoad) === 'overload') {
        const key = `split-overloaded-power:${object.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          suggestions.push({
            id: key,
            code: 'split_overloaded_power',
            title: `“${object.name}”负载过高，需要分流`,
            description: `“${object.name}”的总负载已达 ${currentLoad}W，超出其安全上限 ${maxLoad}W。建议把部分大功率设备改接到另一个墙壁插座；如果附近插孔不够，再加购一个插排分流。`,
            objectIds: [object.id],
            product: { category: 'power', modelId: 'power-strip' },
          });
        }
      }
    }
  }

  return suggestions;
}

/**
 * Apply a single suggestion's patch to a project, returning a new project object
 * (inputs are not mutated). Object patches replace position/rotation; connection
 * patches replace length. Unknown targets are returned unchanged.
 */
export function applyImprovement(project, suggestion) {
  const patch = suggestion?.patch;
  if (!patch) return project;

  if (patch.objectId) {
    const objects = project.objects || [];
    const targetObject = getActionableObjectRecords(objects)
      .find(object => object.id === patch.objectId);
    if (!targetObject) return project;
    const nextPosition = patch.position ? patch.position : targetObject.position;
    const nextRotation = patch.rotation ? patch.rotation : targetObject.rotation;
    if (hasSameOwnValues(targetObject.position, nextPosition)
      && hasSameOwnValues(targetObject.rotation, nextRotation)) {
      return project;
    }
    // What rests on it goes along (a floating stand drops with its screen).
    const nextObject = {
      ...targetObject,
      position: patch.position ? { ...patch.position } : targetObject.position,
      rotation: patch.rotation ? { ...patch.rotation } : targetObject.rotation,
    };
    return { ...project, objects: updateWithRiders(objects, nextObject, project.room) };
  }

  if (patch.connectionId) {
    const connections = project.connections || [];
    const targetConnection = getActionableConnectionRecords(connections)
      .find(connection => connection.id === patch.connectionId);
    if (!targetConnection || targetConnection.length === patch.length) return project;
    const nextConnection = { ...targetConnection, length: patch.length };
    const lengthStatus = evaluateConnectionLength(
      nextConnection,
      getActionableObjectRecords(project.objects || [])
    );
    if (!lengthStatus?.hasRecommendedSlack) return project;
    return {
      ...project,
      connections: connections.map(connection =>
        connection.id === patch.connectionId
          ? { ...connection, length: patch.length }
          : connection),
    };
  }

  if (patch.newConnection) {
    const connections = project.connections || [];
    const objectsById = new Map(getActionableObjectRecords(project.objects || [])
      .map(object => [object.id, object]));
    const fromObject = objectsById.get(patch.newConnection.fromObjectId);
    const toObject = objectsById.get(patch.newConnection.toObjectId);
    const fromPort = getActionablePortRecords(fromObject)
      .find(port => port.id === patch.newConnection.fromPortId);
    const toPort = getActionablePortRecords(toObject)
      .find(port => port.id === patch.newConnection.toPortId);
    if (!fromObject
      || !toObject
      || !arePortsCompatible(fromPort, toPort)
      || patch.newConnection.cableType !== inferCableType(fromPort, toPort)) {
      return project;
    }
    const lengthStatus = evaluateConnectionLength(patch.newConnection, [...objectsById.values()]);
    if (!lengthStatus?.hasRecommendedSlack) return project;
    if (connections.some(connection => connection.id === patch.newConnection.id)) {
      return project;
    }
    const proposedPortRefs = [
      [patch.newConnection.fromObjectId, patch.newConnection.fromPortId],
      [patch.newConnection.toObjectId, patch.newConnection.toPortId],
    ].filter(([, portId]) => portId !== undefined && portId !== null);
    const hasOccupiedPort = proposedPortRefs.some(([objectId, portId]) =>
      connections.some(connection =>
        (connection.fromObjectId === objectId && connection.fromPortId === portId)
        || (connection.toObjectId === objectId && connection.toPortId === portId))
    );
    if (hasOccupiedPort) return project;
    return {
      ...project,
      connections: [
        ...connections,
        { ...patch.newConnection },
      ],
    };
  }

  return project;
}

/**
 * Apply every suggestion in order, threading the project through each patch.
 * Useful for an "apply all" action; returns a new project (inputs unchanged).
 */
export function applyAllImprovements(project, suggestions) {
  return suggestions.reduce((current, suggestion) => applyImprovement(current, suggestion), project);
}

function getSuggestionApplicationKey(suggestion) {
  return `${suggestion.id}:${JSON.stringify(suggestion.patch)}`;
}

/**
 * Repeatedly recompute and apply free improvements until no new suggestion is
 * available. This allows prerequisite fixes (for example, powering a router)
 * to unlock a subsequent safe wiring suggestion in one user action.
 */
export function applyAllAvailableImprovements(project) {
  if (!project?.room) return project;

  let current = project;
  const appliedSuggestionKeys = new Set();
  while (true) {
    const suggestions = buildFreeImprovements(
      current.room,
      current.objects || [],
      current.connections || []
    ).filter(suggestion => !appliedSuggestionKeys.has(getSuggestionApplicationKey(suggestion)));
    if (suggestions.length === 0) return current;

    for (const suggestion of suggestions) appliedSuggestionKeys.add(getSuggestionApplicationKey(suggestion));
    current = applyAllImprovements(current, suggestions);
  }
}

// Lines that only complete the model: the user's real devices are already
// plugged in and cabled (a keyboard or mouse is on the computer, E60), so
// these are drawn for them rather than suggested.
const MODEL_COMPLETION_CODES = new Set(['auto_power_device', 'auto_connect_display', 'auto_network_device', 'auto_connect_peripheral']);
const MAX_COMPLETION_PASSES = 5;

/**
 * The power, video and network lines to draw for one newly added device (as
 * new connection records, possibly empty). Several passes let a new strip get
 * plugged in first and then power the devices around it. The new device is
 * considered first so its own ports get the nearest free sockets.
 */
export function buildConnectionCompletion(project = {}, objectId) {
  const { room } = project || {};
  const objects = getRecordItems(project?.objects);
  const target = objects.find(object => object.id === objectId);
  if (!room || !target) return [];

  const orderedObjects = [target, ...objects.filter(object => object !== target)];
  let connections = getRecordItems(project.connections);
  const added = [];
  for (let pass = 0; pass < MAX_COMPLETION_PASSES; pass += 1) {
    const suggestions = buildFreeImprovements(room, orderedObjects, connections)
      .filter(suggestion => MODEL_COMPLETION_CODES.has(suggestion.code)
        && suggestion.objectIds?.includes(objectId));
    const next = applyAllImprovements({ room, objects: orderedObjects, connections }, suggestions);
    const newLines = next.connections.slice(connections.length);
    if (newLines.length === 0) break;
    added.push(...newLines);
    connections = next.connections;
  }
  return added;
}

/**
 * Project-shaped facade: derive every recommendation for a project in one call.
 * Returns { freeImprovements, purchases, total } so the UI can render a panel
 * and badge without orchestrating the individual builders.
 */
export function buildRecommendations(project = {}, options = {}) {
  const { room, objects: rawObjects, connections: rawConnections } = project || {};
  const objects = getRecordItems(rawObjects);
  const connections = getRecordItems(rawConnections);
  const wiringIssues = Array.isArray(options.wiringIssues)
    ? options.wiringIssues
    : analyzeProjectWiring(objects, connections);
  const powerGraph = options.powerGraph || buildPowerGraph(objects, connections);
  const layoutIssues = Array.isArray(options.layoutIssues)
    ? options.layoutIssues
    : (room ? analyzeProjectLayout(room, objects) : []);
  // Drawing missing power, video or network lines only completes the model;
  // the user's real devices already work, so these are not offered as fixes.
  const freeImprovements = room
    ? buildFreeImprovements(room, objects, connections, { wiringIssues, powerGraph, layoutIssues })
      .filter(suggestion => !MODEL_COMPLETION_CODES.has(suggestion.code))
    : [];
  const purchases = buildPurchaseSuggestions(objects, connections, { wiringIssues, powerGraph });
  return {
    freeImprovements,
    purchases,
    total: freeImprovements.length + purchases.length,
  };
}
