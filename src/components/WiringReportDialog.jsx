import { CloseIcon } from './Icons.jsx';
import { useDialogFocus } from './useDialogFocus.js';

function severityLabel(severity) {
  if (severity === 'error') return '严重';
  if (severity === 'warning') return '警告';
  return '提示';
}

function actionLabel(action, title) {
  return `${action}：${title}`;
}

// The "布线检查" dialog. Actions stay in App; this only renders the report.
export default function WiringReportDialog({
  summary,
  issues,
  invalidConnectionCount,
  cableAutoFixableCount,
  editable,
  onClose,
  onCleanupInvalid,
  onExtendShortCables,
  onExtendCable,
  onAddPowerStrip,
  onLocate,
  onShowConnections,
}) {
  const dialogRef = useDialogFocus();
  return (
    <div
      className="modal-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="modal-container wiring-report"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wiring-report-title"
      >
        <div className="modal-header">
          <h3 id="wiring-report-title" className="modal-title">布线检查</h3>
          <button
            type="button"
            onClick={onClose}
            className="side-panel-close"
            aria-label="关闭布线检查"
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
            {invalidConnectionCount > 0 && (
              <button
                type="button"
                className="ui-button ui-button-danger wiring-cleanup-button"
                onClick={onCleanupInvalid}
              >
                清理无效连接 ({invalidConnectionCount})
              </button>
            )}
            {cableAutoFixableCount > 0 && (
              <button
                type="button"
                className="ui-button ui-button-primary wiring-cleanup-button"
                onClick={onExtendShortCables}
                disabled={!editable}
              >
                一键延长过短线材 ({cableAutoFixableCount})
              </button>
            )}
          </div>

          {issues.length === 0 ? (
            <div className="empty-state" style={{ marginTop: '24px' }}>
              当前未发现可识别的布线问题。
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
                  {(issue.code === 'short_cable' || issue.code === 'low_cable_slack') && (
                    <button
                      type="button"
                      className="ui-button ui-button-primary"
                      aria-label={actionLabel('延长到推荐长度', issue.title)}
                      onClick={() => onExtendCable(issue.connectionIds[0])}
                    >
                      延长到推荐长度
                    </button>
                  )}
                  {issue.code === 'power_strip_chain' && (
                    <button
                      type="button"
                      className="ui-button"
                      aria-label={actionLabel('换孔位更多的插排', issue.title)}
                      onClick={() => onAddPowerStrip('chain')}
                      title="向场景中加入一个孔位更多的插排，替代串联的插排"
                    >
                      换孔位更多的插排
                    </button>
                  )}
                  {(issue.code === 'power_overload' || issue.code === 'power_warning') && (
                    <button
                      type="button"
                      className="ui-button"
                      aria-label={actionLabel('加购插排分流', issue.title)}
                      onClick={() => onAddPowerStrip('split')}
                      title="加购插排以将部分用电器分流到其他电源"
                    >
                      加购插排分流
                    </button>
                  )}
                  {issue.objectIds.length > 0 && (
                    <button
                      type="button"
                      className="ui-button"
                      aria-label={actionLabel('定位', issue.title)}
                      onClick={() => onLocate(issue)}
                    >
                      定位
                    </button>
                  )}
                  {issue.objectIds.length === 0 && issue.connectionIds.length > 0 && (
                    <button
                      type="button"
                      className="ui-button"
                      aria-label={actionLabel('查看连接', issue.title)}
                      onClick={onShowConnections}
                    >
                      查看连接
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <p className="wiring-disclaimer">
            本检查仅基于当前设备、端口和桌面外部连接数据，不涉及墙内线路，也不能替代专业电工评估。
          </p>
        </div>
      </div>
    </div>
  );
}
