// Saves live only in this browser, so clearing site data or switching
// devices loses them. After a save, remind the user to export a backup file
// when they have never exported one or the last one is a week old; "later"
// quiets the reminder for a week.
export const BACKUP_REMINDER_STORAGE_KEY = 'desklab.backup-reminder.v1';
export const BACKUP_REMINDER_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

export function shouldRemindBackup({ objectCount, state, now }) {
  if (!(objectCount > 0)) return false;
  const time = now.getTime();
  const snoozedUntil = Date.parse(state.snoozedUntil);
  if (Number.isFinite(snoozedUntil) && time < snoozedUntil) return false;
  const lastExportAt = Date.parse(state.lastExportAt);
  if (!Number.isFinite(lastExportAt)) return true;
  return time - lastExportAt >= BACKUP_REMINDER_INTERVAL_MS;
}

// Storage failures only mean the reminder may show again; they never block
// saving or exporting, so every access falls back quietly.
export function readBackupReminderState(getStorage) {
  try {
    const parsed = JSON.parse(getStorage().getItem(BACKUP_REMINDER_STORAGE_KEY));
    return {
      lastExportAt: typeof parsed?.lastExportAt === 'string' ? parsed.lastExportAt : null,
      snoozedUntil: typeof parsed?.snoozedUntil === 'string' ? parsed.snoozedUntil : null,
    };
  } catch {
    return { lastExportAt: null, snoozedUntil: null };
  }
}

export function recordBackupExport(getStorage, now) {
  writeState(getStorage, { lastExportAt: now.toISOString(), snoozedUntil: null });
}

export function snoozeBackupReminder(getStorage, now) {
  writeState(getStorage, {
    ...readBackupReminderState(getStorage),
    snoozedUntil: new Date(now.getTime() + BACKUP_REMINDER_INTERVAL_MS).toISOString(),
  });
}

function writeState(getStorage, state) {
  try {
    getStorage().setItem(BACKUP_REMINDER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // See readBackupReminderState.
  }
}
