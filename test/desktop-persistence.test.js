import test from 'node:test';
import assert from 'node:assert/strict';

import {
  readBackupReminderState,
  recordBackupExport,
  snoozeBackupReminder,
} from '../src/domain/backup-reminder.js';
import { createFileArchiveStorage } from '../src/domain/file-archive.js';
import { readEyeProfile, writeEyeProfile } from '../src/domain/eye-height.js';
import { hasSeenGuide, markGuideSeen } from '../src/domain/onboarding.js';
import { dismissPhoneNotice, hasDismissedPhoneNotice } from '../src/domain/phone-notice.js';

function archive() {
  const files = new Map();
  const io = {
    files,
    async read(name) {
      return files.has(name) ? files.get(name) : null;
    },
    async write(name, text) {
      files.set(name, text);
    },
    async remove(name) {
      files.delete(name);
    },
  };
  return { io, storage: createFileArchiveStorage(io) };
}

test('eye height, the entry flag, and the phone notice stay put when the file write fails', async () => {
  const { io, storage } = archive();
  assert.equal(await writeEyeProfile(storage, {
    eyeHeightMetres: 1.15,
    posture: 'sitting',
    bifocals: false,
  }), true);
  assert.equal(await markGuideSeen(storage), true);
  assert.equal(await dismissPhoneNotice(storage), true);
  const eye = io.files.get('eye-height.json');
  const guide = io.files.get('guide-seen.txt');
  const phone = io.files.get('phone-notice.txt');

  io.write = async () => {
    throw new Error('disk full');
  };
  assert.equal(await writeEyeProfile(storage, {
    eyeHeightMetres: 1.4,
    posture: 'standing',
    bifocals: true,
  }), false);
  assert.equal(await markGuideSeen(storage), false);
  assert.equal(io.files.get('eye-height.json'), eye);
  assert.equal(readEyeProfile(storage).eyeHeightMetres, 1.15);
  assert.equal(readEyeProfile(storage).posture, 'sitting');
  assert.equal(io.files.get('guide-seen.txt'), guide);
  assert.equal(hasSeenGuide(storage), true);
  assert.equal(io.files.get('phone-notice.txt'), phone);
  assert.equal(hasDismissedPhoneNotice(storage), true);
});

test('a failed reminder write does not pretend the snooze was kept', async () => {
  const { io, storage } = archive();
  const now = new Date('2026-11-04T00:00:00.000Z');
  assert.equal(await recordBackupExport(() => storage, now), true);
  const saved = io.files.get('backup-reminder.json');

  io.write = async () => {
    throw new Error('disk full');
  };
  assert.equal(await snoozeBackupReminder(() => storage, now), false);
  assert.equal(io.files.get('backup-reminder.json'), saved);
  assert.deepEqual(readBackupReminderState(() => storage), {
    lastExportAt: now.toISOString(),
    snoozedUntil: null,
  });
  assert.equal(await recordBackupExport(() => storage, now), false);
});
