import { useRef, useState } from 'react';

import {
  DEVICE_CATALOG,
  catalogBranches,
  catalogThumbnailUrl,
  describeCatalogModel,
  searchCatalogModels,
} from '../domain/catalog.js';

function moveBrowseFocus(event) {
  const key = event.key;
  if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(key)) return false;
  const buttons = [...event.currentTarget.querySelectorAll('[data-browse-item]')];
  const index = buttons.indexOf(document.activeElement);
  if (index < 0) return false;
  event.preventDefault();
  const delta = key === 'ArrowDown' || key === 'ArrowRight' ? 1 : -1;
  buttons[(index + delta + buttons.length) % buttons.length]?.focus();
  return true;
}

export default function LibraryBrowser({ disabled, onAdd }) {
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState(null);
  const [branchId, setBranchId] = useState(null);
  const listRef = useRef(null);
  const category = DEVICE_CATALOG.find(item => item.category === categoryId) || null;
  const branches = category ? catalogBranches(category) : [];
  const skipBranch = branches.length < 2;
  const branch = skipBranch ? branches[0] : branches.find(item => item.id === branchId) || null;
  const searching = query.trim().length > 0;

  const models = searching
    ? searchCatalogModels(query)
    : (branch ? branch.models.map(model => ({ ...model, categoryId: category.category })) : []);

  const canGoBack = !searching && categoryId !== null;

  const goBack = () => {
    if (!category) return;
    if (!skipBranch && branch) {
      setBranchId(null);
      return;
    }
    setCategoryId(null);
    setBranchId(null);
  };

  const onKeyDown = (event) => {
    if (event.target.closest('input')) {
      if (event.key === 'Escape' && query) {
        event.preventDefault();
        setQuery('');
      }
      return;
    }
    if (moveBrowseFocus(event)) return;
    if (event.key === 'Escape' && canGoBack) {
      event.preventDefault();
      goBack();
    }
  };

  const title = searching
    ? '搜索结果'
    : !category
      ? '选一个大类'
      : !branch || (category && !branchId && !skipBranch)
        ? category.categoryName
        : skipBranch
          ? category.categoryName
          : `${category.categoryName} / ${branch.name}`;

  const showModels = searching || Boolean(branch);
  const showBranches = !searching && category && !skipBranch && !branch;

  return (
    <>
      <div className="asset-search-container">
        <input
          type="text"
          aria-label="搜索设备"
          placeholder="搜索设备名称、类型、型号..."
          className="ui-input"
          style={{ width: '100%', boxSizing: 'border-box' }}
          value={query}
          onChange={event => setQuery(event.target.value)}
          onKeyDown={event => {
            if (event.key !== 'Escape' || !query) return;
            event.preventDefault();
            event.stopPropagation();
            setQuery('');
          }}
        />
      </div>
      <div className="asset-browse" ref={listRef} onKeyDown={onKeyDown}>
        <div className="asset-browse-bar">
          {canGoBack && (
            <button type="button" className="asset-category-btn" data-browse-item onClick={goBack} aria-label="返回上一层">
              返回
            </button>
          )}
          <div className="asset-browse-title">{title}</div>
        </div>
        <div className="asset-list" role="group" aria-label={title}>
          {showModels && (
            models.length === 0
              ? <div className="empty-state" style={{ marginTop: '20px' }}>未找到匹配的设备</div>
              : models.map(model => (
                <button
                  type="button"
                  key={model.modelId}
                  className="asset-item"
                  data-browse-item
                  disabled={disabled}
                  onClick={() => onAdd(model, model.categoryId)}
                >
                  <img className="asset-item-thumb" src={catalogThumbnailUrl(model.modelId)} alt="" width="56" height="56" loading="lazy" decoding="async" />
                  <span className="asset-item-text">
                    <span className="asset-item-title">{model.displayName}</span>
                    <span className="asset-item-subtitle">{describeCatalogModel(model)}</span>
                  </span>
                </button>
              ))
          )}
          {showBranches && branches.map(item => (
            <button
              type="button"
              key={item.id}
              className="asset-item"
              data-browse-item
              onClick={() => setBranchId(item.id)}
            >
              <span className="asset-item-text">
                <span className="asset-item-title">{item.name}</span>
                <span className="asset-item-subtitle" aria-hidden="true">{item.models.length} 个型号</span>
              </span>
            </button>
          ))}
          {!showModels && !showBranches && DEVICE_CATALOG.map(item => (
            <button
              type="button"
              key={item.category}
              className="asset-item"
              data-browse-item
              onClick={() => {
                setCategoryId(item.category);
                setBranchId(null);
              }}
            >
              <span className="asset-item-text">
                <span className="asset-item-title">{item.categoryName}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
