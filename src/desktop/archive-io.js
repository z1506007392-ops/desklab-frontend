// Talks to the Rust side, which is the only thing allowed to touch the
// app data directory. Imported only after the shell is detected, so the
// web build does not need it on the first screen.
export function createTauriArchiveIo() {
  let invokePromise;
  const invoke = async (command, args) => {
    if (!invokePromise) {
      invokePromise = import('@tauri-apps/api/core').then(module => module.invoke);
    }
    const call = await invokePromise;
    return call(command, args);
  };
  return {
    read(name) {
      return invoke('archive_read', { name });
    },
    write(name, contents) {
      return invoke('archive_write', { name, contents });
    },
    remove(name) {
      return invoke('archive_remove', { name });
    },
    directory() {
      return invoke('archive_directory');
    },
  };
}

export const DESKTOP_LINK_FAILED = '这个链接没能交给系统浏览器。请复制地址，再在浏览器里打开。';

// License and model links should open in the system browser, not a second
// webview. Same-origin links (none of the in-app controls) stay as they are.
export function bindDesktopExternalLinks() {
  document.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest('a[href]');
    if (!link) return;
    let url;
    try {
      url = new URL(link.href, window.location.href);
    } catch {
      return;
    }
    if (url.origin === window.location.origin) return;
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return;
    event.preventDefault();
    import('@tauri-apps/plugin-opener')
      .then(module => module.openUrl(url.href))
      .catch(error => {
        console.error('DeskLab 没能打开系统浏览器', error);
        document.dispatchEvent(new CustomEvent('desklab-notice', { detail: DESKTOP_LINK_FAILED }));
      });
  });
}
