import { getConnectionEndpoints, calculatePositionDistance } from './connections.js';

// Straight-line distance between the two plugs is tight. This extra length
// covers the bend at each end. The shop size is then the next common length.
export const CABLE_SHOP_SLACK_METRES = 0.2;

// Lengths a home user can usually buy, in metres. Anything longer steps up
// by CABLE_SHOP_LENGTH_STEP_METRES (5, then 10, 15, …).
export const CABLE_SHOP_LENGTHS = Object.freeze([0.5, 1, 1.5, 2, 3, 5]);
export const CABLE_SHOP_LENGTH_STEP_METRES = 5;

const SHOP_CABLE_NAMES = Object.freeze({
  power: '电源线',
  hdmi: 'HDMI 线',
  usb_c: 'USB-C 线',
  usb: 'USB-A 线',
  audio: '3.5mm 音频线',
  ethernet: '网线',
  displayport: 'DP 线',
  other: '连接线',
});

export function shopCableLength(pathMetres) {
  if (!Number.isFinite(pathMetres) || pathMetres < 0) return null;
  const needed = pathMetres + CABLE_SHOP_SLACK_METRES;
  const stocked = CABLE_SHOP_LENGTHS.find(length => length >= needed - 1e-9);
  if (stocked !== undefined) return stocked;
  const last = CABLE_SHOP_LENGTHS[CABLE_SHOP_LENGTHS.length - 1];
  const steps = Math.ceil((needed - last) / CABLE_SHOP_LENGTH_STEP_METRES - 1e-9);
  return last + steps * CABLE_SHOP_LENGTH_STEP_METRES;
}

function formatMetres(length) {
  return `${length} 米`;
}

function shopCableName(cableType) {
  return SHOP_CABLE_NAMES[cableType] || SHOP_CABLE_NAMES.other;
}

/**
 * Cables to buy for the connections already drawn. Same kind and same shop
 * length are merged. Names are plain words; object and port ids are not shown.
 * Returns { items: [{ name, length, quantity }], text }.
 */
export function buildCableShoppingList(connections, objects) {
  const items = [];
  const byKey = new Map();
  for (const connection of Array.isArray(connections) ? connections : []) {
    const endpoints = getConnectionEndpoints(connection, objects || []);
    const distance = calculatePositionDistance(endpoints?.from, endpoints?.to);
    const length = shopCableLength(distance);
    if (length === null) continue;
    const name = `${formatMetres(length)} ${shopCableName(connection.cableType)}`;
    const existing = byKey.get(name);
    if (existing) {
      existing.quantity += 1;
      continue;
    }
    const item = { name, length, quantity: 1 };
    byKey.set(name, item);
    items.push(item);
  }
  items.sort((first, second) => first.name.localeCompare(second.name, 'zh'));
  const text = items.length === 0
    ? '当前没有需要买的线'
    : ['要买的线', ...items.map(item => `- ${item.name} ×${item.quantity}`)].join('\n');
  return { items, text };
}
