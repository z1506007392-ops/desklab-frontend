import test from 'node:test';
import assert from 'node:assert/strict';

import { labelObjectsForPicker } from '../src/domain/object-labels.js';

test('devices are listed by the name the user gave them', () => {
  const labels = labelObjectsForPicker([
    { id: 'a', name: '书桌', type: 'office-desk' },
    { id: 'b', name: '路由器', type: 'router' },
  ]);
  assert.deepEqual([...labels.values()], ['书桌', '路由器']);
});

test('devices that share a name are numbered instead of showing internal types', () => {
  const labels = labelObjectsForPicker([
    { id: 'm1', name: '27 英寸显示器', type: 'monitor' },
    { id: 'pc', name: '台式主机', type: 'desktop-pc' },
    { id: 'm2', name: '27 英寸显示器', type: 'monitor' },
    { id: 'x', name: '', type: 'mini-pc' },
  ]);
  assert.equal(labels.get('m1'), '27 英寸显示器（第 1 台）');
  assert.equal(labels.get('m2'), '27 英寸显示器（第 2 台）');
  assert.equal(labels.get('pc'), '台式主机');
  assert.equal(labels.get('x'), '未命名设备');
  for (const label of labels.values()) assert.doesNotMatch(label, /monitor|desktop-pc|mini-pc/);
});
