// Desktop and phone toolbars. Each control is built once by App and placed here,
// so the two layouts cannot drift apart (E8, E10).
export default function AppToolbar({
  isMobile,
  isRoomEditorOpen,
  onToggleRoom,
  titleLabel,
  roomFields,
  templatesButton,
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
          <button
            type="button"
            className="ui-button"
            aria-expanded={isRoomEditorOpen}
            aria-controls="toolbar-room"
            onClick={onToggleRoom}
          >
            房间尺寸
          </button>
          {connectionsButton}
          {resetViewButton}
          {rightPanelButton}
          {moreButton}
        </div>
        {isRoomEditorOpen && roomFields}
        {moreMenu}
        {importInput}
      </div>
    );
  }

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        {titleLabel}
        {roomFields}
        {templatesButton}
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
