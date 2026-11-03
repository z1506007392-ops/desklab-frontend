// A gallery desk is on screen. Nothing here writes the visitor's save.
export default function GalleryViewBanner({ title, onBack, onCopyIn }) {
  return (
    <div className="draft-recovery-banner" role="region" aria-label="社区图库">
      <div>
        <strong>正在查看图库里的桌子</strong>
        <span>{title ? `${title}。` : ''}只能转视角和查看。复制之后才能改，你原来的桌面还在。</span>
      </div>
      <div className="draft-recovery-actions">
        <button type="button" className="ui-button" onClick={onBack}>返回我的桌面</button>
        <button type="button" className="ui-button ui-button-primary" onClick={onCopyIn}>复制到我的项目</button>
      </div>
    </div>
  );
}
