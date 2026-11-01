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
