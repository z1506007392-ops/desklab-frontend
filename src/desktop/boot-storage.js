import { installFileArchive, isDesktopApp } from '../domain/app-storage.js';
import { ARCHIVE_FILE_LABELS, loadFileArchive, migrateBrowserArchive } from '../domain/file-archive.js';

const OPEN_FAILED = '没能打开这台电脑上的存档。这次的修改只留在当前窗口，不会写进应用数据。请用「更多 → 导出备份」留一份文件。';

let bootNotice = '';

// Empty on the web, and when every file opened. The UI shows this once.
export function storageBootNotice() {
  return bootNotice;
}

export function describeArchiveBoot({ failed = false, unreadableFiles = [] } = {}) {
  if (failed) return OPEN_FAILED;
  const labels = [];
  for (const name of unreadableFiles) {
    const label = ARCHIVE_FILE_LABELS[name];
    if (label && !labels.includes(label)) labels.push(label);
  }
  if (!labels.length) return '';
  return `有存档没能读出来（${labels.join('、')}）。其余的还在，没有用空白盖掉。请用「更多 → 导出备份」留一份文件。`;
}

// Web stays on localStorage. The desktop shell reads its files before React
// paints, then one-time-copies a project that this webview already had.
export async function bootAppStorage() {
  bootNotice = '';
  if (!isDesktopApp()) return { kind: 'browser' };
  try {
    const { bindDesktopExternalLinks, createTauriArchiveIo } = await import('./archive-io.js');
    const io = createTauriArchiveIo();
    const archive = await loadFileArchive(io);
    const migration = await migrateBrowserArchive(window.localStorage, archive);
    installFileArchive(archive);
    bindDesktopExternalLinks();
    bootNotice = describeArchiveBoot({ unreadableFiles: archive.unreadableFiles });
    const directory = await io.directory().catch(() => null);
    if (directory) console.info('DeskLab 存档目录', directory);
    return { kind: 'file', migration, directory };
  } catch (error) {
    console.error('DeskLab 没能打开本机存档', error);
    bootNotice = describeArchiveBoot({ failed: true });
    return { kind: 'browser', error };
  }
}
