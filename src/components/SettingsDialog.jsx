import { CloseIcon } from './Icons.jsx';
import { useDialogFocus } from './useDialogFocus.js';

// Room size after the first visit. The main toolbar does not carry these fields.
export default function SettingsDialog({
  length,
  width,
  height,
  disabled,
  onChange,
  onUpdate,
  onRepick,
  onClose,
}) {
  const dialogRef = useDialogFocus();
  const setField = (key, value) => onChange({ length, width, height, [key]: value });

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
        className="modal-container settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <div className="modal-header">
          <h3 id="settings-title" className="modal-title">设置</h3>
          <button type="button" onClick={onClose} className="side-panel-close" aria-label="关闭设置" title="关闭"><CloseIcon /></button>
        </div>
        <div className="modal-body">
          <p className="start-guide-text">房间大小在这里改。桌子和设备会跟着墙一起挪。</p>
          <div className="settings-room-fields">
            <label htmlFor="room-length">长:</label>
            <input
              id="room-length"
              type="number"
              min="0.1"
              step="0.1"
              className="ui-input"
              value={length}
              onChange={event => setField('length', Number(event.target.value))}
              disabled={disabled}
            />
            <label htmlFor="room-width">宽:</label>
            <input
              id="room-width"
              type="number"
              min="0.1"
              step="0.1"
              className="ui-input"
              value={width}
              onChange={event => setField('width', Number(event.target.value))}
              disabled={disabled}
            />
            <label htmlFor="room-height">高:</label>
            <input
              id="room-height"
              type="number"
              min="0.1"
              step="0.1"
              className="ui-input"
              value={height}
              onChange={event => setField('height', Number(event.target.value))}
              disabled={disabled}
            />
          </div>
          <div className="settings-room-actions">
            <button type="button" className="ui-button ui-button-primary" onClick={onUpdate} disabled={disabled}>更新房间</button>
            <button type="button" className="ui-button" onClick={onRepick} disabled={disabled}>重新选择房间</button>
          </div>
        </div>
      </div>
    </div>
  );
}
