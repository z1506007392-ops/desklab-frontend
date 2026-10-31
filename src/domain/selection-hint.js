// The one-line hint under the toolbar. Phones get short touch wording (no
// keyboard shortcuts, no "right panel", which is a drawer there), and the
// selected device is named the way the user named it, never by its type id.
export function describeSelectionHint({ selectedName = null, isMobile = false } = {}) {
  if (selectedName === null) {
    return isMobile
      ? { title: '点选设备即可编辑', tip: '' }
      : { title: '点选 3D 画面中的设备，即可在右侧面板编辑', tip: '' };
  }
  return {
    title: `已选中：${selectedName || '未命名设备'}`,
    tip: isMobile
      ? '拖控制柄移动或旋转，属性面板可精确调整'
      : '拖控制柄或方向键移动，Q / E 旋转，空格 / Shift+空格 升降',
  };
}
