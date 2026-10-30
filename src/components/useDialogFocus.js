import { useEffect, useRef } from 'react';

const FOCUSABLE = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

// Where Tab should go. null means the browser's normal order is fine.
export function dialogTabTarget({ shiftKey, activeIsDialog, activeIsFirst, activeIsLast, inside }) {
  if (shiftKey) {
    if (activeIsDialog || activeIsFirst || !inside) return 'last';
    return null;
  }
  if (activeIsDialog || activeIsLast || !inside) return 'first';
  return null;
}

export function focusableIn(dialog) {
  return [...dialog.querySelectorAll(FOCUSABLE)].filter(element => !element.closest('[aria-hidden="true"]'));
}

// Keep keyboard focus inside a dialog, and put it back on the opener when the
// dialog goes away. The dialog element itself needs tabIndex={-1}.
export function useDialogFocus() {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return undefined;
    const previouslyFocused = document.activeElement;
    dialog.focus({ preventScroll: true });

    const onKeyDown = (event) => {
      if (event.key !== 'Tab') return;
      const items = focusableIn(dialog);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const active = document.activeElement;
      const target = dialogTabTarget({
        shiftKey: event.shiftKey,
        activeIsDialog: active === dialog,
        activeIsFirst: active === items[0],
        activeIsLast: active === items[items.length - 1],
        inside: dialog.contains(active),
      });
      if (!target) return;
      event.preventDefault();
      (target === 'first' ? items[0] : items[items.length - 1]).focus();
    };

    dialog.addEventListener('keydown', onKeyDown);
    return () => {
      dialog.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, []);
  return ref;
}
