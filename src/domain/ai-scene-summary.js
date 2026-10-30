import { analyzeProjectWiring } from './analysis.js';
import { DEVICE_CATALOG } from './catalog.js';
import { evaluateConnectionLength } from './connections.js';
import { analyzeProjectLayout, findSupportingObject } from './layout-analysis.js';
import { analyzeLayoutHeuristics, getDeskSeat, isDesk } from './layout-heuristics.js';
import { getRecordItems } from './record-collections.js';

// The compact scene description sent to the AI (roadmap §6.4). Numbers are
// rounded to the centimetre to keep the prompt small. Device names are the
// user's own words and stay plain data fields; nothing here is an
// instruction. Appearance (colours, model files, port anchors, camera) is
// left out because the model cannot use it.
const round = value => Math.round(value * 100) / 100;
const vector = ({ x, y, z }) => [round(x), round(y), round(z)];

const CATALOG_MODEL_IDS = DEVICE_CATALOG.flatMap(category => category.models.map(model => model.modelId));

function restingOn(object, objects) {
  const support = findSupportingObject(object, objects);
  if (!support) return 'air';
  return support.kind === 'object' ? support.id : support.kind;
}

export function buildSceneSummary(project = {}) {
  const room = project.room ?? { length: 0, width: 0, height: 0 };
  const objects = getRecordItems(project.objects).filter(object => object?.position && object?.scale);
  const connections = getRecordItems(project.connections);

  const linkedTo = new Map();
  for (const connection of connections) {
    if (!connection.fromPortId || !connection.toPortId) continue;
    linkedTo.set(`${connection.fromObjectId}:${connection.fromPortId}`, `${connection.toObjectId}:${connection.toPortId}`);
    linkedTo.set(`${connection.toObjectId}:${connection.toPortId}`, `${connection.fromObjectId}:${connection.fromPortId}`);
  }

  const summaryObjects = objects.map(object => {
    const entry = {
      id: object.id,
      kind: object.modelId || object.type,
      name: object.name,
      center: vector(object.position),
      size: vector(object.scale),
      rotationZ: round(object.rotation?.z ?? 0),
      restingOn: restingOn(object, objects),
    };
    if (isDesk(object)) entry.topZ = round(object.position.z + object.scale.z / 2);
    const ports = getRecordItems(object.ports);
    if (ports.length > 0) {
      entry.ports = ports.map(port => ({
        id: port.id,
        type: port.type,
        dir: port.direction,
        linkedTo: linkedTo.get(`${object.id}:${port.id}`) ?? null,
      }));
    }
    return entry;
  });

  const summaryConnections = connections.map(connection => {
    const entry = {
      id: connection.id,
      from: connection.fromPortId ? `${connection.fromObjectId}:${connection.fromPortId}` : connection.fromObjectId,
      to: connection.toPortId ? `${connection.toObjectId}:${connection.toPortId}` : connection.toObjectId,
      type: connection.cableType,
      length: round(Number(connection.length) || 0),
    };
    const evaluation = evaluateConnectionLength(connection, objects);
    if (evaluation) entry.needed = round(evaluation.recommendedLength);
    return entry;
  });

  // Info notices (a line not drawn) are model completion, not problems.
  const findings = [
    ...analyzeProjectLayout(room, objects),
    ...analyzeProjectWiring(objects, connections),
  ]
    .filter(issue => issue.severity === 'error' || issue.severity === 'warning')
    .map(issue => ({
      code: issue.code,
      severity: issue.severity,
      objects: issue.objectIds ?? [],
      message: issue.title,
    }));

  const hints = analyzeLayoutHeuristics(room, objects, connections).map(item => ({
    code: item.code,
    objects: item.objectIds,
    message: item.message,
    ...(item.fix ? { fix: item.fix } : {}),
  }));

  return {
    units: '米；角度为度',
    axes: 'x=左右(长)，y=前后(深)，z=高度；position 是物体包围盒中心。设备正面是自身的 +y 方向，rotationZ=180 时朝 -y。人坐在 seats 给出的位置，面向桌子。',
    room: { length: round(room.length), width: round(room.width), height: round(room.height) },
    seats: objects.filter(isDesk).map(desk => {
      const seat = getDeskSeat(desk);
      return { desk: desk.id, x: round(seat.x), y: round(seat.y) };
    }),
    objects: summaryObjects,
    connections: summaryConnections,
    findings,
    hints,
    catalog: CATALOG_MODEL_IDS,
  };
}
