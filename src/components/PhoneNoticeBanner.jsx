// Shown once on a phone: the computer web version is easier to use.
export default function PhoneNoticeBanner({ onCopyLink, onDismiss }) {
  return (
    <div className="draft-recovery-banner" role="region" aria-label="建议用电脑打开">
      <div>
        <strong>建议用电脑打开</strong>
        <span>为了您的正常使用体验，建议在电脑浏览器里打开 DeskLab：屏幕更大，摆放、拖动、连线和检查都更顺手。手机上也可以继续查看和简单修改。</span>
      </div>
      <div className="draft-recovery-actions">
        <button type="button" className="ui-button ui-button-primary" onClick={onCopyLink}>复制网址</button>
        <button type="button" className="ui-button" onClick={onDismiss}>知道了</button>
      </div>
    </div>
  );
}
