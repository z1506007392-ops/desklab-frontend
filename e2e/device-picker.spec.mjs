import { test, expect } from '@playwright/test';
import { openProject } from './project-fixture.mjs';
import { buildTemplateScene } from '../src/domain/desk-templates.js';

const ROOM = { length: 4, width: 3.5, height: 2.7 };

// The strip under the desk and the adapters beside it are hard to hit in the
// 3D view, and a keyboard cannot click there at all: the panel lists them.
test('a device can be selected from the panel list instead of the 3D view', async ({ page }) => {
  const evidence = await openProject(page, [], [], { room: ROOM });
  await page.getByRole('button', { name: '桌面模板', exact: true }).click();
  await page.getByRole('dialog', { name: '桌面模板', exact: true })
    .getByRole('button', { name: '使用模板：电竞桌', exact: true }).click();
  const openPanel = page.getByRole('button', { name: '展开属性面板', exact: true });
  if (await openPanel.isVisible()) await openPanel.click();

  const picker = page.getByLabel('设备', { exact: true });
  await expect(picker).toHaveValue('');
  await expect(page.locator('.side-panel .empty-state')).toContainText('列表');
  // Every device is listed once, plus the empty choice.
  await expect(picker.locator('option')).toHaveCount(buildTemplateScene('gaming').objects.length + 1);

  await picker.selectOption({ label: '插排' });
  await expect(page.locator('.scene-tag')).toHaveText('插排');
  await expect(page.getByLabel('名称', { exact: true })).toHaveValue('插排');

  // The connections tab follows the same choice.
  await page.getByRole('tab', { name: '连接', exact: true }).click();
  await expect(picker).not.toHaveValue('');
  await picker.selectOption({ label: '台式主机' });
  await expect(page.locator('.scene-tag')).toHaveText('台式主机');
  await expect(page.locator('.connection-list')).toContainText('接收自 插排');
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('a duplicated device lands beside the original and is cabled like a new one', async ({ page }) => {
  const evidence = await openProject(page, [], [], { room: ROOM });
  await page.getByRole('button', { name: '桌面模板', exact: true }).click();
  await page.getByRole('dialog', { name: '桌面模板', exact: true })
    .getByRole('button', { name: '使用模板：电竞桌', exact: true }).click();
  const openPanel = page.getByRole('button', { name: '展开属性面板', exact: true });
  if (await openPanel.isVisible()) await openPanel.click();

  await page.getByLabel('设备', { exact: true }).selectOption({ label: '台式主机' });
  await page.getByRole('button', { name: '复制设备', exact: true }).click();
  await expect(page.getByText('复制成功', { exact: true })).toBeVisible();
  await expect(page.locator('.scene-tag')).toHaveText('台式主机 副本');
  await expect(page.getByRole('button', { name: /^布局检查/ })).toHaveAccessibleName('布局检查');

  await page.getByRole('button', { name: '所有连接', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '全部连接清单', exact: true })).toContainText('台式主机 副本电源线');
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('a second screen is lined up beside the first instead of hiding it, and one undo puts things back', async ({ page }) => {
  const evidence = await openProject(page, [], [], { room: ROOM });
  await page.getByRole('button', { name: '桌面模板', exact: true }).click();
  await page.getByRole('dialog', { name: '桌面模板', exact: true })
    .getByRole('button', { name: '使用模板：电竞桌', exact: true }).click();
  const openPanel = page.getByRole('button', { name: '展开属性面板', exact: true });
  const readX = async name => {
    if (await openPanel.isVisible()) await openPanel.click();
    await page.getByLabel('设备', { exact: true }).selectOption({ label: name });
    return Number(await page.getByLabel('左右 X', { exact: true }).inputValue());
  };
  expect(await readX('带鱼屏显示器')).toBeCloseTo(0, 3);

  const openLibrary = page.getByRole('button', { name: '展开资产库', exact: true });
  if (await openLibrary.isVisible()) await openLibrary.click();
  await page.getByRole('button', { name: '显示器', exact: true }).click();
  await page.getByRole('button', { name: /^27 英寸显示器/ }).click();
  const closeLibrary = page.getByRole('button', { name: '收起资产库', exact: true });
  if (page.viewportSize().width < 900 && await closeLibrary.isVisible()) await closeLibrary.click();

  // Side by side and centred: the ultrawide moved to the seat's left (+x).
  const ultrawide = await readX('带鱼屏显示器');
  const added = await readX('27 英寸显示器');
  expect(ultrawide).toBeGreaterThan(0.2);
  expect(added).toBeLessThan(-0.2);
  await expect(page.getByRole('button', { name: /^布局检查/ })).toHaveAccessibleName('布局检查');
  await expect(page.getByRole('button', { name: /^布线检查/ })).toHaveAccessibleName('布线检查');

  await page.getByRole('button', { name: '撤销', exact: true }).click();
  expect(await readX('带鱼屏显示器')).toBeCloseTo(0, 3);
  await expect(page.getByLabel('设备', { exact: true }).locator('option', { hasText: '27 英寸显示器' })).toHaveCount(0);
  expect(evidence).toEqual({ errors: [], writes: [] });
});
