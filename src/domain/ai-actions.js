import { sanitizeSuggestions } from './ai-protocol.js';
import {
  arePortsCompatible,
  describeCableType,
  evaluateConnectionLength,
  inferCableType,
  standardCableLength,
} from './connections.js';
import { GEOMETRY_EPSILON, validateAndConstrainObject } from './geometry.js';
import { findSupportingObject, snapObjectToSupport } from './layout-analysis.js';
import { isDesk } from './layout-heuristics.js';
import { scoreLayout } from './layout-score.js';
import { isProjectEnvelope } from './project-validation.js';
import { getRecordItems } from './record-collections.js';

// Turns AI suggestions into checked project changes (roadmap §6.6). The AI
// only proposes; every action goes through the same geometry and wiring
// rules as a user edit, any refused action voids the whole suggestion, and a
// suggestion is only accepted when the layout scores strictly better with no
// new problems. This is the safety boundary for everything the model says.

const isWallOutlet = object => object.modelId === 'wall-outlet' || object.type === 'outlet';
const DESK_DEVICE_MODELS = new Set(['monitor-24', 'monitor-27', 'ultrawide-monitor', 'laptop-15', 'keyboard', 'mouse', 'desk-lamp', 'speakers']);
const belongsOnDesk = object => DESK_DEVICE_MODELS.has(object.modelId) || object.type === 'monitor' || object.type === 'laptop';
// Text that looks like an internal id (monitor-1, ac_input) must not reach
// the user in a title or reason.
const ID_LIKE_TEXT = /[a-z]+-\d|[a-z]+_[a-z]+/i;

export function parseAiResponse(json) {
  return sanitizeSuggestions(json);
}

class ActionRefused extends Error {}
const refuse = reason => { throw new ActionRefused(reason); };

function findObject(project, id) {
  return project.objects.find(object => object.id === id) ?? refuse(`找不到设备 ${id}`);
}

function hasLoad(project, desk) {
  return project.objects.some(object => {
    const support = findSupportingObject(object, project.objects);
    return support?.kind === 'object' && support.id === desk.id;
  });
}

function assertMovable(project, object) {
  if (isWallOutlet(object)) refuse('墙壁插座不能移动');
  if (isDesk(object) && hasLoad(project, object)) refuse('桌上有设备时不移动桌子');
}

// Place an object at a new spot. With an explicit z it stays there (the
// analysis then judges it); otherwise it keeps its level: things on the
// floor stay on the floor, everything else drops onto the highest support.
function placeObject(project, object, position, { keepFloor }) {
  const others = project.objects.filter(other => other.id !== object.id);
  let candidate = { ...object, position: { ...object.position, ...position } };
  if (position.z === undefined) {
    if (keepFloor) {
      candidate.position.z = object.scale.z / 2;
    } else {
      candidate.position.z = project.room.height - object.scale.z / 2;
      candidate = snapObjectToSupport(project.room, candidate, others) ?? refuse('找不到可以放置的位置');
    }
  }
  const constrained = validateAndConstrainObject(candidate, project.room);
  if (!constrained.valid) refuse('位置超出房间');
  const moved = ['x', 'y', 'z'].some(axis => Math.abs(constrained.object.position[axis] - candidate.position[axis]) > GEOMETRY_EPSILON);
  if (moved) refuse('位置超出房间');
  if (belongsOnDesk(object)) {
    const support = findSupportingObject(constrained.object, others);
    const onDesk = support?.kind === 'object' && isDesk(others.find(other => other.id === support.id));
    if (!onDesk) {
      refuse(object.type === 'monitor' || object.type === 'laptop'
        ? '显示器和笔记本要放在桌面上'
        : `${object.name}要放在桌面上`);
    }
  }
  return constrained.object;
}

const replaceObject = (project, next) => ({
  ...project,
  objects: project.objects.map(object => (object.id === next.id ? next : object)),
});

function portOf(object, portId) {
  return getRecordItems(object.ports).find(port => port.id === portId) ?? refuse(`${object.name} 没有这个接口`);
}

function portInUse(project, objectId, portId) {
  return project.connections.some(connection =>
    (connection.fromObjectId === objectId && connection.fromPortId === portId)
    || (connection.toObjectId === objectId && connection.toPortId === portId));
}

function nextConnectionId(project, base) {
  const taken = new Set(project.connections.map(connection => connection.id));
  let id = base;
  for (let suffix = 2; taken.has(id); suffix += 1) id = `${base}-${suffix}`;
  return id;
}

const ACTIONS = {
  move(project, action) {
    const object = findObject(project, action.objectId);
    assertMovable(project, object);
    const keepFloor = findSupportingObject(object, project.objects)?.kind === 'floor';
    return replaceObject(project, placeObject(project, object, { x: action.x, y: action.y, z: action.z }, { keepFloor }));
  },
  rotate(project, action) {
    const object = findObject(project, action.objectId);
    assertMovable(project, object);
    const rotationZ = ((action.rotationZ % 360) + 360) % 360;
    const rotated = { ...object, rotation: { ...object.rotation, z: rotationZ } };
    const constrained = validateAndConstrainObject(rotated, project.room);
    if (!constrained.valid
      || ['x', 'y', 'z'].some(axis => Math.abs(constrained.object.position[axis] - rotated.position[axis]) > GEOMETRY_EPSILON)) {
      refuse('转过去会超出房间');
    }
    return replaceObject(project, constrained.object);
  },
  swap(project, action) {
    if (action.objectIdA === action.objectIdB) refuse('不能和自己交换位置');
    const first = findObject(project, action.objectIdA);
    const second = findObject(project, action.objectIdB);
    for (const object of [first, second]) {
      if (isDesk(object) || isWallOutlet(object)) refuse('桌子和墙壁插座不交换位置');
    }
    const firstOnFloor = findSupportingObject(first, project.objects)?.kind === 'floor';
    const secondOnFloor = findSupportingObject(second, project.objects)?.kind === 'floor';
    // Lift both out of the way, then place each where the other was.
    const lifted = {
      ...project,
      objects: project.objects.filter(object => object.id !== first.id && object.id !== second.id),
    };
    const nextFirst = placeObject(lifted, first, { x: second.position.x, y: second.position.y }, { keepFloor: secondOnFloor });
    const withFirst = { ...lifted, objects: [...lifted.objects, nextFirst] };
    const nextSecond = placeObject(withFirst, second, { x: first.position.x, y: first.position.y }, { keepFloor: firstOnFloor });
    return replaceObject(replaceObject(project, nextFirst), nextSecond);
  },
  connect(project, action) {
    const from = findObject(project, action.fromObjectId);
    const to = findObject(project, action.toObjectId);
    if (from.id === to.id) refuse('不能自己连自己');
    const fromPort = portOf(from, action.fromPortId);
    const toPort = portOf(to, action.toPortId);
    if (portInUse(project, from.id, fromPort.id) || portInUse(project, to.id, toPort.id)) refuse('接口已经接了线');
    if (!arePortsCompatible(fromPort, toPort)) refuse('这两个接口接不到一起');
    const cableType = inferCableType(fromPort, toPort);
    const draft = {
      id: nextConnectionId(project, `c-ai-${from.id}-${fromPort.id}`),
      name: `${from.name}${describeCableType(cableType)}`,
      cableType,
      length: 1,
      fromObjectId: from.id,
      fromPortId: fromPort.id,
      toObjectId: to.id,
      toPortId: toPort.id,
    };
    const evaluation = evaluateConnectionLength(draft, project.objects) ?? refuse('算不出这根线要多长');
    return { ...project, connections: [...project.connections, { ...draft, length: standardCableLength(evaluation.recommendedLength) }] };
  },
  disconnect(project, action) {
    const connection = project.connections.find(item => item.id === action.connectionId) ?? refuse('找不到这根线');
    // Removing a power line would only make the model look unpowered.
    if (connection.cableType === 'power') refuse('不拔电源线');
    return { ...project, connections: project.connections.filter(item => item.id !== connection.id) };
  },
  set_cable_length(project, action) {
    const connection = project.connections.find(item => item.id === action.connectionId) ?? refuse('找不到这根线');
    const evaluation = evaluateConnectionLength({ ...connection, length: action.length }, project.objects)
      ?? refuse('算不出这根线要多长');
    if (action.length < evaluation.recommendedLength - 1e-9) refuse('线会不够长');
    const length = standardCableLength(action.length);
    return {
      ...project,
      connections: project.connections.map(item => (item.id === connection.id ? { ...item, length } : item)),
    };
  },
};

/**
 * Apply actions in order to a copy of the project. Stops at the first refused
 * action: { project: null, rejected: [{ action, reason }] }. On success
 * { project, rejected: [] }. The input project is never modified.
 */
export function applyAiActions(project, actions) {
  let next = {
    ...project,
    objects: getRecordItems(project.objects),
    connections: getRecordItems(project.connections),
  };
  for (const action of actions) {
    const apply = ACTIONS[action?.type];
    if (!apply) return { project: null, rejected: [{ action, reason: '不支持的改动' }] };
    try {
      next = apply(next, action);
    } catch (error) {
      if (error instanceof ActionRefused) return { project: null, rejected: [{ action, reason: error.message }] };
      throw error;
    }
  }
  return { project: next, rejected: [] };
}

/**
 * Decide whether a suggestion may be shown (roadmap §6.6.4): every action
 * applies, errors and warnings do not increase, the score strictly drops,
 * the result is a valid project, and the text has no internal ids.
 */
export function evaluateSuggestion(project, suggestion) {
  const scoreBefore = scoreLayout(project);
  const reject = reasons => ({ accepted: false, nextProject: null, scoreBefore, scoreAfter: null, reasons });
  if (ID_LIKE_TEXT.test(`${suggestion.title} ${suggestion.reason}`)) return reject(['说明里有内部编号']);
  if (!Array.isArray(suggestion.actions) || suggestion.actions.length === 0) return reject(['没有具体改动']);

  const { project: nextProject, rejected } = applyAiActions(project, suggestion.actions);
  if (!nextProject) return reject(rejected.map(item => item.reason));
  if (!isProjectEnvelope(nextProject)) return reject(['改动后的项目数据无效']);

  const scoreAfter = scoreLayout(nextProject);
  const reasons = [];
  if (scoreAfter.errors > scoreBefore.errors) reasons.push('会产生新的问题');
  if (scoreAfter.warnings > scoreBefore.warnings) reasons.push('会产生新的提醒');
  if (!(scoreAfter.total < scoreBefore.total - 1e-9)) reasons.push('没有让布局变得更好');
  if (reasons.length > 0) return { accepted: false, nextProject: null, scoreBefore, scoreAfter, reasons };
  return { accepted: true, nextProject, scoreBefore, scoreAfter, reasons: [] };
}

/** Accepted suggestions with their results, biggest improvement first. */
export function evaluateSuggestions(project, suggestions) {
  return suggestions
    .map(suggestion => ({ suggestion, ...evaluateSuggestion(project, suggestion) }))
    .filter(result => result.accepted)
    .sort((first, second) => (second.scoreBefore.total - second.scoreAfter.total)
      - (first.scoreBefore.total - first.scoreAfter.total));
}

/**
 * Apply several suggestions one after another, re-checking each against the
 * result of the previous ones; suggestions that no longer help are skipped.
 */
export function applySuggestionsInOrder(project, suggestions) {
  let current = project;
  const applied = [];
  const skipped = [];
  for (const suggestion of suggestions) {
    const result = evaluateSuggestion(current, suggestion);
    if (result.accepted) {
      current = result.nextProject;
      applied.push(suggestion.id);
    } else {
      skipped.push(suggestion.id);
    }
  }
  return { project: current, applied, skipped };
}

/** Ids of devices whose place, rotation, or cables differ between two projects. */
export function changedObjectIds(before, after) {
  const previous = new Map(getRecordItems(before.objects).map(object => [object.id, object]));
  const changed = new Set();
  for (const object of getRecordItems(after.objects)) {
    const old = previous.get(object.id);
    if (!old
      || ['x', 'y', 'z'].some(axis => Math.abs(old.position[axis] - object.position[axis]) > GEOMETRY_EPSILON)
      || Math.abs((old.rotation?.z ?? 0) - (object.rotation?.z ?? 0)) > GEOMETRY_EPSILON) {
      changed.add(object.id);
    }
  }
  const key = connection => JSON.stringify([connection.fromObjectId, connection.fromPortId, connection.toObjectId, connection.toPortId, connection.length]);
  const beforeKeys = new Set(getRecordItems(before.connections).map(key));
  const afterKeys = new Set(getRecordItems(after.connections).map(key));
  for (const connection of [...getRecordItems(before.connections), ...getRecordItems(after.connections)]) {
    if (beforeKeys.has(key(connection)) && afterKeys.has(key(connection))) continue;
    changed.add(connection.fromObjectId);
    changed.add(connection.toObjectId);
  }
  return [...changed];
}
