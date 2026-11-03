import { useState } from 'react';
import { LAYOUT_SCHEME_LIMIT } from '../domain/layout-schemes.js';
import { CloseIcon } from './Icons.jsx';
import { useDialogFocus } from './useDialogFocus.js';

export default function LayoutSchemesDialog({
  schemes,
  editable,
  onSave,
  onSwitch,
  onDelete,
  onClose,
}) {
  const dialogRef = useDialogFocus();
  const [name, setName] = useState('');
  const full = schemes.length >= LAYOUT_SCHEME_LIMIT;

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
        aria-labelledby="layout-schemes-title"
      >
        <div className="modal-header">
          <h3 id="layout-schemes-title" className="modal-title">我的摆法</h3>
          <button type="button" onClick={onClose} className="side-panel-close" aria-label="关闭我的摆法" title="关闭">
            <CloseIcon />
          </button>
        </div>
        <div className="modal-body">
          <p className="panel-note">最多留下 3 套，只存在这台设备里。不会上传，也不会同步到别的设备。3D 里画的仍是当前这一套。</p>
          <div className="layout-schemes" role="group" aria-label="已保存的摆法">
            <div className="shopping-list-header">
              <span className="shopping-list-title">已留 {schemes.length}/{LAYOUT_SCHEME_LIMIT}</span>
            </div>
            {schemes.length === 0 ? (
              <div className="empty-state">还没有另外留下的摆法</div>
            ) : (
              <ul className="layout-scheme-list">
                {schemes.map(scheme => (
                  <li key={scheme.id} className="layout-scheme-row">
                    <span>{scheme.name}</span>
                    <span className="layout-scheme-actions">
                      <button type="button" className="ui-button" onClick={() => onSwitch(scheme)} disabled={!editable}>
                        换成这套
                      </button>
                      <button type="button" className="ui-button" onClick={() => onDelete(scheme)} disabled={!editable}>
                        删除
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <form
            className="layout-scheme-save"
            onSubmit={event => {
              event.preventDefault();
              if (!editable || full) return;
              if (onSave(name)) setName('');
            }}
          >
            <label htmlFor="layout-scheme-name">从当前桌面留一套</label>
            <input
              id="layout-scheme-name"
              className="ui-input"
              maxLength={20}
              placeholder="例如想买的双屏"
              value={name}
              onChange={event => setName(event.target.value)}
              disabled={!editable || full}
            />
            <button type="submit" className="ui-button" disabled={!editable || full || !name.trim()}>
              {full ? '已经有 3 套' : '留下这套'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
