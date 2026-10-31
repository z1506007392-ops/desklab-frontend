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

test('a monitor rests on the clamp stand, and the console lives under 娱乐', async ({ page }) => {
  const evidence = await openProject(page, []);
  await openLibrary(page);
  await page.getByRole('button', { name: '配件', exact: true }).click();
  const standCard = page.getByRole('button', { name: /^显示器支架/ });
  await expect(standCard.locator('img')).toHaveAttribute('src', '/thumbnails/monitor-stand.webp');
  await standCard.click();
  await expect(page.locator('.scene-tag')).toHaveText('显示器支架');
  const standZ = await readHeight(page);

  await openLibrary(page);
  await page.getByPlaceholder('搜索设备名称、类型、型号...').fill('24 英寸');
  await page.getByRole('button', { name: /^24 英寸显示器/ }).click();
  await expect(page.locator('.scene-tag')).toHaveText('24 英寸显示器');
  const monitorZ = await readHeight(page);
  expect(monitorZ).toBeGreaterThan(standZ + 0.2);

  await openLibrary(page);
  await page.getByPlaceholder('搜索设备名称、类型、型号...').fill('');
  const back = page.getByRole('button', { name: '返回上一层', exact: true });
  if (await back.isVisible()) await back.click();
  await page.getByRole('button', { name: '娱乐', exact: true }).click();
  const consoleCard = page.getByRole('button', { name: /^游戏主机/ });
  await expect(consoleCard.locator('img')).toHaveAttribute('src', '/thumbnails/game-console.webp');
  await consoleCard.click();
  await expect(page.locator('.scene-tag')).toHaveText('游戏主机');
  expect(evidence).toEqual({ errors: [], writes: [] });
});
