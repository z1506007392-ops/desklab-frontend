import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BACKUP_REMINDER_INTERVAL_MS,
  BACKUP_REMINDER_STORAGE_KEY,
  readBackupReminderState,
  recordBackupExport,
  shouldRemindBackup,
  snoozeBackupReminder,
} from '../src/domain/backup-reminder.js';

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
}

const now = new Date('2026-10-30T08:00:00.000Z');
const daysLater = days => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
const empty = { lastExportAt: null, snoozedUntil: null };

test('a save with devices reminds a user who never exported', () => {
  assert.equal(shouldRemindBackup({ objectCount: 3, state: empty, now }), true);
});

test('an empty room is not worth a reminder', () => {
  assert.equal(shouldRemindBackup({ objectCount: 0, state: empty, now }), false);
});

test('a recent export quiets the reminder for a week', () => {
  const storage = new MemoryStorage();
  recordBackupExport(() => storage, now);
  const state = readBackupReminderState(() => storage);
  assert.equal(shouldRemindBackup({ objectCount: 3, state, now: daysLater(6.9) }), false);
  assert.equal(shouldRemindBackup({ objectCount: 3, state, now: daysLater(7) }), true);
});

test('"later" quiets the reminder for a week, and an export clears the snooze', () => {
  const storage = new MemoryStorage();
  snoozeBackupReminder(() => storage, now);
  let state = readBackupReminderState(() => storage);
  assert.equal(shouldRemindBackup({ objectCount: 3, state, now: daysLater(6) }), false);
  assert.equal(shouldRemindBackup({ objectCount: 3, state, now: daysLater(7) }), true);

  recordBackupExport(() => storage, daysLater(1));
  state = readBackupReminderState(() => storage);
  assert.deepEqual(state, { lastExportAt: daysLater(1).toISOString(), snoozedUntil: null });
});

test('snoozing keeps the last export time', () => {
  const storage = new MemoryStorage();
  recordBackupExport(() => storage, now);
  snoozeBackupReminder(() => storage, daysLater(8));
  assert.deepEqual(readBackupReminderState(() => storage), {
    lastExportAt: now.toISOString(),
    snoozedUntil: new Date(daysLater(8).getTime() + BACKUP_REMINDER_INTERVAL_MS).toISOString(),
  });
});

test('missing, damaged, or blocked storage falls back to reminding, never throws', () => {
  const storage = new MemoryStorage();
  assert.deepEqual(readBackupReminderState(() => storage), empty);
  storage.setItem(BACKUP_REMINDER_STORAGE_KEY, '{oops');
  assert.deepEqual(readBackupReminderState(() => storage), empty);
  storage.setItem(BACKUP_REMINDER_STORAGE_KEY, JSON.stringify({ lastExportAt: 5, snoozedUntil: 'not a date' }));
  const state = readBackupReminderState(() => storage);
  assert.equal(shouldRemindBackup({ objectCount: 1, state, now }), true);

  const blocked = () => { throw new DOMException('denied', 'SecurityError'); };
  assert.deepEqual(readBackupReminderState(blocked), empty);
  assert.doesNotThrow(() => recordBackupExport(blocked, now));
  assert.doesNotThrow(() => snoozeBackupReminder(blocked, now));
});
