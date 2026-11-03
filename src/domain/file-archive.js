import { BACKUP_REMINDER_STORAGE_KEY } from './backup-reminder.js';
import { COMMUNITY_POSTS_KEY, COMMUNITY_PROFILE_KEY } from './community-gallery.js';
import { PROJECT_DRAFT_STORAGE_KEY } from './draft-storage.js';
import { EYE_HEIGHT_STORAGE_KEY } from './eye-height.js';
import { LAYOUT_SCHEMES_STORAGE_KEY } from './layout-schemes.js';
import { PROJECT_BACKUP_STORAGE_KEY, PROJECT_STORAGE_KEY } from './local-project-store.js';
import { GUIDE_SEEN_STORAGE_KEY } from './onboarding.js';
import { PHONE_NOTICE_STORAGE_KEY } from './phone-notice.js';

// One file per key the app already stores. Names stay inside the app data
// directory; the desktop shell refuses anything else. The gallery keys are
// local to this device: a display name and the desks someone chose to keep.
export const ARCHIVE_FILES = Object.freeze({
  [PROJECT_STORAGE_KEY]: 'project.json',
  [PROJECT_BACKUP_STORAGE_KEY]: 'project-backup.json',
  [PROJECT_DRAFT_STORAGE_KEY]: 'project-draft.json',
  [BACKUP_REMINDER_STORAGE_KEY]: 'backup-reminder.json',
  [PHONE_NOTICE_STORAGE_KEY]: 'phone-notice.txt',
  [GUIDE_SEEN_STORAGE_KEY]: 'guide-seen.txt',
  [EYE_HEIGHT_STORAGE_KEY]: 'eye-height.json',
  [LAYOUT_SCHEMES_STORAGE_KEY]: 'layout-schemes.json',
  [COMMUNITY_PROFILE_KEY]: 'community-profile.json',
  [COMMUNITY_POSTS_KEY]: 'community-posts.json',
});

const ARCHIVE_WRITE_MESSAGE = '应用数据没有写到这台电脑上，项目未保存。请先导出项目文件备份。';

function writeError(cause) {
  const error = new Error(ARCHIVE_WRITE_MESSAGE);
  error.code = 'archive_write_failed';
  error.cause = cause;
  return error;
}

// `io.read/write/remove` talk to the app data directory. getItem stays in
// memory so the rest of the app can keep its synchronous reads; setItem
// resolves only after the file is on disk, and rolls the memory back if the
// write fails.
export function createFileArchiveStorage(io, memory = new Map()) {
  const tails = new Map();

  function enqueue(key, task) {
    const previous = tails.get(key) ?? Promise.resolve();
    const result = previous.then(task, task);
    tails.set(key, result.then(() => undefined, () => undefined));
    result.catch(() => undefined);
    return result;
  }

  return {
    getItem(key) {
      return memory.has(key) ? memory.get(key) : null;
    },
    setItem(key, value) {
      const text = String(value);
      const had = memory.has(key);
      const previous = had ? memory.get(key) : null;
      memory.set(key, text);
      const name = ARCHIVE_FILES[key];
      if (!name) return undefined;
      return enqueue(key, async () => {
        try {
          await io.write(name, text);
        } catch (cause) {
          if (memory.get(key) === text) {
            if (had) memory.set(key, previous);
            else memory.delete(key);
          }
          throw writeError(cause);
        }
      });
    },
    removeItem(key) {
      const had = memory.has(key);
      const previous = had ? memory.get(key) : null;
      memory.delete(key);
      const name = ARCHIVE_FILES[key];
      if (!name) return undefined;
      return enqueue(key, async () => {
        try {
          await io.remove(name);
        } catch (cause) {
          if (!memory.has(key) && had) memory.set(key, previous);
          throw writeError(cause);
        }
      });
    },
    async flush() {
      await Promise.all([...tails.values()]);
    },
  };
}

export async function loadFileArchive(io) {
  const memory = new Map();
  for (const [key, name] of Object.entries(ARCHIVE_FILES)) {
    const text = await io.read(name);
    if (typeof text === 'string') memory.set(key, text);
  }
  return createFileArchiveStorage(io, memory);
}

// Copy a browser save into the file archive once, when the archive has no
// project yet. An archive that already has a project is left alone. The
// browser copy stays where it is.
export async function migrateBrowserArchive(browserStorage, fileStorage) {
  let browserProject;
  try {
    browserProject = browserStorage?.getItem?.(PROJECT_STORAGE_KEY) ?? null;
  } catch {
    return { migrated: false, reason: 'browser_unavailable' };
  }
  if (browserProject == null || browserProject === '') {
    return { migrated: false, reason: 'browser_empty' };
  }
  if (fileStorage.getItem(PROJECT_STORAGE_KEY) != null) {
    return { migrated: false, reason: 'file_exists' };
  }

  const keys = Object.keys(ARCHIVE_FILES).filter(key => key !== PROJECT_STORAGE_KEY);
  keys.push(PROJECT_STORAGE_KEY);
  for (const key of keys) {
    let value;
    try {
      value = browserStorage.getItem(key);
    } catch {
      value = null;
    }
    if (value != null) await fileStorage.setItem(key, value);
  }
  return { migrated: true };
}
