import { CloseIcon } from './Icons.jsx';
import { useDialogFocus } from './useDialogFocus.js';

function downloadText(filename, contents, type) {
  const blob = new Blob([contents], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function CableShoppingDialog({ items, sheet, onCopy, onClose }) {
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
          <p className="panel-note">按线实际要走的路（桌上的设备先落到桌面，再从桌子后边或侧边绕下去，不穿过桌面），加上弯折余量，再向上取到常见的线长。键盘、鼠标的线是自带的，不算在里面。桌下有理线槽时，从这张桌子后沿走的线在画面里会收进槽里再出去，要买的长度仍按原来的走法算，不会因为收进槽里就变短，清单里会多一行这只槽。这里不标价格，也不链接商店。</p>
          <div className="shopping-list" role="group" aria-label="要买的线">
            <div className="shopping-list-header">
              <span className="shopping-list-title">要买的线</span>
              <div className="shopping-list-actions">
                {items.length > 0 && (
                  <button type="button" className="ui-button ui-button-primary" onClick={onCopy}>复制清单</button>
                )}
                <button type="button" className="ui-button" onClick={() => downloadText('desklab-wiring.md', sheet.markdown, 'text/markdown')}>导出 Markdown</button>
                <button type="button" className="ui-button" onClick={() => downloadText('desklab-wiring.csv', sheet.csv, 'text/csv')}>导出 CSV</button>
              </div>
            </div>
            {items.length === 0 ? (
              <div className="empty-state">当前没有需要买的线</div>
            ) : (
              <ul className="shopping-list-items">
                {items.map(item => (
                  <li key={item.name}><span>{item.name}</span><span className="shopping-list-quantity">×{item.quantity}</span></li>
                ))}
              </ul>
            )}
          </div>
          <p className="panel-note">导出的布线表按每一根线写明起点、终点、走线长度和购买长度，并附上先接电源、再接信号的安装步骤。</p>
        </div>
      </div>
    </div>
  );
}
