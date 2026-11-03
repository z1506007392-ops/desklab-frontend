import { evaluateSuggestion } from './ai-actions.js';
import { analyzeLayoutHeuristics } from './layout-heuristics.js';
import { getRecordItems } from './record-collections.js';

// What to do about each comfort/tidiness hint (roadmap §6.6.1), said as an
// action. A too-long cable is left out: fixing it means buying another
// cable, and nothing is wrong with the user's desk.
const TITLES = {
  monitor_not_on_desk: name => `${name}放到桌面上`,
  monitor_too_close: name => `${name}往后挪，离人远一点`,
  monitor_facing_away: name => `${name}转向座位`,
  monitor_off_center: name => `${name}挪到座位正前方`,
  laptop_at_back: name => `${name}挪到桌子前面`,
  laptop_blocks_screen: name => `${name}挪到屏幕旁边`,
  tower_on_desk_center: name => `${name}挪到桌子旁边的地上`,
  tower_blocks_legroom: name => `${name}挪出放腿的地方`,
  strip_on_desk: name => `${name}固定到桌面下靠后`,
  strip_on_floor: name => `${name}固定到桌面下靠后`,
  router_buried: name => `${name}挪到桌子旁边`,
  console_on_desk: name => `${name}挪到桌子旁边的地上`,
  console_blocks_legroom: name => `${name}挪出放腿的地方`,
  lamp_blocks_work: name => `${name}挪到桌子后角`,
  speakers_block_seat: name => `${name}挪到桌子后角`,
  mouse_far_from_keyboard: name => `${name}挪到键盘旁边`,
};

/**
 * The comfort and tidiness hints the AI gets, as optional tips anyone can
 * act on with one click: the hint's own fix, kept only when it applies and
 * makes the layout strictly better with no new problems (the same check as
 * an AI suggestion). Returns [{ id, code, title, description, objectIds,
 * actions }].
 */
export function buildLayoutTips(project) {
  const objects = getRecordItems(project.objects);
  const connections = getRecordItems(project.connections);
  const names = new Map(objects.map(object => [object.id, object.name]));
  return analyzeLayoutHeuristics(project.room, objects, connections)
    .filter(hint => TITLES[hint.code] && Array.isArray(hint.fix) && hint.fix.length > 0)
    .map(hint => {
      const subject = hint.objectIds.length === 1 ? names.get(hint.objectIds[0]) : '显示器';
      const tip = {
        id: `${hint.code}:${hint.objectIds.join(',')}`,
        code: hint.code,
        title: TITLES[hint.code](subject),
        description: `${hint.message}。`,
        objectIds: hint.objectIds,
        actions: hint.fix,
      };
      const check = evaluateSuggestion({ ...project, objects, connections }, { title: tip.title, reason: tip.description, actions: tip.actions });
      return check.accepted ? tip : null;
    })
    .filter(Boolean);
}

/**
 * Apply a tip to the current project, checked again (the desk may have
 * changed since it was listed): { project } or { reasons }.
 */
export function applyLayoutTip(project, tip) {
  const check = evaluateSuggestion(
    { ...project, objects: getRecordItems(project.objects), connections: getRecordItems(project.connections) },
    { title: tip.title, reason: tip.description, actions: tip.actions },
  );
  return check.accepted ? { project: check.nextProject } : { reasons: check.reasons };
}
