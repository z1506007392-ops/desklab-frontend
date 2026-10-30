import { useState } from 'react';

import { describeCatalogModel, findModelTemplate, getLegacyModelInfo } from '../domain/catalog.js';
import { computeDevicePowerLoad, classifyPowerLoad, getEffectiveMaxLoad, getEffectiveWattage } from '../domain/analysis.js';
import {
  commitNumericInput,
  formatNumericInputValue,
  parseLiveNumericInput,
} from '../domain/property-numbers.js';

function PropertyField({
  label,
  value,
  onChange,
  step = 0.1,
  type = 'number',
  min = undefined,
  max = undefined,
  decimals = 3,
}) {
  const [prevValue, setPrevValue] = useState(value);
  const [localVal, setLocalVal] = useState(formatNumericInputValue(value, decimals));

  if (value !== prevValue) {
    setPrevValue(value);
    setLocalVal(formatNumericInputValue(value, decimals));
  }

  const handleChange = (event) => {
    const nextValue = event.target.value;
    setLocalVal(nextValue);
    const number = parseLiveNumericInput(nextValue, { min, max });
    if (number !== null) {
      onChange(number);
    }
  };

  const handleBlur = () => {
    const number = commitNumericInput(localVal, { min, max });
    onChange(number);
    setLocalVal(formatNumericInputValue(number, decimals));
  };

  return (
    <div className="panel-field">
      <label className="panel-field-label">{label}</label>
      <div className="panel-field-content">
        {type === 'text' ? (
          <input
            type="text"
            value={value}
            onChange={event => onChange(event.target.value)}
            className="ui-input"
            style={{ width: '100%' }}
          />
        ) : (
          <input
            type="number"
            step={step}
            min={min}
            max={max}
            value={localVal === undefined ? '' : localVal}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={event => event.key === 'Enter' && handleBlur()}
            className="ui-input"
            style={{ width: '100%' }}
          />
        )}
      </div>
    </div>
  );
}

export default function PropertiesEditor({ obj, updateObject, room, onSnapToWall, objects = [], connections = [] }) {
  const isWallOutlet = obj.modelId === 'wall-outlet' || obj.type === 'outlet';
  const template = findModelTemplate(obj);
  // Older projects may only carry a legacy type such as 'pc' or 'table'.
  const displayTemplate = template || findModelTemplate({ modelId: getLegacyModelInfo(obj.type).modelId });

  const hasPowerInput = obj.ports?.some(p => p.type === 'ac_input' || p.type === 'dc_input') 
    || template?.ports?.some(p => p.type === 'ac_input' || p.type === 'dc_input')
    || false;
  const hasPowerOutput = obj.ports?.some(p => p.type === 'ac_output' || p.type === 'dc_output') 
    || template?.ports?.some(p => p.type === 'ac_output' || p.type === 'dc_output')
    || false;

  const wattage = getEffectiveWattage(obj);
  const maxLoad = getEffectiveMaxLoad(obj);

  const currentLoad = hasPowerOutput ? computeDevicePowerLoad(obj.id, objects, connections) : 0;
  const percent = maxLoad > 0 ? Math.min(100, Math.round((currentLoad / maxLoad) * 100)) : 0;
  const loadStatus = classifyPowerLoad(currentLoad, maxLoad);
  const loadClass = loadStatus === 'overload' ? 'load-overload' : loadStatus === 'warning' ? 'load-warning' : 'load-normal';

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="panel-section">
        <PropertyField type="text" label="名称" value={obj.name} onChange={value => updateObject({ name: value })} />
        <div style={{ paddingLeft: '78px', marginTop: '8px' }}>
          <div className="panel-text-readonly">
            {displayTemplate ? (
              <>
                设备：{displayTemplate.displayName}<br />
                {describeCatalogModel(displayTemplate)}
              </>
            ) : '自定义设备'}
          </div>
        </div>
      </div>

      {/* 电力与负载配置 */}
      {(hasPowerInput || hasPowerOutput) && (
        <div className="panel-section">
          <div className="panel-section-title">用电</div>
          {hasPowerInput && (
            <PropertyField 
              label="工作功耗 (W)" 
              step={5} 
              min={0} 
              decimals={0} 
              value={wattage} 
              onChange={value => updateObject({ wattage: value })} 
            />
          )}
          {hasPowerOutput && (
            <>
              <PropertyField 
                label="最大负载 (W)"
                step={50} 
                min={0} 
                decimals={0} 
                value={maxLoad} 
                onChange={value => updateObject({ maxLoad: value })} 
              />
              {maxLoad > 0 && (
                <div className="load-meter">
                  <div className="load-meter-row">
                    <span>已接负载：<strong>{currentLoad}W</strong> / {maxLoad}W</span>
                    <span className={`load-meter-percent ${loadClass}`}>
                      {percent}%
                    </span>
                  </div>
                  <div className="load-meter-track">
                    <div className={`load-meter-bar ${loadClass}`} style={{ width: `${percent}%` }} />
                  </div>
                  {loadStatus === 'overload' ? (
                    <div className="load-note load-overload">
                      ⚠️ 警告: 电源已过载！请减少外接用电器。
                    </div>
                  ) : loadStatus === 'warning' ? (
                    <div className="load-note load-warning">
                      ⚠️ 提示: 负载较重，已接近承载上限。
                    </div>
                  ) : null}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="panel-section">
        <div className="panel-section-title">位置 (m)</div>
        <PropertyField label="左右 X" step={0.1} decimals={3} value={obj.position.x} onChange={value => updateObject({ position: { x: value } })} />
        <PropertyField label="前后 Y" step={0.1} decimals={3} value={obj.position.y} onChange={value => updateObject({ position: { y: value } })} />
        <PropertyField label="上下 Z" step={0.1} decimals={3} value={obj.position.z} onChange={value => updateObject({ position: { z: value } })} />
        {isWallOutlet && (
          <button type="button" className="ui-button" onClick={onSnapToWall} style={{ width: '100%', marginTop: '8px' }}>
            吸附到最近墙面
          </button>
        )}
      </div>

      <div className="panel-section">
        <div className="panel-section-title">朝向</div>
        <PropertyField label="旋转 (°)" step={15} min={0} max={360} decimals={1} value={obj.rotation?.z || 0} onChange={value => updateObject({ rotation: { z: value } })} />
      </div>

      <div className="panel-section">
        <div className="panel-section-title">尺寸 (m)</div>
        <PropertyField label="长 X" min={0.05} max={room.length} step={0.1} decimals={3} value={obj.scale.x} onChange={value => updateObject({ scale: { x: value } })} />
        <PropertyField label="宽 Y" min={0.05} max={room.width} step={0.1} decimals={3} value={obj.scale.y} onChange={value => updateObject({ scale: { y: value } })} />
        <PropertyField label="高 Z" min={0.05} max={room.height} step={0.1} decimals={3} value={obj.scale.z} onChange={value => updateObject({ scale: { z: value } })} />
      </div>
    </div>
  );
}
