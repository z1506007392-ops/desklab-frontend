import { useState } from 'react';
import { getAppStorage } from '../domain/app-storage.js';
import {
  eyeHeightAdvice,
  normalizeEyeHeight,
  readEyeProfile,
  writeEyeProfile,
} from '../domain/eye-height.js';

// Three local fields and one sentence. The profile never enters the project,
// the share link, or a server. The desktop shell's file archive and the
// browser's localStorage are the same getter.
export default function EyeHeightAdvice({ project, storage = getAppStorage }) {
  const store = storage();
  const [profile, setProfile] = useState(() => readEyeProfile(store));
  const [heightText, setHeightText] = useState(() => (
    profile.eyeHeightMetres == null ? '' : String(profile.eyeHeightMetres)
  ));
  const [fieldError, setFieldError] = useState('');

  const save = (next, nextHeightText) => {
    const previous = profile;
    const previousText = heightText;
    setProfile(next);
    if (nextHeightText !== undefined) setHeightText(nextHeightText);
    setFieldError('');
    const fail = () => {
      setProfile(current => (current === next ? previous : current));
      if (nextHeightText !== undefined) {
        setHeightText(current => (current === nextHeightText ? previousText : current));
      }
      setFieldError('眼睛高度没有写上，刚才的修改已取消。');
    };
    let pending;
    try {
      pending = writeEyeProfile(store, next);
    } catch {
      fail();
      return;
    }
    if (pending != null && typeof pending.then === 'function') {
      pending.then(ok => {
        if (!ok) fail();
      }, fail);
      return;
    }
    if (!pending) fail();
  };

  const commitHeight = (text) => {
    const height = normalizeEyeHeight(text.trim());
    if (height === undefined) {
      setFieldError('眼睛离地高度请填 0.50 到 2.20 米。');
      return;
    }
    save({ ...profile, eyeHeightMetres: height }, height == null ? '' : String(height));
  };

  return (
    <section className="eye-height" aria-labelledby="eye-height-title">
      <h4 id="eye-height-title">眼睛高度</h4>
      <p className="wiring-issue-description">只存在这台设备里。不上传，不同步，也不自动挪屏幕、不加椅子。</p>
      <div className="eye-height-fields">
        <label className="panel-field" htmlFor="eye-height-metres">
          <span className="panel-field-label">离地</span>
          <span className="panel-field-content">
            <input
              id="eye-height-metres"
              className="ui-input"
              inputMode="decimal"
              min="0.5"
              max="2.2"
              step="0.01"
              placeholder="例如 1.15"
              value={heightText}
              onChange={event => setHeightText(event.target.value)}
              onBlur={() => commitHeight(heightText)}
              onKeyDown={event => {
                if (event.key === 'Enter') commitHeight(heightText);
              }}
            />
            <span className="panel-text-readonly">米</span>
          </span>
        </label>
        <div className="eye-height-posture" role="group" aria-label="坐着还是站着">
          <button
            type="button"
            className="ui-button"
            aria-pressed={profile.posture !== 'standing'}
            onClick={() => save({ ...profile, posture: 'sitting' })}
          >
            坐着
          </button>
          <button
            type="button"
            className="ui-button"
            aria-pressed={profile.posture === 'standing'}
            onClick={() => save({ ...profile, posture: 'standing' })}
          >
            站着
          </button>
        </div>
        <label className="eye-height-check">
          <input
            type="checkbox"
            checked={profile.bifocals}
            onChange={event => save({ ...profile, bifocals: event.target.checked })}
          />
          双光眼镜
        </label>
      </div>
      {fieldError && <p className="field-error" role="alert">{fieldError}</p>}
      <p className="wiring-issue-description" role="status">{eyeHeightAdvice(project, profile)}</p>
    </section>
  );
}
