// Shown when a newer unsaved draft is sitting in this browser.
export default function DraftRecoveryBanner({ savedAt, onRestore, onExport, onDiscard }) {
  return (
    <div className="draft-recovery-banner" role="alert">
      <div>
        <strong>发现未保存的本地草稿</strong>
        <span>保存于 {new Date(savedAt).toLocaleString()}</span>
      </div>
      <div className="draft-recovery-actions">
        <button type="button" className="ui-button ui-button-primary" onClick={onRestore}>恢复草稿</button>
        <button type="button" className="ui-button" onClick={onExport}>导出草稿</button>
        <button type="button" className="ui-button" onClick={onDiscard}>放弃</button>
      </div>
    </div>
  );
}
