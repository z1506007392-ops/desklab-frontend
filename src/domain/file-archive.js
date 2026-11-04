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

// Shown to the person. A read that throws does not become an empty project:
// the project key is filled with this text so load/save refuse to overwrite
// the file that is still on disk.
export const UNREADABLE_PROJECT_TEXT = '{"desklabUnreadable":true}';

// Chinese names for the boot notice. Raw file names stay out of the UI.
export const ARCHIVE_FILE_LABELS = Object.freeze({
  'project.json': '项目',
  'project-backup.json': '上一版项目',
  'project-draft.json': '草稿',
  'backup-reminder.json': '备份提醒',
  'phone-notice.txt': '手机提示',
  'guide-seen.txt': '进门记录',
  'eye-height.json': '眼睛高度',
  'layout-schemes.json': '摆法',
  'community-profile.json': '图库显示名',
  'community-posts.json': '图库桌子',
});

const WRITE_FAILURE = Object.freeze({
  [PROJECT_STORAGE_KEY]: '应用数据没有写到这台电脑上，项目未保存。请先导出项目文件备份。',
  [PROJECT_BACKUP_STORAGE_KEY]: '上一版项目没有写到这台电脑上。请先导出项目文件备份。',
  [PROJECT_DRAFT_STORAGE_KEY]: '本地草稿没有写到这台电脑上。请尽快保存项目或导出备份。',
  [BACKUP_REMINDER_STORAGE_KEY]: '备份提醒没有记到这台电脑上。',
  [PHONE_NOTICE_STORAGE_KEY]: '这次关闭没有记到这台电脑上。',
  [GUIDE_SEEN_STORAGE_KEY]: '进门记录没有写到这台电脑上。',
  [EYE_HEIGHT_STORAGE_KEY]: '眼睛高度没有写到这台电脑上。',
  [LAYOUT_SCHEMES_STORAGE_KEY]: '摆法没有写到这台电脑上。',
  [COMMUNITY_PROFILE_KEY]: '图库显示名没有写到这台电脑上。',
  [COMMUNITY_POSTS_KEY]: '桌子没有放进这台电脑的图库。请先导出桌子文件。',
});

function plainChinese(cause) {
  const text = typeof cause === 'string' ? cause : cause?.message;
  if (typeof text !== 'string') return '';
  const trimmed = text.trim();
  if (!trimmed || /[A-Za-z]{3,}/.test(trimmed)) return '';
  return trimmed;
}

function writeError(cause, key) {
  const fallback = WRITE_FAILURE[key] || '应用数据没有写到这台电脑上。请先导出项目文件备份。';
  const specific = plainChinese(cause);
  const message = specific.includes('存储空间') || specific === '存档太大' ? specific : fallback;
  const error = new Error(message);
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
          throw writeError(cause, key);
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
          throw writeError(cause, key);
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
  const unreadableFiles = [];
  for (const [key, name] of Object.entries(ARCHIVE_FILES)) {
    try {
      const text = await io.read(name);
      if (typeof text === 'string') {
        memory.set(key, text);
      } else if (text != null) {
        unreadableFiles.push(name);
        if (key === PROJECT_STORAGE_KEY) memory.set(key, UNREADABLE_PROJECT_TEXT);
      }
    } catch {
      unreadableFiles.push(name);
      if (key === PROJECT_STORAGE_KEY) memory.set(key, UNREADABLE_PROJECT_TEXT);
    }
  }
  const storage = createFileArchiveStorage(io, memory);
  storage.unreadableFiles = unreadableFiles;
  return storage;
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
