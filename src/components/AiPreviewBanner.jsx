// The preview of an AI suggestion, before the user applies or cancels it.
export default function AiPreviewBanner({ title, onApply, onCancel }) {
  return (
    <div className="draft-recovery-banner" role="region" aria-label="AI 预览">
      <div>
        <strong>预览 AI 建议：{title}</strong>
        <span>高亮的设备会被调整，确认后才会改动你的桌面。</span>
      </div>
      <div className="draft-recovery-actions">
        <button type="button" className="ui-button ui-button-primary" onClick={onApply}>应用</button>
        <button type="button" className="ui-button" onClick={onCancel}>取消</button>
      </div>
    </div>
  );
}
