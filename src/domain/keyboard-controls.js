export function getObjectKeyboardUpdate(object, event, step = 0.1) {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;

  const position = object?.position;
  if (!position) return null;
  const { x, y, z } = position;
  if (event.key === 'ArrowLeft') return { position: { x: x + step, y, z } };
  if (event.key === 'ArrowRight') return { position: { x: x - step, y, z } };
  if (event.key === 'ArrowUp') return { position: { x, y: y + step, z } };
  if (event.key === 'ArrowDown') return { position: { x, y: y - step, z } };
  if (event.code === 'Space') {
    return { position: { x, y, z: z + (event.shiftKey ? -step : step) } };
  }

  const key = event.key.toLowerCase();
  const rotationZ = object.rotation?.z || 0;
  if (key === 'q') return { rotation: { z: (rotationZ + 15) % 360 } };
  if (key === 'e') return { rotation: { z: (rotationZ - 15 + 360) % 360 } };
  return null;
}

/**
 * Whether a key press should be left alone by the selected-device shortcuts
 * (arrows, Space, Q/E, Delete, Ctrl+D). `target` describes where the key went:
 * { typing } for text fields and selects, { inOverlay } for anything inside a
 * dialog or menu, { pressable } for buttons, links and tabs. Keys never reach
 * the device while a dialog is open, and Space or Enter on a focused button
 * must still press that button.
 */
export function shouldIgnoreDeviceShortcut(event, target = {}, { dialogOpen = false } = {}) {
  if (dialogOpen || target.typing || target.inOverlay) return true;
  const presses = event.key === 'Enter' || event.key === ' ' || event.code === 'Space';
  return presses && Boolean(target.pressable);
}

// The DOM facts shouldIgnoreDeviceShortcut needs about a key event's target.
export function describeKeyTarget(element) {
  if (!element || typeof element.closest !== 'function') return {};
  return {
    typing: Boolean(element.closest('input, textarea, select, [contenteditable="true"]')),
    inOverlay: Boolean(element.closest('[role="dialog"], [role="menu"]')),
    pressable: Boolean(element.closest('button, a[href], [role="button"], [role="tab"], [role="menuitem"], [role="menuitemcheckbox"]')),
  };
}
