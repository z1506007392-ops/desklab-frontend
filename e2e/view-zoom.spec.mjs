import { test, expect } from '@playwright/test';
import { openProject } from './project-fixture.mjs';

async function addFromLibrary(page, name) {
  const openLibrary = page.getByRole('button', { name: '展开资产库', exact: true });
  if (await openLibrary.isVisible()) await openLibrary.click();
  await page.getByPlaceholder('搜索设备名称、类型、型号...').fill(name);
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
}

async function readLength(page) {
  const openPanel = page.getByRole('button', { name: '展开属性面板', exact: true });
  if (await openPanel.isVisible()) await openPanel.click();
  return Number(await page.getByLabel('长 X', { exact: true }).inputValue());
}

test('the wheel zooms the view and leaves the selected device the same size', async ({ page }) => {
  const evidence = await openProject(page, []);
  await addFromLibrary(page, '键盘');
  await expect(page.locator('.scene-tag')).toBeVisible();
  const lengthBefore = await readLength(page);
  const tagBefore = await page.locator('.scene-tag').boundingBox();
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  await canvas.dispatchEvent('wheel', { deltaY: -200, clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 });
  await expect.poll(async () => {
    const tag = await page.locator('.scene-tag').boundingBox();
    return Math.hypot(tag.x - tagBefore.x, tag.y - tagBefore.y);
  }).toBeGreaterThan(1);
  expect(await readLength(page)).toBeCloseTo(lengthBefore, 5);
  expect(evidence.errors).toEqual([]);
});
