import { test, expect } from '@playwright/test';
import { openProject } from './project-fixture.mjs';
import { buildDeskScene } from '../src/domain/scene-builder.js';

test('the wall outlet is rated 2500W and a keyboard cannot plug into the mouse', async ({ page }) => {
  const scene = buildDeskScene({
    devices: [
      { modelId: 'laptop-15', count: 1 },
      { modelId: 'keyboard', count: 1 },
      { modelId: 'mouse', count: 1 },
    ],
    desk: { length: 1.4, depth: 0.7 },
  });
  // No cables yet, so the keyboard's only USB port is free to start from.
  const evidence = await openProject(page, scene.objects, [], { room: scene.room });
  const openPanel = page.getByRole('button', { name: '展开属性面板', exact: true });
  if (await openPanel.isVisible()) await openPanel.click();

  const picker = page.getByLabel('设备', { exact: true });
  await picker.selectOption({ label: '墙壁插座' });
  await expect(page.getByLabel('最大负载 (W)', { exact: true })).toHaveValue('2500');
  await expect(page.locator('.load-meter')).toContainText('/ 2500W');
  await expect(page.locator('.load-meter')).not.toContainText('3500');

  await picker.selectOption({ label: '键盘' });
  await page.getByRole('tab', { name: '连接', exact: true }).click();
  await page.getByRole('button', { name: '新建连接', exact: true }).click();
  const draft = page.locator('.connection-draft');
  await draft.getByLabel('当前设备的接口', { exact: true }).selectOption({ label: 'USB' });
  await draft.getByLabel('目标设备', { exact: true }).selectOption({ label: '鼠标' });
  await expect(draft.getByText('目标设备没有兼容端口', { exact: true })).toBeVisible();
  await expect(draft.getByLabel('目标端口', { exact: true })).toHaveCount(0);

  await draft.getByRole('button', { name: '取消新建连接', exact: true }).click();
  await page.getByRole('button', { name: '新建连接', exact: true }).click();
  await draft.getByLabel('当前设备的接口', { exact: true }).selectOption({ label: 'USB' });
  await draft.getByLabel('目标设备', { exact: true }).selectOption({ label: '15 英寸笔记本' });
  const targetPorts = draft.getByLabel('目标端口', { exact: true });
  const labels = await targetPorts.locator('option').allTextContents();
  expect(labels.some(label => label.includes('USB'))).toBe(true);
  expect(evidence.errors.filter(message => !/Failed to load resource/.test(message))).toEqual([]);
});
