import { analyzeProjectWiring } from './analysis.js';
import { analyzeProjectLayout } from './layout-analysis.js';
import { analyzeLayoutHeuristics } from './layout-heuristics.js';
import { getRecordItems } from './record-collections.js';

// One number for how good a layout is; lower is better. Real problems
// dominate, comfort and tidiness hints come next, and total cable length
// breaks ties. Info notices (a power line not drawn) do not count: the
// user's devices already work. An AI suggestion is only shown when it lowers
// this score without adding problems (see ai-actions.js).
export const SCORE_WEIGHTS = Object.freeze({ error: 100, warning: 20, hint: 5, cableMetre: 1 });

export function scoreLayout(project = {}) {
  const objects = getRecordItems(project.objects);
  const connections = getRecordItems(project.connections);
  const issues = [
    ...(project.room ? analyzeProjectLayout(project.room, objects) : []),
    ...analyzeProjectWiring(objects, connections),
  ];
  const errorCodes = issues.filter(issue => issue.severity === 'error').map(issue => issue.code);
  const warningCodes = issues.filter(issue => issue.severity === 'warning').map(issue => issue.code);
  const hintCodes = project.room
    ? analyzeLayoutHeuristics(project.room, objects, connections).map(hint => hint.code)
    : [];
  const cableMeters = Math.round(connections
    .map(connection => Number(connection.length))
    .filter(length => Number.isFinite(length) && length > 0)
    .reduce((sum, length) => sum + length, 0) * 100) / 100;

  return {
    total: SCORE_WEIGHTS.error * errorCodes.length
      + SCORE_WEIGHTS.warning * warningCodes.length
      + SCORE_WEIGHTS.hint * hintCodes.length
      + SCORE_WEIGHTS.cableMetre * cableMeters,
    errors: errorCodes.length,
    warnings: warningCodes.length,
    hints: hintCodes.length,
    cableMeters,
    codes: { errors: errorCodes, warnings: warningCodes, hints: hintCodes },
  };
}
