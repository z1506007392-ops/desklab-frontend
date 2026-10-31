import { CloseIcon } from './Icons.jsx';
import { useDialogFocus } from './useDialogFocus.js';

export default function CableShoppingDialog({ items, onCopy, onClose }) {
  const dialogRef = useDialogFocus();
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
        className="modal-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cable-shop-title"
      >
        <div className="modal-header">
          <h3 id="cable-shop-title" className="modal-title">购线清单</h3>
          <button type="button" onClick={onClose} className="side-panel-close" aria-label="关闭购线清单" title="关闭">
            <CloseIcon />
          </button>
        </div>
        <div className="modal-body">
          <p className="panel-note">按两端插头之间的直线距离，加上弯折余量，再向上取到常见的线长。这里不标价格，也不链接商店。</p>
          {items.length === 0 ? (
            <div className="empty-state">当前没有需要买的线</div>
          ) : (
            <div className="shopping-list" role="group" aria-label="要买的线">
              <div className="shopping-list-header">
                <span className="shopping-list-title">要买的线</span>
                <button type="button" className="ui-button ui-button-primary" onClick={onCopy}>复制清单</button>
              </div>
              <ul className="shopping-list-items">
                {items.map(item => (
                  <li key={item.name}><span>{item.name}</span><span className="shopping-list-quantity">×{item.quantity}</span></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
