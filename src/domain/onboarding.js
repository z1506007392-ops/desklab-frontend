// First visit only: no saved project, and this flag is still unset. "更多"
// can open the same steps again later. The flag is not the project save.
export const GUIDE_SEEN_STORAGE_KEY = 'desklab.guide-seen.v1';

export const GUIDE_STEPS = Object.freeze([
  {
    id: 'start',
    title: '先放上一张桌子',
    body: '选一个桌面模板，或从资产库添加设备。模板会把设备和线先摆好，之后可以改。',
  },
  {
    id: 'move',
    title: '拖动，或用控制柄',
    body: '点选设备后可以拖动它。选中时出现的箭头用来移动，圆环用来旋转。',
  },
  {
    id: 'cables',
    title: '把线接上',
    body: '选中设备，在右侧「连接」里从一个接口接到另一台设备。购线清单会按这些线告诉你要买什么。',
  },
  {
    id: 'advice',
    title: '让改进建议看一看',
    body: '「改进建议」会检查摆放和走线。打开 AI 后，还可以用自己的话让它提出改法，应用前能先预览。',
  },
  {
    id: 'save',
    title: '保存，并留一份备份',
    body: '点「保存项目」存在这台浏览器里。换设备或清理浏览器前，用「更多 → 导出备份」留一份文件。',
  },
]);

export function hasSeenGuide(storage) {
  try {
    return storage?.getItem(GUIDE_SEEN_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markGuideSeen(storage) {
  try {
    storage?.setItem(GUIDE_SEEN_STORAGE_KEY, '1');
    return true;
  } catch {
    return false;
  }
}
