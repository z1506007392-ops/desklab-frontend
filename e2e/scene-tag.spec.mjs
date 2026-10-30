import { test, expect } from '@playwright/test';
import { openProject } from './project-fixture.mjs';

async function addFromLibrary(page, name) {
  const openLibrary = page.getByRole('button', { name: '展开资产库', exact: true });
  if (await openLibrary.isVisible()) await openLibrary.click();
  await page.getByPlaceholder('搜索设备名称、类型、型号...').fill(name);
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
}

test('the selected device carries a tag in the 3D view that follows the selection', async ({ page }) => {
  const evidence = await openProject(page, []);
  const tag = page.locator('.scene-tag');
  await expect(tag).toHaveCount(0);

  await addFromLibrary(page, '27 英寸显示器');
  await expect(tag).toHaveText('27 英寸显示器');
  // The hint under the toolbar already names the selection for screen readers.
  await expect(tag).toHaveAttribute('aria-hidden', 'true');
  const view = await page.locator('canvas').boundingBox();
  const box = await tag.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(view.x);
  expect(box.y).toBeGreaterThanOrEqual(view.y);
  expect(box.x + box.width).toBeLessThanOrEqual(view.x + view.width);
  expect(box.y + box.height).toBeLessThanOrEqual(view.y + view.height);

  await addFromLibrary(page, '路由器');
  await expect(tag).toHaveCount(1);
  await expect(tag).toHaveText('路由器');

  expect(evidence).toEqual({ errors: [], writes: [] });
});
