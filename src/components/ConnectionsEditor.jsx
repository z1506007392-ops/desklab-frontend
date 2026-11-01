import { useCallback, useEffect, useState } from 'react';
import {
  canJoinPorts,
  evaluateConnectionLength,
  inferCableType,
  isPortDirectionConsistent,
  orientPortPair,
  parsePositiveCableLength,
  shouldResetConnectionDraftForSelection,
  standardCableLength,
} from '../domain/connections.js';
import { createEntityId } from '../domain/identifiers.js';
import { labelObjectsForPicker } from '../domain/object-labels.js';
import { CloseIcon } from './Icons.jsx';

// --- Connections MVP 组件 ---
// The draft starts on the selected device, whichever end it is: its port may
// send or receive. The other device's ports that fit either way are offered,
// and the saved connection runs from the sending end (orientPortPair).
const getCompatibleTargetPorts = (localPort, targetObject) => {
  if (!localPort || !targetObject || !targetObject.ports) return [];
  return targetObject.ports.filter(port => canJoinPorts(localPort, port));
};

const ConnectionsEditor = ({ 
  objects, 
  connections, 
  setConnections, 
  selectedObj, 
  connectionMode, 
  setConnectionMode, 
  connectionDraft, 
  setConnectionDraft 
}) => {
  const [editingConnection, setEditingConnection] = useState(null);
  const [prevSelectedObjId, setPrevSelectedObjId] = useState(selectedObj?.id);
  if (selectedObj?.id !== prevSelectedObjId) {
    setPrevSelectedObjId(selectedObj?.id);
    setEditingConnection(null);
  }

  if (editingConnection) {
    const current = connections.find(c => c.id === editingConnection.id);
    if (!current) {
      setEditingConnection(null);
    }
  }

  const cableTypes = [
    { value: 'power', label: '电源线' },
    { value: 'hdmi', label: 'HDMI' },
    { value: 'usb_c', label: 'USB-C' },
    { value: 'usb', label: 'USB 线' },
    { value: 'audio', label: '音频线' },
    { value: 'ethernet', label: '网线' },
    { value: 'displayport', label: 'DisplayPort' },
    { value: 'other', label: '其他' }
  ];

  const objectLabels = labelObjectsForPicker(objects);
  const relatedConnections = selectedObj
    ? connections.filter(c => c.fromObjectId === selectedObj.id || c.toObjectId === selectedObj.id)
    : [];
  const isDraftActive = connectionDraft.fromPortId !== undefined && connectionDraft.fromPortId !== '';

  const isPortOccupied = useCallback((objectId, portId) => connections.some(connection =>
    (connection.fromObjectId === objectId && connection.fromPortId === portId) ||
    (connection.toObjectId === objectId && connection.toPortId === portId)
  ), [connections]);

  const getAvailableTargetPorts = useCallback((fromPort, targetObject) =>
    getCompatibleTargetPorts(fromPort, targetObject)
      .filter(port => !isPortOccupied(targetObject.id, port.id)),
  [isPortOccupied]);

  useEffect(() => {
    if (!shouldResetConnectionDraftForSelection(connectionDraft, selectedObj?.id)) return;
    setConnectionDraft({});
    setConnectionMode(false);
  }, [connectionDraft, selectedObj?.id, setConnectionDraft, setConnectionMode]);


  const renderPortOptions = (obj, role) => {
    if (!obj) return <option value="">-- 请先选择设备 --</option>;
    if (!obj.ports || obj.ports.length === 0) return <option value="">(该设备无可用端口/旧设备)</option>;
    
    let filteredPorts = [];
    if (role === 'from') {
      filteredPorts = obj.ports.filter(p =>
        isPortDirectionConsistent(p) &&
        !isPortOccupied(obj.id, p.id)
      );
    } else if (role === 'to') {
      const fromPort = selectedObj?.ports?.find(p => p.id === connectionDraft.fromPortId);
      filteredPorts = getAvailableTargetPorts(fromPort, obj);
    }

    if (filteredPorts.length === 0) return <option value="">(无兼容或空闲端口)</option>;

    return (
      <>
        <option value="">-- 选择端口 --</option>
        {filteredPorts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </>
    );
  };

  const handleStartConnection = () => {
    setConnectionDraft({ fromObjectId: selectedObj.id, fromPortId: '' });
  };

  const handleCancelConnection = () => {
    setConnectionDraft({});
    setConnectionMode(false);
  };

  const toObj = connectionDraft.toObjectId ? objects.find(o => o.id === connectionDraft.toObjectId) : null;

  // Both ends of the draft as they will be saved (sending end first), or null
  // until both ports are chosen.
  const draftEnds = () => {
    const localPort = selectedObj?.ports?.find(p => p.id === connectionDraft.fromPortId);
    const otherPort = toObj?.ports?.find(p => p.id === connectionDraft.toPortId);
    if (!localPort || !otherPort) return null;
    return orientPortPair({ objectId: selectedObj.id, port: localPort }, { objectId: toObj.id, port: otherPort });
  };
  const draftConnection = length => {
    const ends = draftEnds();
    return ends && {
      fromObjectId: ends.from.objectId,
      fromPortId: ends.from.port.id,
      toObjectId: ends.to.objectId,
      toPortId: ends.to.port.id,
      length,
    };
  };
  // Until the user types a length, offer the size auto-wiring would pick:
  // the shortest common length that covers the route plus 10%.
  const routeStatus = draftConnection(1) && evaluateConnectionLength(draftConnection(1), objects);
  const suggestedLength = routeStatus ? standardCableLength(routeStatus.recommendedLength) : 1;
  const draftLength = connectionDraft.length ?? suggestedLength;

  useEffect(() => {
    if (toObj && toObj.ports && connectionDraft.fromPortId) {
      const fromPort = selectedObj?.ports?.find(p => p.id === connectionDraft.fromPortId);
      if (fromPort) {
        const compatiblePorts = getAvailableTargetPorts(fromPort, toObj);
        if (compatiblePorts.length === 1 && connectionDraft.toPortId !== compatiblePorts[0].id) {
           setConnectionDraft(prev => ({ ...prev, toPortId: compatiblePorts[0].id }));
        }
      }
    }
  }, [toObj, connectionDraft.fromPortId, connectionDraft.toPortId, selectedObj?.ports, setConnectionDraft, getAvailableTargetPorts]);

  useEffect(() => {
    if (connectionDraft.fromPortId && connectionDraft.toPortId && selectedObj && toObj) {
      const fromPort = selectedObj.ports?.find(p => p.id === connectionDraft.fromPortId);
      const toPort = toObj.ports?.find(p => p.id === connectionDraft.toPortId);
      if (fromPort && toPort) {
        const inferredCableType = inferCableType(fromPort, toPort);
        if (connectionDraft.cableType !== inferredCableType) {
          setConnectionDraft(prev => ({ ...prev, cableType: inferredCableType }));
        }
      }
    }
  }, [connectionDraft.cableType, connectionDraft.fromPortId, connectionDraft.toPortId, selectedObj, toObj, setConnectionDraft]);

  if (!selectedObj) {
    return (
      <div className="empty-state">
        <strong>请先在 3D 场景中选择设备</strong>
      </div>
    );
  }

  const handleAdd = () => {
    if (!connectionDraft.toObjectId) return alert('请先选择目标设备');
    if (!connectionDraft.fromPortId || !connectionDraft.toPortId) return alert('必须选择起点和终点的具体端口');
    
    const length = parsePositiveCableLength(draftLength);
    if (length === null) return alert('长度必须是有限且大于 0 的数字');
    
    const localPort = selectedObj.ports?.find(p => p.id === connectionDraft.fromPortId);
    const otherPort = toObj?.ports?.find(p => p.id === connectionDraft.toPortId);

    if (!localPort || !otherPort) return alert('端口不存在（可能是旧数据），无法连接');

    if (isPortOccupied(selectedObj.id, localPort.id) || isPortOccupied(toObj.id, otherPort.id)) {
      return alert('所选端口已被其它连接占用，请选择空闲端口');
    }

    const compPorts = getAvailableTargetPorts(localPort, toObj);
    const ends = draftEnds();
    if (!compPorts.some(p => p.id === otherPort.id) || !ends) {
       return alert(`端口类型不兼容或方向错误`);
    }

    const cableType = inferCableType(ends.from.port, ends.to.port);
    const typeLabel = cableTypes.find(c => c.value === cableType)?.label || '线材';
    const name = connectionDraft.name || '';
    const finalName = name.trim() ? name.trim() : typeLabel;

    const newConn = {
      id: createEntityId('connection'),
      fromObjectId: ends.from.objectId,
      fromPortId: ends.from.port.id,
      toObjectId: ends.to.objectId,
      toPortId: ends.to.port.id,
      cableType,
      length,
      name: finalName
    };

    const lengthStatus = evaluateConnectionLength(newConn, objects);
    if (lengthStatus && !lengthStatus.sufficient) {
      const shouldCreate = window.confirm(
        `当前线长 ${lengthStatus.cableLength.toFixed(2)}m，比估算的走线长度 ${lengthStatus.distance.toFixed(2)}m 短。\n仍要创建这条连接吗？`
      );
      if (!shouldCreate) return;
    }
    
    setConnections(prev => [...prev, newConn]);
    setConnectionDraft({});
    setConnectionMode(false);
  };

  const handleDelete = (id) => setConnections(prev => prev.filter(c => c.id !== id));

  const handleStartEdit = (connection) => {
    setEditingConnection({
      id: connection.id,
      name: connection.name,
      length: String(connection.length),
    });
  };

  const handleSaveEdit = () => {
    const length = parsePositiveCableLength(editingConnection?.length);
    const name = editingConnection?.name?.trim();
    if (!name) return alert('连接名称不能为空');
    if (length === null) return alert('长度必须是有限且大于 0 的数字');

    setConnections(prev => prev.map(connection =>
      connection.id === editingConnection.id
        ? { ...connection, name, length }
        : connection
    ));
    setEditingConnection(null);
  };

  let hasCompatibleToPorts = true;
  if (toObj && toObj.ports && connectionDraft.fromPortId) {
     const fromPort = selectedObj.ports?.find(p => p.id === connectionDraft.fromPortId);
     if (fromPort) {
        const comp = getAvailableTargetPorts(fromPort, toObj);
        hasCompatibleToPorts = comp.length > 0;
     }
  }

  const draftLengthStatus = draftConnection(Number(draftLength))
    ? evaluateConnectionLength(draftConnection(Number(draftLength)), objects)
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="panel-section">
        <div className="panel-field">
          <span className="panel-field-label">当前设备</span>
          <div className="panel-field-content">
            <div className="panel-text-readonly panel-text-strong">{selectedObj.name}</div>
          </div>
        </div>
      </div>

      <div className="panel-section">
      {!isDraftActive && Object.keys(connectionDraft).length === 0 ? (
        <button onClick={handleStartConnection} className="ui-button ui-button-primary ui-full-width">
          新建连接
        </button>
      ) : (
        <div className="connection-draft">
          <div className="connection-draft-header">
            <div className="panel-section-title">创建新连接</div>
            <button type="button" onClick={handleCancelConnection} className="side-panel-close" aria-label="取消新建连接" title="取消"><CloseIcon /></button>
          </div>
          
          <div className="connection-draft-steps">
            <div className="connection-step">
              <div className="connection-step-label">1. 当前设备的接口</div>
              <select className="ui-select ui-full-width" aria-label="当前设备的接口" value={connectionDraft.fromPortId || ''} onChange={e => setConnectionDraft({ fromObjectId: selectedObj.id, fromPortId: e.target.value })}>
                {renderPortOptions(selectedObj, 'from')}
              </select>
            </div>

            {connectionDraft.fromPortId && (
              <div className="connection-step">
                <div className="connection-step-label">2. 目标设备</div>
                {!connectionDraft.toObjectId && (
                  <div className="connection-target-choice">
                    {!connectionMode ? (
                      <>
                        <button onClick={() => setConnectionMode(true)} className="ui-button ui-full-width">
                          在场景中选择目标设备
                        </button>
                        <div className="connection-or">─ 或在下拉列表中选择 ─</div>
                        <select
                          className="ui-select ui-full-width"
                          aria-label="目标设备"
                          value={connectionDraft.toObjectId || ''}
                          onChange={e => {
                            const { value } = e.target;
                            if (value) {
                              setConnectionDraft(prev => ({ ...prev, toObjectId: value, toPortId: '' }));
                              setConnectionMode(false);
                            }
                          }}
                        >
                          <option value="">-- 选择目标设备 --</option>
                          {objects
                            .filter(o => o.id !== selectedObj.id)
                            .map(o => (
                              <option key={o.id} value={o.id}>
                                {objectLabels.get(o.id)}
                              </option>
                            ))}
                        </select>
                      </>
                    ) : (
                      <div className="connection-picking">
                        请在 3D 画面里点选要连接的设备（按 Esc 取消）
                      </div>
                    )}
                  </div>
                )}
                {connectionDraft.toObjectId && toObj && (
                  <div className="connection-chosen">
                    <span>已选：<strong>{toObj.name}</strong></span>
                    <button onClick={() => { setConnectionDraft({ fromObjectId: selectedObj.id, fromPortId: connectionDraft.fromPortId }); setConnectionMode(true); }} className="link-button">重选</button>
                  </div>
                )}
              </div>
            )}

            {connectionDraft.toObjectId && toObj && (
              <div className="connection-step">
                <div className="connection-step-label">3. 目标端口</div>
                {!hasCompatibleToPorts ? (
                  <div className="field-error">目标设备没有兼容端口</div>
                ) : (
                  <select className="ui-select ui-full-width" aria-label="目标端口" value={connectionDraft.toPortId || ''} onChange={e => { const { value } = e.target; setConnectionDraft(prev => ({ ...prev, toPortId: value })); }}>
                    {renderPortOptions(toObj, 'to')}
                  </select>
                )}
              </div>
            )}

            {connectionDraft.toPortId && hasCompatibleToPorts && (
              <div className="connection-step">
                <div className="connection-cable-row">
                  <div>
                    <div className="connection-step-label">4. 线材类型</div>
                    <div className="panel-text-readonly">
                      {cableTypes.find(c => c.value === connectionDraft.cableType)?.label || '其他'}
                    </div>
                  </div>
                  <div>
                    <div className="connection-step-label">长度(m)</div>
                    <input className="ui-input ui-full-width" type="number" step="0.1" min="0.1" aria-label="长度(m)" value={draftLength} onChange={e => { const { value } = e.target; setConnectionDraft(prev => ({ ...prev, length: value })); }} />
                  </div>
                </div>
                <div>
                  <div className="connection-step-label">连接名称 (可选)</div>
                  <input className="ui-input ui-full-width" type="text" aria-label="连接名称" placeholder="留空默认使用线材名" value={connectionDraft.name || ''} onChange={e => { const { value } = e.target; setConnectionDraft(prev => ({ ...prev, name: value })); }} />
                </div>
                {draftLengthStatus && (
                  <div className={`cable-distance ${draftLengthStatus.hasRecommendedSlack ? 'cable-distance-ok' : 'cable-distance-warning'}`}>
                    走线长度约 {draftLengthStatus.distance.toFixed(2)}m，建议至少 {draftLengthStatus.recommendedLength.toFixed(2)}m；
                    {draftLengthStatus.hasRecommendedSlack
                      ? `建议余量 ${draftLengthStatus.recommendedSlack.toFixed(2)}m`
                      : draftLengthStatus.sufficient
                        ? `维护余量不足 ${Math.abs(draftLengthStatus.recommendedSlack).toFixed(2)}m`
                        : `还差 ${Math.abs(draftLengthStatus.slack).toFixed(2)}m`}
                  </div>
                )}
                <button onClick={handleAdd} className="ui-button ui-button-primary connection-confirm">
                  确认连接
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      </div>

      <div className="panel-section">
        <div className="panel-section-title">当前设备连接 ({relatedConnections.length})</div>
        {relatedConnections.length === 0 ? <div className="panel-muted">无连接</div> : null}
        <div className="connection-list">
          {relatedConnections.map(c => {
            const isFrom = c.fromObjectId === selectedObj.id;
            const otherObjId = isFrom ? c.toObjectId : c.fromObjectId;
            const otherPortId = isFrom ? c.toPortId : c.fromPortId;
            const myPortId = isFrom ? c.fromPortId : c.toPortId;
            
            const otherObjItem = objects.find(o => o.id === otherObjId);
            const otherName = otherObjItem?.name || '未知';
            
            const myPortName = selectedObj.ports?.find(p => p.id === myPortId)?.name || myPortId || '旧连接/设备中心';
            const otherPortName = otherObjItem?.ports?.find(p => p.id === otherPortId)?.name || otherPortId || '旧连接/设备中心';
            const lengthStatus = evaluateConnectionLength(c, objects);
            const isEditing = editingConnection?.id === c.id;

            return (
              <div key={c.id} className="connection-list-item">
                <div className="connection-item-header">
                  <strong className="connection-direction">
                    {isFrom ? '发送至' : '接收自'} {otherName}
                  </strong>
                  <div className="connection-item-actions">
                    <button
                      type="button"
                      onClick={() => isEditing ? setEditingConnection(null) : handleStartEdit(c)}
                      className="ui-button"
                    >
                      {isEditing ? '取消' : '编辑'}
                    </button>
                    <button type="button" onClick={() => handleDelete(c.id)} className="ui-button ui-button-danger">删除</button>
                  </div>
                </div>
                {isEditing ? (
                  <div className="connection-edit-form">
                    <label>
                      <span>名称</span>
                      <input
                        className="ui-input"
                        type="text"
                        value={editingConnection.name}
                        onChange={event => { const { value } = event.target; setEditingConnection(prev => ({ ...prev, name: value })); }}
                      />
                    </label>
                    <label>
                      <span>长度 (m)</span>
                      <input
                        className="ui-input"
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={editingConnection.length}
                        onChange={event => { const { value } = event.target; setEditingConnection(prev => ({ ...prev, length: value })); }}
                      />
                    </label>
                    <button type="button" className="ui-button ui-button-primary" onClick={handleSaveEdit}>保存修改</button>
                  </div>
                ) : (
                  <div className="connection-name">{c.name} ({c.length}m)</div>
                )}
                <div className="panel-note">
                  本端: {myPortName} <br/>对端: {otherPortName}
                </div>
                {lengthStatus && (
                  <div className={`cable-distance ${lengthStatus.hasRecommendedSlack ? 'cable-distance-ok' : 'cable-distance-warning'}`}>
                    走线 {lengthStatus.distance.toFixed(2)}m / 建议 {lengthStatus.recommendedLength.toFixed(2)}m / 线长 {lengthStatus.cableLength.toFixed(2)}m
                    {!lengthStatus.hasRecommendedSlack && (
                      lengthStatus.sufficient
                        ? `（维护余量不足 ${Math.abs(lengthStatus.recommendedSlack).toFixed(2)}m）`
                        : `（还差 ${Math.abs(lengthStatus.slack).toFixed(2)}m）`
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ConnectionsEditor;
