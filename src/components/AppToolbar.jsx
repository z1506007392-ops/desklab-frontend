// Desktop and phone toolbars. Each control is built once by App and placed here,
// so the two layouts cannot drift apart (E8, E10). Room size is not one of
// these controls: the first visit asks for it, and later edits live in 设置.
export default function AppToolbar({
  isMobile,
  titleLabel,
  templatesButton,
  galleryButton,
  undoButton,
  redoButton,
  resetViewButton,
  connectionsButton,
  layoutButton,
  wiringButton,
  recommendButton,
  moreButton,
  leftPanelButton,
  rightPanelButton,
  unsavedIndicator,
  saveButton,
  moreMenu,
  importInput,
}) {
  if (isMobile) {
    return (
      <div className="toolbar toolbar-compact">
        <div className="toolbar-row">
          {titleLabel}
          {unsavedIndicator}
          <div className="toolbar-cluster toolbar-row-end">{undoButton}{redoButton}{saveButton}</div>
        </div>
        <div className="toolbar-strip" role="group" aria-label="工具">
          {leftPanelButton}
          {recommendButton}
          {layoutButton}
          {wiringButton}
          {templatesButton}
          {galleryButton}
          {connectionsButton}
          {resetViewButton}
          {rightPanelButton}
          {moreButton}
        </div>
        {moreMenu}
        {importInput}
      </div>
    );
  }

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        {titleLabel}
        {templatesButton}
        {galleryButton}
      </div>
      <div className="toolbar-group global-actions">
        <div className="toolbar-cluster">{undoButton}{redoButton}{resetViewButton}</div>
        <div className="toolbar-cluster">{connectionsButton}{layoutButton}{wiringButton}{recommendButton}</div>
        <div className="toolbar-cluster">{moreButton}{leftPanelButton}{rightPanelButton}</div>
        <div className="toolbar-cluster">{unsavedIndicator}{saveButton}</div>
      </div>
      {moreMenu}
      {importInput}
    </div>
  );
}
