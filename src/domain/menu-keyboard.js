// Keyboard movement inside the "更多" menu. The caller drops disabled items
// before counting, so every index here is a control the user can press.

export function nextMenuIndex({ key, index, count }) {
  if (!Number.isInteger(count) || count <= 0) return null;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  if (key === 'ArrowDown') return index < 0 ? 0 : (index + 1) % count;
  if (key === 'ArrowUp') return index < 0 ? count - 1 : (index - 1 + count) % count;
  return null;
}

export function menuClosesOnKey(key) {
  return key === 'Escape' || key === 'Tab';
}
