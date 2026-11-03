import { useEffect, useRef } from 'react';
import { GUIDE_STEPS } from '../domain/onboarding.js';
import { useDialogFocus } from './useDialogFocus.js';

// Five short steps. Step one can also start a template or the library.
export default function OnboardingGuide({ stepIndex, canEdit, onStep, onClose, onStart, fileArchive = false }) {
  const dialogRef = useDialogFocus();
  const titleRef = useRef(null);
  const step = GUIDE_STEPS[stepIndex] || GUIDE_STEPS[0];
  const last = stepIndex >= GUIDE_STEPS.length - 1;
  const body = fileArchive && step.id === 'save'
    ? '点「保存项目」存在这台电脑上，不会同步到别的设备。换电脑前，用「更多 → 导出备份」留一份文件。'
    : step.body;

  useEffect(() => {
    titleRef.current?.focus();
  }, [stepIndex]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key === 'ArrowRight' && !last) {
        event.preventDefault();
        onStep(stepIndex + 1);
      } else if (event.key === 'ArrowLeft' && stepIndex > 0) {
        event.preventDefault();
        onStep(stepIndex - 1);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [last, onClose, onStep, stepIndex]);

  return (
    <div className="modal-overlay onboarding-overlay" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="start-guide onboarding-card"
        role="dialog"
        aria-modal="true"
        aria-label="新手引导"
      >
        <p className="start-guide-step" id="onboarding-step">第 {stepIndex + 1} 步，共 {GUIDE_STEPS.length} 步</p>
        <h2 ref={titleRef} tabIndex={-1} id="onboarding-title" className="start-guide-title">{step.title}</h2>
        <p className="start-guide-text">{body}</p>
        {stepIndex === 0 && canEdit && (
          <div className="start-guide-actions">
            <button type="button" className="ui-button ui-button-primary" onClick={() => onStart('template')}>从模板开始</button>
            <button type="button" className="ui-button" onClick={() => onStart('builder')}>按我的设备生成</button>
            <button type="button" className="ui-button" onClick={() => onStart('manual')}>自己摆</button>
          </div>
        )}
        <div className="onboarding-progress" aria-hidden="true">
          {GUIDE_STEPS.map((item, index) => (
            <span key={item.id} className={index === stepIndex ? 'is-current' : undefined} />
          ))}
        </div>
        <div className="start-guide-actions">
          <button type="button" className="ui-button" onClick={() => onStep(stepIndex - 1)} disabled={stepIndex === 0}>上一步</button>
          <button type="button" className="ui-button" onClick={onClose}>跳过</button>
          <button type="button" className="ui-button ui-button-primary" onClick={() => (last ? onClose() : onStep(stepIndex + 1))}>
            {last ? '知道了' : '下一步'}
          </button>
        </div>
      </div>
    </div>
  );
}
