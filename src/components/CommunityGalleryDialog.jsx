import { useRef, useState } from 'react';

import { getAppStorage } from '../domain/app-storage.js';
import {
  COMMUNITY_PHOTO_MAX_CHARS,
  exportCommunityDesk,
  importCommunityDesk,
  listGalleryDesks,
  publishCommunityDesk,
  readCommunityProfile,
  removeCommunityPost,
  saveCommunityProfile,
} from '../domain/community-gallery.js';
import { CloseIcon } from './Icons.jsx';
import { useDialogFocus } from './useDialogFocus.js';

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('这张照片打不开。'));
    image.src = url;
  });
}

// Shrink a photo before it is stored next to the gallery, never inside the
// project save. The domain module only checks the result.
async function readCommunityPhoto(file) {
  if (!file || !/^image\/(jpeg|png|webp)$/i.test(file.type)) {
    throw new Error('请选择一张 jpg、png 或 webp 照片。');
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const edge = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = Math.min(1, 480 / edge);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('这张照片打不开。');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let quality = 0.72;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    while (dataUrl.length > COMMUNITY_PHOTO_MAX_CHARS && quality > 0.4) {
      quality -= 0.12;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }
    return dataUrl;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function downloadDeskFile(desk) {
  const file = exportCommunityDesk(desk);
  if (!file.ok) return file;
  const blob = new Blob([file.contents], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return { ok: true };
}

export default function CommunityGalleryDialog({
  canPublish,
  hasObjects,
  currentProject,
  onClose,
  onOpen,
  onCopy,
}) {
  const dialogRef = useDialogFocus();
  const photoInputRef = useRef(null);
  const importInputRef = useRef(null);
  const [displayName, setDisplayName] = useState(() => readCommunityProfile(getAppStorage()).displayName);
  const [title, setTitle] = useState('');
  const [photo, setPhoto] = useState(null);
  const [notice, setNotice] = useState('');
  const [desks, setDesks] = useState(() => listGalleryDesks(getAppStorage()));

  const refresh = () => setDesks(listGalleryDesks(getAppStorage()));

  const handleSaveName = async () => {
    const saved = await saveCommunityProfile(getAppStorage(), displayName);
    if (!saved.ok) {
      setNotice(saved.message);
      return;
    }
    setDisplayName(saved.displayName);
    setNotice('显示名已留在这台设备上。');
  };

  const handlePhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await readCommunityPhoto(file);
      setPhoto(dataUrl);
      setNotice('');
    } catch (error) {
      setPhoto(null);
      setNotice(error.message || '这张照片打不开。');
    }
  };

  const handlePublish = async () => {
    const saved = await saveCommunityProfile(getAppStorage(), displayName);
    if (!saved.ok) {
      setNotice(saved.message);
      return;
    }
    setDisplayName(saved.displayName);
    const published = await publishCommunityDesk(getAppStorage(), {
      title,
      authorName: saved.displayName,
      project: currentProject(),
      photo,
    });
    if (!published.ok) {
      setNotice(published.message);
      return;
    }
    setTitle('');
    setPhoto(null);
    setNotice(`“${published.post.title}”已放进这台设备的图库。`);
    refresh();
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const imported = importCommunityDesk(text);
      if (!imported.ok) {
        setNotice(imported.message);
        return;
      }
      const published = await publishCommunityDesk(getAppStorage(), imported.desk);
      if (!published.ok) {
        setNotice(published.message);
        return;
      }
      setNotice(`已导入“${published.post.title}”。它只在这台设备上。`);
      refresh();
    } catch {
      setNotice('这不是一份桌子文件。');
    }
  };

  const handleDelete = async (desk) => {
    const confirmed = window.confirm(`确定从这台设备的图库里删掉“${desk.title}”吗？`);
    if (!confirmed) return;
    const removed = await removeCommunityPost(getAppStorage(), desk.id);
    setNotice(removed.ok ? `已删掉“${desk.title}”。` : removed.message);
    refresh();
  };

  return (
    <div
      className="modal-overlay"
      onClick={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div ref={dialogRef} tabIndex={-1} className="modal-container wiring-report" role="dialog" aria-modal="true" aria-labelledby="gallery-title">
        <div className="modal-header">
          <h3 id="gallery-title" className="modal-title">社区图库</h3>
          <button type="button" onClick={onClose} className="side-panel-close" aria-label="关闭社区图库" title="关闭"><CloseIcon /></button>
        </div>
        <div className="modal-body">
          <p className="template-intro">
            这是这台设备上的图库。写一个显示名，就能把当前桌子留下，也可以打开示例再复制。桌子和照片不会上传，也不会同步到别的设备。要给别人时，导出一份文件。
          </p>
          <label className="gallery-field">
            显示名
            <input className="ui-input" value={displayName} maxLength={24} aria-label="显示名" onChange={event => setDisplayName(event.target.value)} />
          </label>
          <div className="gallery-actions">
            <button type="button" className="ui-button" onClick={handleSaveName}>保存显示名</button>
          </div>
          {notice && <p className="gallery-note" role="status">{notice}</p>}

          <div className="template-list">
            {desks.map(desk => (
              <div key={desk.id} className="template-card">
                <div className="template-card-content">
                  <div className="gallery-card-main">
                    {desk.photo && <img className="gallery-photo" src={desk.photo} alt="" />}
                    <div>
                      <div className="template-card-title">{desk.title}</div>
                      <div className="template-card-description">{desk.authorName}{desk.summary ? ` · ${desk.summary}` : ''}</div>
                    </div>
                  </div>
                </div>
                <div className="gallery-card-actions">
                  <button type="button" className="ui-button" aria-label={`打开：${desk.title}`} onClick={() => onOpen(desk)}>打开</button>
                  <button type="button" className="ui-button ui-button-primary" aria-label={`复制到我的项目：${desk.title}`} onClick={() => onCopy(desk)}>复制到我的项目</button>
                  <button type="button" className="ui-button" aria-label={`导出文件：${desk.title}`} onClick={() => {
                    const exported = downloadDeskFile(desk);
                    setNotice(exported.ok ? `“${desk.title}”已导出。` : exported.message);
                  }}>导出文件</button>
                  {!desk.builtin && (
                    <button type="button" className="ui-button ui-button-danger" aria-label={`删除：${desk.title}`} onClick={() => handleDelete(desk)}>删除</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <h4 className="template-section-title">放进这台设备的图库</h4>
          <label className="gallery-field">
            这张桌子的名字
            <input className="ui-input" value={title} maxLength={40} aria-label="这张桌子的名字" onChange={event => setTitle(event.target.value)} disabled={!canPublish} />
          </label>
          <div className="gallery-actions">
            <button type="button" className="ui-button" onClick={() => photoInputRef.current?.click()} disabled={!canPublish}>选择实拍</button>
            <input ref={photoInputRef} className="gallery-file-input" type="file" accept="image/jpeg,image/png,image/webp" aria-label="选择实拍" onChange={handlePhoto} disabled={!canPublish} />
          </div>
          {photo && <img className="gallery-photo" src={photo} alt="" />}
          <div className="gallery-actions">
            <button
              type="button"
              className="ui-button ui-button-primary"
              onClick={handlePublish}
              disabled={!canPublish || !hasObjects}
              title={!canPublish ? '先回到自己的桌面，才能把当前桌子放进图库。' : !hasObjects ? '当前房间里还没有设备。' : '把当前桌子留在这台设备的图库里'}
            >
              把当前桌子放进图库
            </button>
          </div>
          <div className="gallery-actions">
            <button type="button" className="ui-button" onClick={() => importInputRef.current?.click()}>导入桌子文件</button>
            <input ref={importInputRef} className="gallery-file-input" type="file" accept="application/json,.json" aria-label="导入桌子文件" onChange={handleImport} />
          </div>
        </div>
      </div>
    </div>
  );
}
