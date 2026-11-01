import { buildPowerGraph, classifyPowerLoad, computeDevicePowerLoad, getEffectiveMaxLoad } from './analysis.js';

const POWER_OUTPUT_TYPES = new Set(['ac_output', 'dc_output']);

const POWER_TAG_WORDS = Object.freeze({
  overload: '超载',
  warning: '接近上限',
});

/**
 * The power sources (wall outlets, strips, adapters) that get a tag in the
 * 3D view: only those near or over their limit, since a tag marks something
 * to deal with (DESIGN.md). A load that is fine stays in the properties
 * panel ("已接负载"). Returns [{ objectId, status, load, max, text }].
 */
export function findPowerTags(objects, connections) {
  const items = Array.isArray(objects) ? objects : [];
  const links = Array.isArray(connections) ? connections : [];
  const graph = buildPowerGraph(items, links);
  const tags = [];
  for (const object of items) {
    if (!object.ports?.some(port => POWER_OUTPUT_TYPES.has(port.type))) continue;
    const max = getEffectiveMaxLoad(object);
    if (!(max > 0)) continue;
    const load = computeDevicePowerLoad(object.id, items, links, graph);
    const status = classifyPowerLoad(load, max);
    if (status === 'ok') continue;
    tags.push({ objectId: object.id, status, load, max, text: `${POWER_TAG_WORDS[status]} ${Math.round(load)}W / ${max}W` });
  }
  return tags;
}
