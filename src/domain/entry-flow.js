import { defaultCameraPose } from './camera-snapshot.js';
import { findModelTemplate } from './catalog.js';
import { buildTemplateScene } from './desk-templates.js';
import { refitLayoutToRoom } from './room-resize.js';

// First launch, before any desk: three sizes, one of them already selected.
// Floor size is what a person compares; height comes along with the preset.
export const ENTRY_ROOM_PRESETS = Object.freeze([
  Object.freeze({ id: 'compact', label: '小', detail: '4 × 3.5 米', length: 4, width: 3.5, height: 2.7 }),
  Object.freeze({ id: 'default', label: '默认', detail: '5 × 4 米', length: 5, width: 4, height: 3, isDefault: true }),
  Object.freeze({ id: 'wide', label: '大', detail: '6.5 × 5 米', length: 6.5, width: 5, height: 3 }),
]);

// The second step's preset. The button still says 用电竞桌; the template it
// places is 超宽 (id gaming), into the room the visitor just chose, not a
// new room of the template's own size.
export const ENTRY_PRESET_TEMPLATE_ID = 'gaming';

// What "a gaming desk" means for the product. The entry preset places the
// desk, tower, ultrawide, keyboard, mouse and router, and hangs the strip
// under the back of the desktop. Speakers and the console stay in the catalog.
export const CORE_ESPORTS_MODEL_IDS = Object.freeze([
  'desktop-pc',
  'ultrawide-monitor',
  'keyboard',
  'mouse',
  'speakers',
  'game-console',
  'router',
]);

export function defaultEntryPreset() {
  return ENTRY_ROOM_PRESETS.find(preset => preset.isDefault);
}

export function entryRoomFromPreset(id) {
  const preset = ENTRY_ROOM_PRESETS.find(item => item.id === id) ?? defaultEntryPreset();
  return { length: preset.length, width: preset.width, height: preset.height };
}

export function formatEntryRoom(room) {
  return `${room.length} × ${room.width} 米`;
}

// A returning project, a share link, a gallery desk, or a guide already
// finished skips the two entry screens. The email login is not a gate.
export function shouldShowEntry({
  shareView = false,
  galleryView = false,
  hasSavedProject = false,
  objectCount = 0,
  guideSeen = false,
  recoveringDraft = false,
} = {}) {
  if (shareView || galleryView || hasSavedProject || recoveringDraft || guideSeen) return false;
  return !(objectCount > 0);
}

export function placePresetInRoom(templateId, room) {
  const scene = buildTemplateScene(templateId);
  if (!scene) return { ok: false, reason: '没有这套预设' };
  const fitted = refitLayoutToRoom(scene.room, room, scene.objects);
  if (!fitted.valid) return { ok: false, reason: fitted.reason || '这间房放不下这张桌子' };
  return {
    ok: true,
    room: fitted.room,
    objects: fitted.objects,
    connections: scene.connections,
    camera: defaultCameraPose(fitted.room, fitted.objects),
  };
}

export function coreEsportsDevicesInCatalog() {
  return CORE_ESPORTS_MODEL_IDS.filter(modelId => findModelTemplate({ modelId }));
}
