import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeProjectLayout,
  settleAfterDrag,
  snapObjectToSupport,
  snapWallOutletToNearestWall,
  summarizeLayoutIssues,
} from '../src/domain/layout-analysis.js';
import { getPortWorldPosition } from '../src/domain/connections.js';
import { placeCatalogObject } from '../src/domain/placement.js';
import { DEVICE_CATALOG } from '../src/domain/catalog.js';

const room = { length: 5, width: 4, height: 3 };
const object = (id, overrides = {}) => ({
  id,
  name: id,
  type: 'device',
  position: { x: 0, y: 0, z: 0.5 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
  ...overrides,
});

test('each shipped catalog device placed alone raises no layout errors', () => {
  const placeRoom = { length: 10, width: 10, height: 5 };

  for (const category of DEVICE_CATALOG) {
    for (const model of category.models) {
      const placed = placeCatalogObject({ modelTemplate: model, categoryId: category.category, room: placeRoom });
      assert.equal(placed.valid, true, `${model.modelId} should place validly`);
      const issues = analyzeProjectLayout(placeRoom, [placed.object]);
      assert.equal(
        summarizeLayoutIssues(issues).error,
        0,
        `${model.modelId}: ${JSON.stringify(issues.filter(issue => issue.severity === 'error'))}`
      );
    }
  }
});

test('reports objects outside the room and objects too large to fit', () => {
  const issues = analyzeProjectLayout(room, [
    object('outside', { position: { x: 10, y: 0, z: 0.5 } }),
    object('huge', { scale: { x: 6, y: 1, z: 1 } }),
  ]);

  assert.ok(issues.some(issue => issue.code === 'out_of_bounds'));
  assert.ok(issues.some(issue => issue.code === 'cannot_fit'));
  assert.deepEqual(summarizeLayoutIssues(issues), { error: 2, warning: 0, info: 0 });
});

test('reports 3D intersections but not objects that only touch', () => {
  const overlappingIssues = analyzeProjectLayout(room, [
    object('first'),
    object('second', { position: { x: 0.8, y: 0, z: 0.5 } }),
  ]);
  assert.equal(overlappingIssues.filter(issue => issue.code === 'object_overlap').length, 1);

  const touchingIssues = analyzeProjectLayout(room, [
    object('first'),
    object('second', { position: { x: 1, y: 0, z: 0.5 } }),
  ]);
  assert.equal(touchingIssues.filter(issue => issue.code === 'object_overlap').length, 0);
});

test('uses height overlap so a device can rest on top of furniture', () => {
  const issues = analyzeProjectLayout(room, [
    object('desk', {
      position: { x: 0, y: 0, z: 0.375 },
      scale: { x: 1.4, y: 0.7, z: 0.75 },
    }),
    object('monitor', {
      position: { x: 0, y: 0, z: 0.875 },
      scale: { x: 0.5, y: 0.1, z: 0.25 },
    }),
  ]);
  assert.equal(issues.filter(issue => issue.code === 'object_overlap').length, 0);
});

test('does not report AABB-only overlap between separated rotated objects', () => {
  const issues = analyzeProjectLayout(room, [
    object('first', {
      position: { x: 0, y: 0, z: 0.1 },
      rotation: { x: 0, y: 0, z: 45 },
      scale: { x: 2, y: 0.2, z: 0.2 },
    }),
    object('second', {
      position: { x: -0.212132, y: 0.212132, z: 0.1 },
      rotation: { x: 0, y: 0, z: 45 },
      scale: { x: 2, y: 0.2, z: 0.2 },
    }),
  ]);

  assert.equal(issues.some(issue => issue.code === 'object_overlap'), false);
});

test('warns when a wall outlet is floating away from every wall', () => {
  const floatingOutlet = object('outlet', {
    type: 'outlet',
    modelId: 'wall-outlet',
    scale: { x: 0.08, y: 0.02, z: 0.08 },
    position: { x: 0, y: 0, z: 1 },
  });
  assert.equal(
    analyzeProjectLayout(room, [floatingOutlet]).some(issue => issue.code === 'outlet_off_wall'),
    true
  );

  const attachedOutlet = {
    ...floatingOutlet,
    position: { x: 0, y: room.width / 2 - floatingOutlet.scale.y / 2, z: 1 },
  };
  assert.equal(
    analyzeProjectLayout(room, [attachedOutlet]).some(issue => issue.code === 'outlet_off_wall'),
    false
  );
});

test('snaps a wall outlet to the nearest wall with the correct orientation', () => {
  const outlet = object('outlet', {
    type: 'outlet',
    modelId: 'wall-outlet',
    scale: { x: 0.08, y: 0.02, z: 0.08 },
    position: { x: 2.2, y: 0.4, z: 1 },
    ports: [{ id: 'ac-out', anchor: { x: 0, y: -0.5, z: 0 } }],
  });

  const snappedRight = snapWallOutletToNearestWall(room, outlet);
  assert.equal(snappedRight.rotation.z, 270);
  assert.equal(snappedRight.position.x, 2.49);
  assert.ok(getPortWorldPosition(snappedRight, 'ac-out').x < snappedRight.position.x);
  assert.equal(
    analyzeProjectLayout(room, [snappedRight]).some(issue => issue.code === 'outlet_off_wall'),
    false
  );

  const snappedFront = snapWallOutletToNearestWall(room, {
    ...outlet,
    position: { x: 0.3, y: -1.8, z: 1 },
  });
  assert.equal(snappedFront.rotation.z, 180);
  assert.equal(snappedFront.position.y, -1.99);
  assert.ok(getPortWorldPosition(snappedFront, 'ac-out').y > snappedFront.position.y);

  const snappedLeft = snapWallOutletToNearestWall(room, {
    ...outlet,
    position: { x: -2.2, y: 0.4, z: 1 },
  });
  assert.equal(snappedLeft.rotation.z, 90);
  assert.ok(getPortWorldPosition(snappedLeft, 'ac-out').x > snappedLeft.position.x);

  const snappedBack = snapWallOutletToNearestWall(room, {
    ...outlet,
    position: { x: 0.3, y: 1.8, z: 1 },
  });
  assert.equal(snappedBack.rotation.z, 0);
  assert.ok(getPortWorldPosition(snappedBack, 'ac-out').y < snappedBack.position.y);
});

test('reports unsupported floating objects but accepts floor and tabletop support', () => {
  const desk = object('desk', {
    position: { x: 0, y: 0, z: 0.375 },
    scale: { x: 1.4, y: 0.7, z: 0.75 },
  });
  const tabletopDevice = object('tabletop', {
    position: { x: 0, y: 0, z: 0.875 },
    scale: { x: 0.5, y: 0.1, z: 0.25 },
  });
  const floatingDevice = object('floating', {
    position: { x: 1.5, y: 0, z: 1.5 },
    scale: { x: 0.2, y: 0.2, z: 0.2 },
  });

  const issues = analyzeProjectLayout(room, [desk, tabletopDevice, floatingDevice]);
  assert.equal(issues.some(issue => issue.id === 'floating:desk'), false);
  assert.equal(issues.some(issue => issue.id === 'floating:tabletop'), false);
  assert.equal(issues.some(issue => issue.id === 'floating:floating'), true);
});

test('drops an object to the highest support below it or to the floor', () => {
  const desk = object('desk', {
    position: { x: 0, y: 0, z: 0.375 },
    scale: { x: 1.4, y: 0.7, z: 0.75 },
  });
  const device = object('device', {
    position: { x: 0, y: 0, z: 1.5 },
    scale: { x: 0.2, y: 0.2, z: 0.2 },
  });
  const onDesk = snapObjectToSupport(room, device, [desk, device]);
  assert.equal(onDesk.position.z, 0.85);
  // Applying the suggested drop must actually clear the floating warning.
  assert.equal(
    analyzeProjectLayout(room, [desk, onDesk]).some(issue => issue.id === 'floating:device'),
    false
  );

  const offDesk = snapObjectToSupport(room, {
    ...device,
    position: { x: 1.5, y: 0, z: 1.5 },
  }, [desk, device]);
  assert.equal(offDesk.position.z, 0.1);
  assert.equal(
    analyzeProjectLayout(room, [desk, offDesk]).some(issue => issue.id === 'floating:device'),
    false
  );
});

test('does not snap onto an AABB-only support under a rotated object', () => {
  const support = object('support', {
    position: { x: 0, y: 0, z: 0.1 },
    rotation: { x: 0, y: 0, z: 45 },
    scale: { x: 2, y: 0.2, z: 0.2 },
  });
  const target = object('target', {
    position: { x: -0.212132, y: 0.212132, z: 1 },
    rotation: { x: 0, y: 0, z: 45 },
    scale: { x: 2, y: 0.2, z: 0.2 },
  });

  const snapped = snapObjectToSupport(room, target, [support, target]);
  assert.equal(snapped.position.z, 0.1);
});

test('a dragged object that ends up in the air drops to what is below it', () => {
  const desk = object('desk', { position: { x: 0, y: 0, z: 0.375 }, scale: { x: 1.4, y: 0.7, z: 0.75 } });
  const box = object('box', { position: { x: 1.6, y: 0, z: 0.2 }, scale: { x: 0.4, y: 0.4, z: 0.4 } });
  const monitor = (x, z = 0.945) => object('monitor', { position: { x, y: 0, z }, scale: { x: 0.54, y: 0.17, z: 0.39 } });
  const start = monitor(0).position;

  assert.equal(settleAfterDrag(room, monitor(0.3), [desk, box, monitor(0.3)], start), null, 'still on the desk');
  assert.equal(settleAfterDrag(room, monitor(0), [desk, box, monitor(0)], start), null, 'a click without moving changes nothing');
  assert.equal(settleAfterDrag(room, monitor(-1.6), [desk, box, monitor(-1.6)], start).position.z, 0.195, 'off the desk: onto the floor');
  assert.equal(settleAfterDrag(room, monitor(1.6), [desk, box, monitor(1.6)], start).position.z, 0.595, 'over a lower box: onto the box');

  const outlet = object('outlet', { modelId: 'wall-outlet', type: 'outlet', position: { x: 2.48, y: 0, z: 0.3 }, scale: { x: 0.08, y: 0.02, z: 0.08 } });
  assert.equal(settleAfterDrag(room, outlet, [outlet], { x: 2.48, y: 0.5, z: 0.3 }), null, 'wall outlets stay on the wall');
});


test('a device dragged at floor height onto a desk or stand is let go standing on its top', () => {
  const desk = object('desk', { category: 'furniture', modelId: 'office-desk', position: { x: 0, y: 0, z: 0.375 }, scale: { x: 1.4, y: 0.7, z: 0.75 } });
  const onFloor = (x, y = 0) => object('monitor', { category: 'display', position: { x, y, z: 0.195 }, scale: { x: 0.54, y: 0.17, z: 0.39 } });
  const start = { x: 2, y: 0, z: 0.195 };

  const lifted = settleAfterDrag(room, onFloor(0.2), [desk, onFloor(0.2)], start);
  assert.equal(lifted.position.z, 0.75 + 0.195, 'onto the desk top');
  assert.equal(lifted.position.x, 0.2);
  assert.deepEqual(analyzeProjectLayout(room, [desk, lifted]), []);

  // Only its edge inside the desk, the middle outside: left where it is.
  assert.equal(settleAfterDrag(room, onFloor(0.9), [desk, onFloor(0.9)], start), null);

  // The spot on the desk is taken: left where it is.
  const lamp = object('lamp', { category: 'lighting', position: { x: 0.2, y: 0, z: 0.95 }, scale: { x: 0.2, y: 0.2, z: 0.4 } });
  assert.equal(settleAfterDrag(room, onFloor(0.2), [desk, lamp, onFloor(0.2)], start), null);

  // Onto a stand on the desk: the higher top wins.
  const stand = object('stand', { category: 'accessory', modelId: 'monitor-stand', position: { x: -0.3, y: 0.2, z: 0.8 }, scale: { x: 0.3, y: 0.2, z: 0.1 } });
  const onStand = settleAfterDrag(room, onFloor(-0.3, 0.2), [desk, stand, onFloor(-0.3, 0.2)], start);
  assert.ok(Math.abs(onStand.position.z - (0.85 + 0.195)) < 1e-9, 'onto the stand top');

  // A tower is not a surface, and a desk does not climb onto a desk.
  const tower = object('tower', { category: 'computer', modelId: 'desktop-pc', position: { x: 1.5, y: 0, z: 0.25 }, scale: { x: 0.2, y: 0.45, z: 0.5 } });
  assert.equal(settleAfterDrag(room, onFloor(1.5), [tower, onFloor(1.5)], start), null);
  const secondDesk = object('desk-2', { category: 'furniture', modelId: 'office-desk', position: { x: 0.5, y: 0, z: 0.375 }, scale: { x: 1.4, y: 0.7, z: 0.75 } });
  assert.equal(settleAfterDrag(room, secondDesk, [desk, secondDesk], { x: 2, y: 0, z: 0.375 }), null);
});
