import { CloseIcon } from './Icons.jsx';

function severityLabel(severity) {
  if (severity === 'error') return '严重';
  if (severity === 'warning') return '警告';
  return '提示';
}

// The "布局检查" dialog. Actions stay in App; this only renders the report.
export default function LayoutReportDialog({
  summary,
  issues,
  autoFixableCount,
  editable,
  onClose,
  onAutoFix,
  onDropToSupport,
  onMoveInsideRoom,
  onSnapOutletToWall,
  onLocate,
}) {
  return (
    <div
      className="modal-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal-container wiring-report"
        role="dialog"
        aria-modal="true"
        aria-labelledby="layout-report-title"
      >
        <div className="modal-header">
          <h3 id="layout-report-title" className="modal-title">布局检查</h3>
          <button
            type="button"
            onClick={onClose}
            className="side-panel-close"
            aria-label="关闭布局检查"
            title="关闭"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="modal-body">
          <div className="wiring-summary">
            <span className="wiring-summary-error">严重 {summary.error}</span>
            <span className="wiring-summary-warning">警告 {summary.warning}</span>
            <span className="wiring-summary-info">提示 {summary.info}</span>
            {autoFixableCount > 0 && (
              <button
                type="button"
                className="ui-button ui-button-primary wiring-cleanup-button"
                onClick={onAutoFix}
                disabled={!editable}
              >
                一键修复可处理项 ({autoFixableCount})
              </button>
            )}
          </div>

          {issues.length === 0 ? (
            <div className="empty-state" style={{ marginTop: '24px' }}>
              当前未发现可识别的布局问题。
            </div>
          ) : (
            <div className="wiring-issue-list">
              {issues.map(issue => (
                <div key={issue.id} className={`wiring-issue wiring-issue-${issue.severity}`}>
                  <div className="wiring-issue-content">
                    <div className="wiring-issue-title">
                      <span className="wiring-issue-severity">{severityLabel(issue.severity)}</span>
                      {issue.title}
                    </div>
                    <div className="wiring-issue-description">{issue.description}</div>
                  </div>
                  <div className="connection-item-actions">
                    {issue.code === 'floating_object' && (
                      <button
                        type="button"
                        className="ui-button ui-button-primary"
                        onClick={() => onDropToSupport(issue.objectIds[0])}
                      >
                        落到表面
                      </button>
                    )}
                    {issue.code === 'out_of_bounds' && (
                      <button
                        type="button"
                        className="ui-button ui-button-primary"
                        onClick={() => onMoveInsideRoom(issue.objectIds[0])}
                      >
                        移回房间内
                      </button>
                    )}
                    {issue.code === 'outlet_off_wall' && (
                      <button
                        type="button"
                        className="ui-button ui-button-primary"
                        onClick={() => onSnapOutletToWall(issue.objectIds[0])}
                      >
                        贴到墙面
                      </button>
                    )}
                    <button
                      type="button"
                      className="ui-button"
                      onClick={() => onLocate(issue.objectIds[0])}
                    >
                      定位
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="wiring-disclaimer">
            相交检查基于物体旋转后的轴对齐包围盒，适合作为布局预警；复杂模型仍应结合 3D 视图确认。
          </p>
        </div>
      </div>
    </div>
  );
}
