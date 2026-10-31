import { CloseIcon } from './Icons.jsx';
import { useDialogFocus } from './useDialogFocus.js';
import { SHARE_LINK_WARN_LENGTH } from '../domain/share-link.js';

export default function ShareLinkDialog({ url, tooLong, onCopy, onClose }) {
  const dialogRef = useDialogFocus();
  return (
    <div
      className="modal-overlay"
      onClick={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="modal-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-link-title"
      >
        <div className="modal-header">
          <h3 id="share-link-title" className="modal-title">分享链接</h3>
          <button type="button" onClick={onClose} className="side-panel-close" aria-label="关闭分享链接" title="关闭">
            <CloseIcon />
          </button>
        </div>
        <div className="modal-body">
          <p className="panel-note">对方打开后只能查看设备和连线，不能改你的桌面，也不会覆盖对方自己保存的项目。</p>
          {tooLong && (
            <p className="desk-builder-notes">
              这条链接超过 {SHARE_LINK_WARN_LENGTH} 个字符，微信或有的浏览器可能打不开。可以改用“更多 → 导出备份”把文件发给对方。
            </p>
          )}
          <input className="ui-input share-link-field" readOnly value={url} aria-label="分享链接" onFocus={event => event.target.select()} />
          <button type="button" className="ui-button ui-button-primary share-link-copy" onClick={onCopy}>复制链接</button>
        </div>
      </div>
    </div>
  );
}
