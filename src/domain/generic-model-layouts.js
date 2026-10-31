const GENERIC_OFFICE_DESK_LAYOUT = Object.freeze({
  tops: Object.freeze([
    Object.freeze({ x: 0, z: 0, width: 1, depth: 1 }),
  ]),
  legs: Object.freeze([
    Object.freeze({ x: -0.42, z: -0.38, width: 0.09, depth: 0.09 }),
    Object.freeze({ x: -0.42, z: 0.38, width: 0.09, depth: 0.09 }),
    Object.freeze({ x: 0.42, z: -0.38, width: 0.09, depth: 0.09 }),
    Object.freeze({ x: 0.42, z: 0.38, width: 0.09, depth: 0.09 }),
  ]),
  cableTrays: Object.freeze([
    Object.freeze({ x: 0, z: -0.42, width: 0.62, depth: 0.08 }),
  ]),
});

const GENERIC_MONITOR_LAYOUT = Object.freeze({
  panels: Object.freeze([
    Object.freeze({ x: 0, z: 0, width: 1, depth: 0.45 }),
  ]),
  screens: Object.freeze([
    Object.freeze({ x: 0, z: 0.24, width: 0.82, depth: 0.12 }),
  ]),
  rearHousings: Object.freeze([
    Object.freeze({ x: 0, z: -0.33, width: 0.52, depth: 0.24 }),
  ]),
  stands: Object.freeze([
    Object.freeze({ x: 0, z: 0, width: 0.12, depth: 0.52 }),
  ]),
  bases: Object.freeze([
    Object.freeze({ x: 0, z: 0, width: 0.42, depth: 0.92 }),
  ]),
});

const GENERIC_DESKTOP_PC_LAYOUT = Object.freeze({
  bodies: Object.freeze([
    Object.freeze({ x: 0, z: 0, width: 1, depth: 1 }),
  ]),
  frontPanels: Object.freeze([
    Object.freeze({ x: 0, z: 0.48, width: 0.82, depth: 0.04 }),
  ]),
  fanVents: Object.freeze([
    Object.freeze({ x: 0, z: 0.475, width: 0.44, depth: 0.05 }),
  ]),
  powerButtons: Object.freeze([
    Object.freeze({ x: -0.24, z: 0.475, width: 0.14, depth: 0.05 }),
  ]),
  statusLights: Object.freeze([
    Object.freeze({ x: -0.24, z: 0.487, width: 0.044, depth: 0.022 }),
  ]),
  frontPorts: Object.freeze([
    Object.freeze({ x: 0.18, z: 0.475, width: 0.16, depth: 0.05 }),
    Object.freeze({ x: 0.18, z: 0.475, width: 0.16, depth: 0.05 }),
  ]),
});

const GENERIC_POWER_ADAPTER_LAYOUT = Object.freeze({
  bodies: Object.freeze([
    Object.freeze({ x: 0, z: 0, width: 1, depth: 1 }),
  ]),
  labels: Object.freeze([
    Object.freeze({ x: 0, z: 0, width: 0.58, depth: 0.52 }),
  ]),
  acPins: Object.freeze([
    Object.freeze({ x: -0.22, z: 0.32, width: 0.12, depth: 0.36 }),
    Object.freeze({ x: 0.22, z: 0.32, width: 0.12, depth: 0.36 }),
  ]),
  dcStrainReliefs: Object.freeze([
    Object.freeze({ x: 0, z: -0.38, width: 0.138, depth: 0.24 }),
  ]),
});

const GENERIC_WALL_OUTLET_LAYOUT = Object.freeze({
  bodies: Object.freeze([
    Object.freeze({ x: 0, z: 0, width: 1, depth: 1 }),
  ]),
  faceplates: Object.freeze([
    Object.freeze({ x: 0, z: 0.47, width: 0.82, depth: 0.06 }),
  ]),
  slots: Object.freeze([
    Object.freeze({ x: -0.14, z: 0.48, width: 0.08, depth: 0.04 }),
    Object.freeze({ x: 0.14, z: 0.48, width: 0.08, depth: 0.04 }),
    Object.freeze({ x: -0.14, z: 0.48, width: 0.08, depth: 0.04 }),
    Object.freeze({ x: 0.14, z: 0.48, width: 0.08, depth: 0.04 }),
  ]),
  fasteners: Object.freeze([
    Object.freeze({ x: 0, z: 0.48, width: 0.07, depth: 0.04 }),
  ]),
});

const GENERIC_ROUTER_LAYOUT = Object.freeze({
  bodies: Object.freeze([Object.freeze({ x: 0, z: 0, width: 1, depth: 1 })]),
  ports: Object.freeze([
    Object.freeze({ x: -0.25, z: 0.46, width: 0.11, depth: 0.08 }),
    Object.freeze({ x: -0.08333333333333333, z: 0.46, width: 0.11, depth: 0.08 }),
    Object.freeze({ x: 0.08333333333333333, z: 0.46, width: 0.11, depth: 0.08 }),
    Object.freeze({ x: 0.25, z: 0.46, width: 0.11, depth: 0.08 }),
  ]),
  antennas: Object.freeze([
    Object.freeze({ x: -0.35, z: -0.2, width: 0.11, depth: 0.04, rotation: 0.45 }),
    Object.freeze({ x: 0.35, z: -0.2, width: 0.11, depth: 0.04, rotation: -0.45 }),
  ]),
  statusLights: Object.freeze([Object.freeze({ x: 0.38, z: 0.2, width: 0.05, depth: 0.07 })]),
});

const GENERIC_POWER_STRIP_LAYOUT = Object.freeze({
  bodies: Object.freeze([Object.freeze({ x: 0, z: 0, width: 1, depth: 1 })]),
  topPlates: Object.freeze([Object.freeze({ x: 0, z: 0, width: 0.9, depth: 0.72 })]),
  socketPairs: Object.freeze([
    ...Array.from({ length: 6 }, (_, index) => Object.freeze({
      x: -0.36 + index * 0.72 / 5, z: 0.12, width: 0.051, depth: 0.022,
    })),
  ]),
  inputEnds: Object.freeze([Object.freeze({ x: -0.45, z: -0.42, width: 0.08, depth: 0.16 })]),
});

const GENERIC_LAPTOP_LAYOUT = Object.freeze({
  bases: Object.freeze([Object.freeze({ x: 0, z: 0.04, width: 1, depth: 0.9 })]),
  keyboards: Object.freeze([Object.freeze({ x: 0, z: 0.07, width: 0.78, depth: 0.54 })]),
  lids: Object.freeze([Object.freeze({ x: 0, z: -0.39, width: 0.96, depth: 0.06 })]),
  screens: Object.freeze([Object.freeze({ x: 0, z: -0.35, width: 0.84, depth: 0.025 })]),
  hinges: Object.freeze([Object.freeze({ x: 0, z: -0.36, width: 0.72, depth: 0.12 })]),
});

const GENERIC_BLOCK_LAYOUT = Object.freeze({
  bodies: Object.freeze([Object.freeze({ x: 0, z: 0, width: 1, depth: 1 })]),
});

const GENERIC_MODEL_LAYOUT_BY_MODEL_ID = Object.freeze({
  'office-desk': GENERIC_OFFICE_DESK_LAYOUT,
  'monitor-24': GENERIC_MONITOR_LAYOUT,
  'monitor-27': GENERIC_MONITOR_LAYOUT,
  'ultrawide-monitor': GENERIC_MONITOR_LAYOUT,
  'desktop-pc': GENERIC_DESKTOP_PC_LAYOUT,
  'power-adapter': GENERIC_POWER_ADAPTER_LAYOUT,
  'wall-outlet': GENERIC_WALL_OUTLET_LAYOUT,
  router: GENERIC_ROUTER_LAYOUT,
  'power-strip': GENERIC_POWER_STRIP_LAYOUT,
  'laptop-15': GENERIC_LAPTOP_LAYOUT,
  keyboard: GENERIC_BLOCK_LAYOUT,
  mouse: GENERIC_BLOCK_LAYOUT,
  'desk-lamp': GENERIC_BLOCK_LAYOUT,
  speakers: GENERIC_BLOCK_LAYOUT,
});

export function getGenericModelLayout(modelId) {
  return GENERIC_MODEL_LAYOUT_BY_MODEL_ID[modelId] || null;
}

export function isGenericModelLayoutWithinBounds(modelId) {
  const layout = getGenericModelLayout(modelId);
  if (!layout) return false;

  return Object.values(layout).flat().every(part => (
    Math.abs(part.x) + part.width / 2 <= 0.5
    && Math.abs(part.z) + part.depth / 2 <= 0.5
  ));
}
