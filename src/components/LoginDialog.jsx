import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { requestLoginCode, verifyLoginCode } from '../domain/auth-client.js';
import { CloseIcon } from './Icons.jsx';
import { useDialogFocus } from './useDialogFocus.js';

const EMAIL = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

// Email, then the 6-digit code. Rendered on document.body so its focus trap
// and Escape stay inside this dialog while the improvements dialog is open.
export function LoginDialog({ onClose, onSignedIn }) {
  const dialogRef = useDialogFocus();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('email');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      event.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  const sendCode = async () => {
    const next = email.trim();
    if (!EMAIL.test(next)) {
      setError('请填写有效的邮箱地址');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await requestLoginCode({ email: next });
      setEmail(next);
      setStep('code');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const signIn = async () => {
    const next = code.trim();
    if (!/^\d{6}$/.test(next)) {
      setError('请填写 6 位验证码');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const session = await verifyLoginCode({ email, code: next });
      onSignedIn(session);
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return createPortal(
    <div
      className="modal-overlay"
      onClick={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="modal-container login-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
      >
        <div className="modal-header">
          <h3 id="login-title" className="modal-title">登录后使用 AI</h3>
          <button type="button" onClick={onClose} className="side-panel-close" aria-label="关闭登录" title="关闭"><CloseIcon /></button>
        </div>
        <div className="modal-body">
          <p className="login-note">验证码会发到邮箱，10 分钟内有效。桌面仍然只保存在这台设备上。</p>
          {step === 'email' ? (
            <form
              className="login-form"
              noValidate
              aria-busy={busy}
              onSubmit={event => {
                event.preventDefault();
                sendCode();
              }}
            >
              <label htmlFor="login-email">邮箱</label>
              <input
                id="login-email"
                className="ui-input"
                type="email"
                autoComplete="email"
                inputMode="email"
                maxLength={254}
                value={email}
                onChange={event => setEmail(event.target.value)}
                disabled={busy}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'login-error' : undefined}
              />
              {error && <p id="login-error" className="login-error" role="alert">{error}</p>}
              <button type="submit" className="ui-button ui-button-primary" disabled={busy}>获取验证码</button>
            </form>
          ) : (
            <form
              className="login-form"
              noValidate
              aria-busy={busy}
              onSubmit={event => {
                event.preventDefault();
                signIn();
              }}
            >
              <p className="login-note">验证码已发到 {email}</p>
              <label htmlFor="login-code">验证码</label>
              <input
                id="login-code"
                className="ui-input"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={event => setCode(event.target.value)}
                disabled={busy}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'login-error' : undefined}
              />
              {error && <p id="login-error" className="login-error" role="alert">{error}</p>}
              <button type="submit" className="ui-button ui-button-primary" disabled={busy}>登录</button>
              <button
                type="button"
                className="ui-button"
                disabled={busy}
                onClick={() => {
                  setStep('email');
                  setCode('');
                  setError('');
                }}
              >
                换个邮箱
              </button>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
