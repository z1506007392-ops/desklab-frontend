// "关于与隐私": what DeskLab keeps, where, and what the AI feature sends.
// Keep it true to the code: saves are only in localStorage, the AI request
// is the scene summary plus the user's goal, and there is no analytics.
export default function AboutDialog({ onClose }) {
  return (
    <div
      className="modal-overlay"
      onClick={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-container wiring-report" role="dialog" aria-modal="true" aria-labelledby="about-title">
        <div className="modal-header">
          <h3 id="about-title" className="modal-title">关于与隐私</h3>
          <button type="button" onClick={onClose} className="side-panel-close" aria-label="关闭关于与隐私" title="关闭">×</button>
        </div>
        <div className="modal-body about-dialog">
          <p>DeskLab 帮你在 3D 里摆好桌面、理清线缆，检查用电和走线问题，并给出改进建议。不需要注册账号。</p>

          <h4 className="template-section-title">你的桌面存在哪里</h4>
          <ul>
            <li>项目只保存在你这台设备的浏览器里，不会上传到我们的服务器。</li>
            <li>清理浏览器数据、换浏览器或换设备后就找不到了。请用“更多 → 导出备份”保存一份文件，需要时用“导入备份”恢复。</li>
          </ul>

          <h4 className="template-section-title">使用 AI 建议时</h4>
          <ul>
            <li>只有你点“让 AI 看看”时，才会把桌面布局发送给 DeepSeek 的 AI 服务处理：房间大小、设备种类和位置、连线，以及你给设备起的名字和填写的“想怎么改”。</li>
            <li>不要在设备名称或要求里填写个人信息。</li>
            <li>AI 给出的建议都会先经过 DeskLab 的规则检查，只显示不会让布局变差的改动，应用前可以先预览，应用后可以撤销。</li>
          </ul>

          <h4 className="template-section-title">我们不做的事</h4>
          <ul>
            <li>不收集姓名、手机号等个人信息，不使用统计或广告追踪。</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
