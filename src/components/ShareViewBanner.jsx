import { viewingSharedSentence } from '../domain/save-wording.js';

// A shared desk is on screen. Nothing here writes the visitor's save.
export default function ShareViewBanner({ onCopyIn, fileArchive = false }) {
  return (
    <div className="draft-recovery-banner" role="region" aria-label="只读分享">
      <div>
        <strong>正在查看分享的桌面</strong>
        <span>{viewingSharedSentence(fileArchive)}</span>
      </div>
      <div className="draft-recovery-actions">
        <button type="button" className="ui-button ui-button-primary" onClick={onCopyIn}>复制一份到我的项目</button>
      </div>
    </div>
  );
}
