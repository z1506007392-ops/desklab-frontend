import { AiSuggestionsPanel } from './AiSuggestions.jsx';
import { CloseIcon } from './Icons.jsx';
import { useDialogFocus } from './useDialogFocus.js';

// The "自动检查与改进建议" dialog. Applying a suggestion stays in App so it
// shares the undo history with the rest of the editor.
export default function RecommendationsDialog({
  editable,
  hasObjects,
  recommendations,
  shoppingList,
  layoutIssueCount,
  wiringIssueCount,
  purchaseGuidance,
  ai,
  project,
  onClose,
  onApplyAi,
  onPreviewAi,
  onApplyAllFree,
  onOpenLayout,
  onOpenWiring,
  onStartPurchase,
  onOpenTemplates,
  onOpenLibrary,
  onDropToSupport,
  onMoveInsideRoom,
  onSnapOutletToWall,
  onExtendCable,
  onAutoConnectNetwork,
  onAutoConnectDisplay,
  onAddPowerStrip,
  onCopyShoppingList,
  onLocate,
}) {
  const dialogRef = useDialogFocus();
  const openIssueCount = layoutIssueCount + wiringIssueCount;

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
        aria-labelledby="recommendations-title"
      >
        <div className="modal-header">
          <h3 id="recommendations-title" className="modal-title">自动检查与改进建议</h3>
          <button
            type="button"
            onClick={onClose}
            className="side-panel-close"
            aria-label="关闭改进建议"
            title="关闭"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="modal-body">
          <p className="wiring-issue-description">
            根据当前设备、位置和连接规则生成建议；实际摆放、走线和设备规格仍需确认。
          </p>
          <AiSuggestionsPanel
            ai={ai}
            project={project}
            editable={editable}
            onApply={onApplyAi}
            onPreview={onPreviewAi}
          />
          <div className="wiring-summary">
            <span className="wiring-summary-info">免费改进 {recommendations.freeImprovements.length}</span>
            <span className="wiring-summary-warning">加购建议 {recommendations.purchases.length}</span>
            {recommendations.freeImprovements.length > 0 && (
              <button
                type="button"
                className="ui-button ui-button-primary wiring-cleanup-button"
                onClick={onApplyAllFree}
                disabled={!editable}
              >
                一键修复所有免费项 ({recommendations.freeImprovements.length})
              </button>
            )}
          </div>

          {openIssueCount > 0 && (
            <div className="wiring-issue wiring-issue-warning" role="status">
              <div className="wiring-issue-content">
                <div className="wiring-issue-title">
                  还有 {openIssueCount} 项检查问题需要处理
                </div>
                <div className="wiring-issue-description">
                  自动建议仅覆盖部分问题。应用后请继续查看检查报告，确认需要手动调整的项目。
                </div>
                <div className="connection-item-actions">
                  {layoutIssueCount > 0 && (
                    <button type="button" className="ui-button" onClick={onOpenLayout}>
                      查看布局问题 ({layoutIssueCount})
                    </button>
                  )}
                  {wiringIssueCount > 0 && (
                    <button type="button" className="ui-button" onClick={onOpenWiring}>
                      查看布线问题 ({wiringIssueCount})
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {purchaseGuidance && (
            <div className="wiring-issue wiring-issue-info" style={{ marginTop: '16px' }}>
              <div className="wiring-issue-content">
                <div className="wiring-issue-title">{purchaseGuidance.title}</div>
                <div className="wiring-issue-description">{purchaseGuidance.description}</div>
              </div>
              <div className="connection-item-actions">
                <button type="button" className="ui-button ui-button-primary" onClick={onStartPurchase}>
                  {purchaseGuidance.actionLabel}
                </button>
              </div>
            </div>
          )}

          {recommendations.total === 0 ? (
            <div className="empty-state" style={{ marginTop: '24px' }}>
              {!hasObjects ? (
                <>
                  <p>先添加设备，建立你的桌面方案。</p>
                  <p>可以直接套用一个桌面模板再调整，也可以从资产库逐件放入设备并设置连接。</p>
                  <div className="empty-state-actions">
                    <button type="button" className="ui-button ui-button-primary" disabled={!editable} onClick={onOpenTemplates}>
                      使用桌面模板
                    </button>
                    <button type="button" className="ui-button" disabled={!editable} onClick={onOpenLibrary}>
                      添加第一件设备
                    </button>
                  </div>
                </>
              ) : openIssueCount > 0
                ? '暂无自动改进或加购建议，请查看上方检查问题并手动处理。'
                : '当前检查未发现需要处理的问题，暂无自动改进或加购建议。'}
            </div>
          ) : (
            <div className="recommendations-sections" style={{ marginTop: '16px' }}>
              {recommendations.freeImprovements.length > 0 && (
                <div className="recommendation-group">
                  <h4>免费布局与配线优化</h4>
                  <div className="wiring-issue-list">
                    {recommendations.freeImprovements.map(issue => (
                      <div key={issue.id} className="wiring-issue wiring-issue-info">
                        <div className="wiring-issue-content">
                          <div className="wiring-issue-title">
                            {issue.title}
                          </div>
                          <div className="wiring-issue-description">{issue.description}</div>
                        </div>
                        <div className="connection-item-actions">
                          {issue.code === 'drop_to_support' && (
                            <button
                              type="button"
                              className="ui-button ui-button-primary"
                              onClick={() => onDropToSupport(issue.objectIds[0])}
                              disabled={!editable}
                            >
                              落到表面
                            </button>
                          )}
                          {issue.code === 'move_inside_room' && (
                            <button
                              type="button"
                              className="ui-button ui-button-primary"
                              onClick={() => onMoveInsideRoom(issue.objectIds[0])}
                              disabled={!editable}
                            >
                              移回房间内
                            </button>
                          )}
                          {issue.code === 'snap_outlet_to_wall' && (
                            <button
                              type="button"
                              className="ui-button ui-button-primary"
                              onClick={() => onSnapOutletToWall(issue.objectIds[0])}
                              disabled={!editable}
                            >
                              贴到墙面
                            </button>
                          )}
                          {issue.code === 'extend_cable' && (
                            <button
                              type="button"
                              className="ui-button ui-button-primary"
                              onClick={() => onExtendCable(issue.connectionIds[0])}
                              disabled={!editable}
                            >
                              延长线材
                            </button>
                          )}
                          {issue.code === 'auto_network_device' && (
                            <button
                              type="button"
                              className="ui-button ui-button-primary"
                              onClick={() => onAutoConnectNetwork(issue.id)}
                              disabled={!editable}
                            >
                              连接网络
                            </button>
                          )}
                          {issue.code === 'auto_connect_display' && (
                            <button
                              type="button"
                              className="ui-button ui-button-primary"
                              onClick={() => onAutoConnectDisplay(issue.id)}
                              disabled={!editable}
                            >
                              连接显示器
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {recommendations.purchases.length > 0 && (
                <div className="recommendation-group" style={{ marginTop: '24px' }}>
                  <h4>推荐加购商品</h4>
                  {shoppingList.items.length > 0 && (
                    <div className="shopping-list" role="group" aria-label="购物清单">
                      <div className="shopping-list-header">
                        <span className="shopping-list-title">购物清单</span>
                        <button type="button" className="ui-button" onClick={onCopyShoppingList}>复制清单</button>
                      </div>
                      <ul className="shopping-list-items">
                        {shoppingList.items.map(item => (
                          <li key={item.key} className={item.optional ? 'shopping-list-optional' : undefined}>
                            <span>{item.optional ? `可选：${item.name}` : item.name}</span>
                            <span className="shopping-list-quantity">×{item.quantity}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="wiring-issue-list">
                    {recommendations.purchases.map(issue => (
                      <div key={issue.id} className={`wiring-issue ${issue.code === 'split_overloaded_power' ? 'wiring-issue-error' : 'wiring-issue-warning'}`}>
                        <div className="wiring-issue-content">
                          <div className="wiring-issue-title">
                            {issue.title}
                          </div>
                          <div className="wiring-issue-description">{issue.description}</div>
                        </div>
                        <div className="connection-item-actions">
                          {issue.code === 'fix_power_strip_chain' && (
                            <button
                              type="button"
                              className="ui-button ui-button-primary"
                              onClick={onAddPowerStrip}
                              disabled={!editable}
                            >
                              加购插排
                            </button>
                          )}
                          {issue.code === 'buy_cable' && (
                            <button
                              type="button"
                              className="ui-button ui-button-primary"
                              onClick={() => { onExtendCable(issue.connectionIds[0]); }}
                              disabled={!editable}
                            >
                              采纳并更新长度
                            </button>
                          )}
                          {issue.code === 'buy_power_strip_for_outlets' && (
                            <button
                              type="button"
                              className="ui-button ui-button-primary"
                              onClick={onAddPowerStrip}
                              disabled={!editable}
                            >
                              加购插排
                            </button>
                          )}
                          {issue.code === 'split_overloaded_power' && (
                            <>
                              <button
                                type="button"
                                className="ui-button ui-button-primary"
                                onClick={onAddPowerStrip}
                                disabled={!editable}
                              >
                                加购插排分流
                              </button>
                              {issue.objectIds?.length > 0 && (
                                <button
                                  type="button"
                                  className="ui-button"
                                  onClick={() => onLocate(issue.objectIds[0])}
                                >
                                  定位
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
