// The saved project could not be read, so saving stays locked.
export default function CorruptSaveBanner({ busy, onRecover }) {
  return (
    <div className="draft-recovery-banner" role="alert">
      <div>
        <strong>本机保存的项目无法读取，保存已锁定</strong>
        <span>可尝试恢复上一次成功保存的版本；本地未保存草稿不会被删除。</span>
      </div>
      <div className="draft-recovery-actions">
        <button
          type="button"
          className="ui-button ui-button-danger"
          onClick={onRecover}
          disabled={busy}
        >
          {busy ? '正在恢复…' : '恢复上一版本'}
        </button>
      </div>
    </div>
  );
}
