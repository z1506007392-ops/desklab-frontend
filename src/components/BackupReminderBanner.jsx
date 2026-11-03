// Asks the user to export a backup after a saved desk has sat for a while.
export default function BackupReminderBanner({ onExport, onSnooze, fileArchive = false }) {
  return (
    <div className="draft-recovery-banner" role="region" aria-label="备份提醒">
      <div>
        <strong>建议导出一份备份</strong>
        <span>{fileArchive
          ? '桌面保存在这台电脑上，不会同步到别的设备。换电脑前可用“更多 → 导出备份”留一份文件。'
          : '桌面只保存在这个浏览器里，清理浏览器数据或换设备后就找不到了。需要时可用“更多 → 导入备份”恢复。'}</span>
      </div>
      <div className="draft-recovery-actions">
        <button type="button" className="ui-button ui-button-primary" onClick={onExport}>导出备份</button>
        <button type="button" className="ui-button" onClick={onSnooze}>以后再说</button>
      </div>
    </div>
  );
}
