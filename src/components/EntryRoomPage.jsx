import { useState } from 'react';
import { ENTRY_ROOM_PRESETS, defaultEntryPreset, entryRoomFromPreset } from '../domain/entry-flow.js';
import { useDialogFocus } from './useDialogFocus.js';

// First screen: how big the room is. The same page opens again from 设置.
// Only that later visit can go back; the first one has a single button.
export default function EntryRoomPage({ onConfirm, repick = false, onCancel }) {
  const dialogRef = useDialogFocus();
  const [presetId, setPresetId] = useState(defaultEntryPreset().id);

  return (
    <div className="modal-overlay entry-room-overlay">
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="modal-container entry-room-card"
        role="dialog"
        aria-modal="true"
        aria-label="这间房有多大"
      >
        <h1 className="start-guide-title">这间房有多大</h1>
        <p className="start-guide-text">
          {repick
            ? '换一间房间。桌子和设备会跟着墙一起挪。'
            : '先定房间。确认以后按这个大小生成 3D 房间，然后再放桌子。'}
        </p>
        <div className="entry-room-choices" role="radiogroup" aria-label="房间大小">
          {ENTRY_ROOM_PRESETS.map(preset => (
            <label key={preset.id} className="entry-room-choice">
              <input
                type="radio"
                name="entry-room"
                value={preset.id}
                checked={presetId === preset.id}
                onChange={() => setPresetId(preset.id)}
              />
              <span className="entry-room-choice-name">{preset.label}</span>
              <span className="entry-room-choice-size">{preset.detail}</span>
            </label>
          ))}
        </div>
        <div className="start-guide-actions">
          <button
            type="button"
            className="ui-button ui-button-primary"
            onClick={() => onConfirm(entryRoomFromPreset(presetId))}
          >
            生成这个房间
          </button>
          {repick && (
            <button type="button" className="ui-button" onClick={onCancel}>返回</button>
          )}
        </div>
      </div>
    </div>
  );
}
