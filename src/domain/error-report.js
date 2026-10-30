// Unexpected errors: decide which ones to tell the user about and build the
// text for "复制错误信息". Nothing is sent anywhere; the user decides whether
// to share the copied text.

// Errors the app already handles or that do not affect the user:
// - ResizeObserver loop notices are benign browser warnings;
// - "Could not load ..." is a 3D model download, which falls back to a
//   simple shape (and R3F reports even caught errors globally);
// - aborted requests are cancellations the user asked for.
const IGNORED = [
  /^ResizeObserver loop/,
  /^Could not load /,
  /AbortError|The user aborted a request|signal is aborted/i,
];

export function shouldReportError(error) {
  const message = String(error?.message ?? error ?? '');
  if (!message) return false;
  return !IGNORED.some(pattern => pattern.test(message) || pattern.test(String(error?.name ?? '')));
}

export function formatErrorReport(error, { url = '', userAgent = '', time = new Date() } = {}) {
  const message = String(error?.message ?? error ?? '未知错误');
  const stack = typeof error?.stack === 'string' ? error.stack.split('\n').slice(0, 8).join('\n') : '';
  return [
    'DeskLab 错误信息',
    `时间：${time.toISOString()}`,
    `页面：${url}`,
    `浏览器：${userAgent}`,
    `错误：${message}`,
    stack ? `位置：\n${stack}` : '',
  ].filter(Boolean).join('\n');
}
