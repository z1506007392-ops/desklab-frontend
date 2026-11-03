import { test, expect } from '@playwright/test';
import { openProject } from './project-fixture.mjs';

async function openLibrary(page) {
  const open = page.getByRole('button', { name: '展开资产库', exact: true });
  if (await open.isVisible()) await open.click();
}

async function readHeight(page) {
  const openPanel = page.getByRole('button', { name: '展开属性面板', exact: true });
  if (await openPanel.isVisible()) await openPanel.click();
  return Number(await page.getByLabel('上下 Z', { exact: true }).inputValue());
}

test('a cable tray mounts under the desk and is listed to buy', async ({ page }) => {
  const evidence = await openProject(page, []);
  await page.getByRole('button', { name: '桌面模板', exact: true }).click();
  await page.getByRole('dialog', { name: '桌面模板', exact: true })
    .getByRole('button', { name: '使用模板：家庭办公', exact: true }).click();

  await openLibrary(page);
  await page.getByRole('button', { name: '配件', exact: true }).click();
  const card = page.getByRole('button', { name: /^桌下理线槽/ });
  await expect(card.locator('img')).toHaveAttribute('src', '/thumbnails/cable-tray.webp');
  await card.click();
  await expect(page.locator('.scene-tag')).toHaveText('桌下理线槽');
  const height = await readHeight(page);
  expect(height, 'under the desktop, not on the floor').toBeGreaterThan(0.4);
  expect(height, 'below the desktop top').toBeLessThan(0.75);

  await page.getByRole('button', { name: /^布局检查/ }).click();
  const layout = page.getByRole('dialog', { name: '布局检查', exact: true });
  await expect(layout).not.toContainText('悬空');
  await expect(layout).not.toContainText('穿插');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: '更多', exact: true }).click();
  await page.getByRole('menu', { name: '更多', exact: true }).getByRole('menuitem', { name: '购线清单', exact: true }).click();
  const shop = page.getByRole('dialog', { name: '购线清单', exact: true });
  await expect(shop.getByRole('listitem').filter({ hasText: '桌下理线槽' })).toHaveText(['桌下理线槽×1']);
  await expect(shop).toContainText('不会因为收进槽里就变短');
  expect(evidence).toEqual({ errors: [], writes: [] });
});
