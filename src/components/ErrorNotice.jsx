import { useEffect, useState } from 'react';

import { formatErrorReport, shouldReportError } from '../domain/error-report.js';

// Tells the user when something unexpected broke, without sending anything
// anywhere: saved desks are safe, refreshing usually helps, and the error
// text can be copied to report it.
export default function ErrorNotice() {
  const [report, setReport] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const show = error => {
      if (!shouldReportError(error)) return;
      setCopied(false);
      setReport(formatErrorReport(error, { url: window.location.href, userAgent: navigator.userAgent }));
    };
    const onError = event => show(event.error ?? event.message);
    const onRejection = event => show(event.reason);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  if (!report) return null;
  return (
    <div className="draft-recovery-banner error-notice" role="alert" aria-label="出错提示">
      <div>
        <strong>页面出了点问题</strong>
        <span>可以刷新页面再试，你保存过的桌面不受影响。如果反复出现，请复制错误信息告诉我们。</span>
      </div>
      <div className="draft-recovery-actions">
        <button
          type="button"
          className="ui-button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(report);
              setCopied(true);
            } catch {
              window.prompt('复制下面的错误信息：', report);
            }
          }}
        >
          {copied ? '已复制' : '复制错误信息'}
        </button>
        <button type="button" className="ui-button ui-button-primary" onClick={() => window.location.reload()}>刷新页面</button>
        <button type="button" className="ui-button" onClick={() => setReport(null)}>关闭</button>
      </div>
    </div>
  );
}
