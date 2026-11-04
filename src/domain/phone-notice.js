import { followStorageWrite } from './storage-write.js';

// On a phone DeskLab works, but dragging, wiring and the checks are much
// easier on a computer's larger screen (owner's call, E59: no further
// phone-specific polish). A phone visitor is told so once; dismissing it is
// remembered in this browser.
export const PHONE_NOTICE_STORAGE_KEY = 'desklab.phone-notice-dismissed.v1';

// A small touch screen: a phone (or a small tablet), not a narrow desktop window.
export const PHONE_MEDIA_QUERY = '(max-width: 899px) and (pointer: coarse)';

export function hasDismissedPhoneNotice(storage) {
  try {
    return storage?.getItem(PHONE_NOTICE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissPhoneNotice(storage) {
  try {
    return followStorageWrite(storage?.setItem(PHONE_NOTICE_STORAGE_KEY, '1'), () => true, () => false);
  } catch {
    return false;
  }
}
