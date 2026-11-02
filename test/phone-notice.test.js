import test from 'node:test';
import assert from 'node:assert/strict';

import { PHONE_MEDIA_QUERY, PHONE_NOTICE_STORAGE_KEY, dismissPhoneNotice, hasDismissedPhoneNotice } from '../src/domain/phone-notice.js';

const memoryStorage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
};

test('the phone notice is remembered once dismissed', () => {
  const storage = memoryStorage();
  assert.equal(hasDismissedPhoneNotice(storage), false);
  assert.equal(dismissPhoneNotice(storage), true);
  assert.equal(storage.getItem(PHONE_NOTICE_STORAGE_KEY), '1');
  assert.equal(hasDismissedPhoneNotice(storage), true);
});

test('without usable storage the notice still works, it just is not remembered', () => {
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(hasDismissedPhoneNotice(broken), false);
  assert.equal(dismissPhoneNotice(broken), false);
  assert.equal(hasDismissedPhoneNotice(undefined), false);
});

test('a phone is a small touch screen, not a narrow desktop window', () => {
  assert.match(PHONE_MEDIA_QUERY, /max-width: 899px/);
  assert.match(PHONE_MEDIA_QUERY, /pointer: coarse/);
});
