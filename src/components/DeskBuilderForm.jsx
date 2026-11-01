import { useMemo, useState } from 'react';
import { findModelTemplate } from '../domain/catalog.js';
import { buildDeskScene, DESK_SCENE_DEVICE_LIMITS, DESK_SIZE_LIMITS } from '../domain/scene-builder.js';
import { MinusIcon, PlusIcon } from './Icons.jsx';

const DEFAULT_COUNTS = Object.freeze({ 'laptop-15': 1, 'monitor-27': 1, keyboard: 1, mouse: 1 });
const DEFAULT_DESK = Object.freeze({ length: '1.4', depth: '0.7' });

// "按我的设备生成": pick devices and a desk size, preview what will be built
// (including any placement notes), then hand the scene to the caller.
const DeskBuilderForm = ({ disabled, onGenerate }) => {
  const [counts, setCounts] = useState(DEFAULT_COUNTS);
  const [desk, setDesk] = useState(DEFAULT_DESK);

  const scene = useMemo(() => buildDeskScene({
    desk: { length: Number(desk.length), depth: Number(desk.depth) },
    devices: Object.entries(counts).map(([modelId, count]) => ({ modelId, count })),
  }), [counts, desk]);

  const changeCount = (modelId, delta) => {
    setCounts(current => {
      const limit = DESK_SCENE_DEVICE_LIMITS[modelId];
      const next = Math.max(0, Math.min(limit, (current[modelId] || 0) + delta));
      return { ...current, [modelId]: next };
    });
  };

  return (
    <div className="desk-builder">
      <div className="desk-builder-devices">
        {Object.entries(DESK_SCENE_DEVICE_LIMITS).map(([modelId, limit]) => {
          const name = findModelTemplate({ modelId })?.displayName ?? modelId;
          const count = counts[modelId] || 0;
          return (
            <div key={modelId} className="desk-builder-row" role="group" aria-label={name}>
              <span className="desk-builder-name">{name}</span>
              <div className="desk-builder-stepper">
                <button
                  type="button"
                  className="ui-button"
                  onClick={() => changeCount(modelId, -1)}
                  disabled={disabled || count <= 0}
                  aria-label={`减少${name}`}
                >
                  <MinusIcon />
                </button>
                <output className="desk-builder-count" aria-label={`${name}数量`}>{count}</output>
                <button
                  type="button"
                  className="ui-button"
                  onClick={() => changeCount(modelId, 1)}
                  disabled={disabled || count >= limit}
                  aria-label={`增加${name}`}
                >
                  <PlusIcon />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="desk-builder-desk">
        {[['length', '书桌长度'], ['depth', '书桌深度']].map(([field, label]) => (
          <label key={field} className="desk-builder-size">
            <span>{label} (m)</span>
            <input
              className="ui-input"
              type="number"
              step="0.1"
              min={DESK_SIZE_LIMITS[field].min}
              max={DESK_SIZE_LIMITS[field].max}
              value={desk[field]}
              onChange={event => {
                // Read the value now: a deferred updater would see the input
                // after React has already restored its previous controlled value.
                const { value } = event.target;
                setDesk(current => ({ ...current, [field]: value }));
              }}
              disabled={disabled}
            />
          </label>
        ))}
      </div>
      {scene.notes.length > 0 && (
        <ul className="desk-builder-notes" aria-label="生成提示">
          {scene.notes.map(note => <li key={note}>{note}</li>)}
        </ul>
      )}
      <button
        type="button"
        className="ui-button ui-button-primary desk-builder-submit"
        onClick={() => onGenerate(scene)}
        disabled={disabled}
      >
        生成桌面
      </button>
    </div>
  );
};

export default DeskBuilderForm;
