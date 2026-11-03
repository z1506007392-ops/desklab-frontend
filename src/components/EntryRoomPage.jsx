import { useState } from 'react';
import { ENTRY_ROOM_PRESETS, defaultEntryPreset, entryRoomFromPreset } from '../domain/entry-flow.js';
import { useDialogFocus } from './useDialogFocus.js';

// First screen only: how big the room is. The 3D view and the toolbar stay
// underneath, covered, until this one confirmation.
export default function EntryRoomPage({ onConfirm }) {
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
        aria-labelledby="entry-room-title"
      >
        <h1 id="entry-room-title" className="start-guide-title">这间房有多大</h1>
        <p className="start-guide-text">先定房间。确认以后按这个大小生成 3D 房间，然后再放桌子。</p>
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
        <button
          type="button"
          className="ui-button ui-button-primary"
          onClick={() => onConfirm(entryRoomFromPreset(presetId))}
        >
          生成这个房间
        </button>
      </div>
    </div>
  );
}
