// Cited electrical figures for the catalog. Geometry, port lists and colours
// stay in catalog.js. Tests assert DEVICE_CATALOG matches these numbers so a
// silent edit cannot drift from the source. Nothing here is a nameplate for
// one specific SKU unless the comment says so: several entries are rounded
// household estimates, chosen so an overload is not missed.

// wall-outlet maxLoad, 2500 W. A household 10 A / 250 V socket is 2500 W
// (GB/T 2099.1-2021 preferred ratings). 陕西省消费者协会,
// http://www.sxwq.org.cn/info/1030/8204.htm : a 10 A 250 V socket's maximum
// capacity is 2500 W; 16 A 250 V is 4000 W and is the larger
// air-conditioner socket, not this 8 cm × 8 cm faceplate. 3500 W matched
// neither figure (220 V × 16 A is a mixed number, about 3520 W).
//
// power-strip maxLoad, 2500 W. The same 10 A class as the wall socket.
//
// power-adapter maxLoad, 150 W. A generic ceiling for a brick around the
// 140 W USB-C PD class. wattage 5 W is estimated conversion overhead added
// on top of the device nameplate, not a nameplate of its own.
//
// desktop-pc, 350 W. A rounded mid-tower gaming wall draw. Office towers
// are lower; 350 avoids under-counting a gaming tower.
// laptop-15, 65 W. A common 15-inch office adapter.
// monitors, 30 / 45 / 60 W. Rounded up so an overload is not missed.
// keyboard 2 W, mouse 1 W, desk-lamp 8 W, speakers 18 W.
// router, 12 W. A common 12 V 1 A class. Three LAN ports: many routers are
// 1 WAN + 3 LAN. The modem was removed, so a separate WAN port is not modeled.
//
// game-console, 200 W. The mesh is a flat console, 0.30 × 0.24 × 0.08 m,
// not a PlayStation 5. Sony's CFI-2000 / CFI-21 safety guide lists a
// maximum rated power of 350 W and a taller body. Using that figure, or
// those proportions, would describe a different device, so it stays 200 W
// until the owner decides.

export const CATALOG_POWER = Object.freeze({
  'desktop-pc': Object.freeze({ wattage: 350 }),
  'laptop-15': Object.freeze({ wattage: 65 }),
  'game-console': Object.freeze({ wattage: 200 }),
  'monitor-24': Object.freeze({ wattage: 30 }),
  'monitor-27': Object.freeze({ wattage: 45 }),
  'ultrawide-monitor': Object.freeze({ wattage: 60 }),
  keyboard: Object.freeze({ wattage: 2 }),
  mouse: Object.freeze({ wattage: 1 }),
  'desk-lamp': Object.freeze({ wattage: 8 }),
  speakers: Object.freeze({ wattage: 18 }),
  router: Object.freeze({ wattage: 12 }),
  'power-strip': Object.freeze({ maxLoad: 2500 }),
  'wall-outlet': Object.freeze({ maxLoad: 2500 }),
  'power-adapter': Object.freeze({ wattage: 5, maxLoad: 150 }),
});
