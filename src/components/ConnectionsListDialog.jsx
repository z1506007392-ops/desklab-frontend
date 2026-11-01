import { describeCableType, evaluateConnectionLength } from '../domain/connections.js';
import { CloseIcon } from './Icons.jsx';
import { useDialogFocus } from './useDialogFocus.js';

// The "全部连接清单" dialog. Deleting a cable stays in App so it can be undone.
export default function ConnectionsListDialog({ connections, objects, onClose, onDelete, onOpenCableShop }) {
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
        className="modal-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="global-connections-title"
      >
        <div className="modal-header">
          <h3 id="global-connections-title" className="modal-title">全部连接清单</h3>
          <div className="modal-header-actions">
            <button type="button" className="ui-button" onClick={onOpenCableShop}>购线清单</button>
            <button
              type="button"
              onClick={onClose}
              className="side-panel-close"
              aria-label="关闭全部连接清单"
              title="关闭"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
        <div className="modal-body">
          {connections.length === 0 ? (
            <div className="empty-state" style={{ marginTop: '20px' }}>当前没有任何连接</div>
          ) : (
            <table className="modal-table">
              <thead>
                <tr>
                  <th>起点</th>
                  <th>终点</th>
                  <th>线材/长度</th>
                  <th className="modal-table-actions">操作</th>
                </tr>
              </thead>
              <tbody>
                {connections.map(connection => {
                  const fromObj = objects.find(object => object.id === connection.fromObjectId);
                  const toObj = objects.find(object => object.id === connection.toObjectId);
                  const fromPortName = fromObj?.ports?.find(port => port.id === connection.fromPortId)?.name || connection.fromPortId || '旧连接';
                  const toPortName = toObj?.ports?.find(port => port.id === connection.toPortId)?.name || connection.toPortId || '旧连接';
                  const lengthStatus = evaluateConnectionLength(connection, objects);
                  return (
                    <tr key={connection.id}>
                      <td>
                        <strong>{fromObj?.name || '未知'}</strong><br />
                        <span className="panel-note">{fromPortName}</span>
                      </td>
                      <td>
                        <strong>{toObj?.name || '未知'}</strong><br />
                        <span className="panel-note">{toPortName}</span>
                      </td>
                      <td>
                        {connection.name}<br />
                        <span className="panel-note">{describeCableType(connection.cableType)}（{connection.length}m）</span>
                        {lengthStatus && (
                          <div className={`cable-distance ${lengthStatus.hasRecommendedSlack ? 'cable-distance-ok' : 'cable-distance-warning'}`}>
                            走线 {lengthStatus.distance.toFixed(2)}m / 建议 {lengthStatus.recommendedLength.toFixed(2)}m
                            {!lengthStatus.hasRecommendedSlack && (
                              lengthStatus.sufficient ? '，维护余量不足' : `，还差 ${Math.abs(lengthStatus.slack).toFixed(2)}m`
                            )}
                          </div>
                        )}
                      </td>
                      <td className="modal-table-actions">
                        <button
                          type="button"
                          onClick={() => onDelete(connection.id)}
                          className="ui-button ui-button-danger"
                          aria-label={`删除 ${fromObj?.name || '未知'} 到 ${toObj?.name || '未知'} 的连接`}
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
