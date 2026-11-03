import { installFileArchive, isDesktopApp } from '../domain/app-storage.js';
import { loadFileArchive, migrateBrowserArchive } from '../domain/file-archive.js';

// Web stays on localStorage. The desktop shell reads its files before React
// paints, then one-time-copies a project that this webview already had.
export async function bootAppStorage() {
  if (!isDesktopApp()) return { kind: 'browser' };
  try {
    const { bindDesktopExternalLinks, createTauriArchiveIo } = await import('./archive-io.js');
    const io = createTauriArchiveIo();
    const archive = await loadFileArchive(io);
    const migration = await migrateBrowserArchive(window.localStorage, archive);
    installFileArchive(archive);
    bindDesktopExternalLinks();
    const directory = await io.directory().catch(() => null);
    if (directory) console.info('DeskLab archive', directory);
    return { kind: 'file', migration, directory };
  } catch (error) {
    console.error('DeskLab could not open the local archive; this window will use browser storage.', error);
    return { kind: 'browser', error };
  }
}
