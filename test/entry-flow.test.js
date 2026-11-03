import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CORE_ESPORTS_MODEL_IDS,
  ENTRY_PRESET_TEMPLATE_ID,
  ENTRY_ROOM_PRESETS,
  coreEsportsDevicesInCatalog,
  defaultEntryPreset,
  entryRoomFromPreset,
  placePresetInRoom,
  shouldShowEntry,
} from '../src/domain/entry-flow.js';
import { isHungUnderDesk } from '../src/domain/geometry.js';

test('the first screen offers three room sizes and starts on the default', () => {
  assert.deepEqual(ENTRY_ROOM_PRESETS.map(preset => preset.label), ['小', '默认', '大']);
  assert.deepEqual(entryRoomFromPreset(defaultEntryPreset().id), { length: 5, width: 4, height: 3 });
  assert.deepEqual(entryRoomFromPreset('wide'), { length: 6.5, width: 5, height: 3 });
  assert.deepEqual(entryRoomFromPreset('missing'), entryRoomFromPreset('default'));
});

test('entry is only for a first visit with an empty unsaved room', () => {
  assert.equal(shouldShowEntry({}), true);
  assert.equal(shouldShowEntry({ hasSavedProject: true }), false);
  assert.equal(shouldShowEntry({ objectCount: 1 }), false);
  assert.equal(shouldShowEntry({ guideSeen: true }), false);
  assert.equal(shouldShowEntry({ shareView: true }), false);
  assert.equal(shouldShowEntry({ galleryView: true }), false);
  assert.equal(shouldShowEntry({ recoveringDraft: true }), false);
});

test('the esports preset keeps the room the visitor chose and puts a desk in it', () => {
  const room = { length: 5, width: 4, height: 3 };
  const placed = placePresetInRoom(ENTRY_PRESET_TEMPLATE_ID, room);
  assert.equal(placed.ok, true);
  assert.deepEqual(placed.room, room);
  assert.equal(placed.objects.some(object => object.modelId === 'office-desk'), true);
  assert.equal(placed.objects.some(object => object.modelId === 'desktop-pc'), true);
  assert.equal(placed.objects.some(object => object.modelId === 'ultrawide-monitor'), true);
  assert.ok(placed.connections.length > 0);
  assert.ok(placed.camera?.position);
});

test('the entry desk places a keyboard and mouse, hangs the strip, and leaves speakers and the console in the catalog', () => {
  assert.deepEqual(coreEsportsDevicesInCatalog(), [...CORE_ESPORTS_MODEL_IDS]);
  const placed = placePresetInRoom(ENTRY_PRESET_TEMPLATE_ID, { length: 5, width: 4, height: 3 });
  assert.equal(placed.ok, true);
  const placedIds = new Set(placed.objects.map(object => object.modelId));
  assert.equal(placedIds.has('keyboard'), true);
  assert.equal(placedIds.has('mouse'), true);
  assert.equal(placedIds.has('router'), true);
  assert.equal(placedIds.has('laptop-15'), false);
  assert.equal(placedIds.has('speakers'), false);
  assert.equal(placedIds.has('game-console'), false);
  const desk = placed.objects.find(object => object.modelId === 'office-desk');
  const strips = placed.objects.filter(object => object.modelId === 'power-strip');
  assert.ok(strips.length >= 1);
  for (const strip of strips) {
    assert.equal(isHungUnderDesk(strip, desk), true);
    assert.ok(strip.position.z > 0.4);
  }
});
