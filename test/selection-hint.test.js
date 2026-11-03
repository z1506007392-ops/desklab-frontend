import test from 'node:test';
import assert from 'node:assert/strict';

import { describeSelectionHint } from '../src/domain/selection-hint.js';

test('nothing selected tells the user how to start editing', () => {
  assert.deepEqual(describeSelectionHint(), { title: '点选 3D 画面中的设备，即可在右侧面板编辑', tip: '' });
  assert.deepEqual(describeSelectionHint({ isMobile: true }), { title: '点选设备即可编辑', tip: '' });
});

test('a selected device is named the way the user named it', () => {
  const desktop = describeSelectionHint({ selectedName: '27 英寸显示器' });
  assert.equal(desktop.title, '已选中：27 英寸显示器');
  assert.match(desktop.tip, /Q \/ E 旋转/);
  assert.equal(describeSelectionHint({ selectedName: '' }).title, '已选中：未命名设备');
});

test('a read-only share does not invite the visitor to edit', () => {
  assert.equal(describeSelectionHint({ viewOnly: true }).title, '只读分享，可以转视角查看设备和连线');
  assert.equal(describeSelectionHint({ viewOnly: true, isMobile: true }).title, '只读分享，可以转视角查看');
  assert.equal(describeSelectionHint({ viewKind: 'gallery' }).title, '图库里的桌子，可以转视角查看，复制后才能改');
  assert.equal(describeSelectionHint({ viewKind: 'gallery', isMobile: true }).title, '图库里的桌子，可以转视角查看');
});

test('phones get touch wording without keyboard shortcuts', () => {
  const { tip } = describeSelectionHint({ selectedName: '书桌', isMobile: true });
  assert.equal(tip, '拖控制柄移动或旋转，属性面板可精确调整');
  assert.doesNotMatch(tip, /Q|Shift|方向键|空格/);
});
