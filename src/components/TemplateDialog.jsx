import { useEffect, useRef } from 'react';

import { DEVICE_CATALOG, findModelTemplate } from '../domain/catalog.js';
import { DESK_TEMPLATES } from '../domain/desk-templates.js';
import { preloadModelUrls } from '../domain/model-preload.js';
import DeskBuilderForm from './DeskBuilderForm.jsx';
import { CloseIcon } from './Icons.jsx';
import { useDialogFocus } from './useDialogFocus.js';

// The "桌面模板" dialog: pick a built-in desk or generate one from a device list.
// Scrolls to the generator only when opened from "按我的设备生成".
export default function TemplateDialog({
  hasObjects,
  editable,
  scrollToBuilder,
  onClose,
  onApplyTemplate,
  onGenerate,
}) {
  const dialogRef = useDialogFocus();
  const builderHeadingRef = useRef(null);

  useEffect(() => {
    if (!scrollToBuilder) return;
    builderHeadingRef.current?.scrollIntoView({ block: 'start' });
  }, [scrollToBuilder]);

  // The scene may still be downloading three.js. Start the catalog models
  // now so choosing a template does not wait on them afterwards.
  useEffect(() => {
    preloadModelUrls(DEVICE_CATALOG.flatMap(category => category.models).map(model => model.assetUrl));
  }, []);

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
        aria-labelledby="templates-title"
      >
        <div className="modal-header">
          <h3 id="templates-title" className="modal-title">桌面模板</h3>
          <button
            type="button"
            onClick={onClose}
            className="side-panel-close"
            aria-label="关闭桌面模板"
            title="关闭"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="modal-body">
          <p className="template-intro">
            选一个最接近你现状的模板，系统会摆好设备并接好电源、显示和网线，之后可以按实际情况调整。
            {hasObjects && ' 套用后会替换当前场景，可以用“撤销”恢复。'}
          </p>
          <div className="template-list">
            {DESK_TEMPLATES.map(template => (
              <div key={template.id} className="template-card">
                <div className="template-card-content">
                  <div className="template-card-title">{template.name}</div>
                  <div className="template-card-description">{template.description}</div>
                  <div className="template-card-devices">
                    {`书桌 ${template.desk.length}m × ${template.desk.depth}m · `}
                    {template.devices
                      .map(device => `${findModelTemplate({ modelId: device.modelId })?.displayName ?? device.modelId} ×${device.count}`)
                      .join(' · ')}
                  </div>
                </div>
                <button
                  type="button"
                  className="ui-button ui-button-primary"
                  onClick={() => onApplyTemplate(template)}
                  disabled={!editable}
                  aria-label={`使用模板：${template.name}`}
                >
                  使用这个模板
                </button>
              </div>
            ))}
          </div>
          <h4 className="template-section-title" ref={builderHeadingRef}>按我的设备生成</h4>
          <DeskBuilderForm
            disabled={!editable}
            onGenerate={onGenerate}
          />
        </div>
      </div>
    </div>
  );
}
