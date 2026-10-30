// A lazily loaded chunk that fails to download (flaky network, a deploy that
// replaced the file) rejects with a browser-specific message. Browsers also
// remember that failure for the page's lifetime, so only a reload retries it.
const CODE_DOWNLOAD_ERROR = /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk .* failed/i;

export function isCodeDownloadError(error) {
  return CODE_DOWNLOAD_ERROR.test(String(error?.message ?? ''));
}
