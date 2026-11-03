import { useDialogFocus } from './useDialogFocus.js';

// Shown after the empty room exists, over that room. Two choices, nothing else.
export default function EntryDeskStep({ roomSummary, onPreset, onCustom }) {
  const dialogRef = useDialogFocus();

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="entry-desk-card"
      role="dialog"
      aria-modal="true"
      aria-label="放一张桌子"
    >
      <h2 className="start-guide-title">放一张桌子</h2>
      <p className="start-guide-text">{roomSummary}的房间已经生成。用电竞预设，或自己摆。</p>
      <div className="start-guide-actions">
        <button type="button" className="ui-button ui-button-primary" onClick={onPreset}>用电竞桌</button>
        <button type="button" className="ui-button" onClick={onCustom}>自己摆</button>
      </div>
    </div>
  );
}
