import { test, expect } from '@playwright/test';
import { openProject } from './project-fixture.mjs';

async function openLibrary(page) {
  const open = page.getByRole('button', { name: '展开资产库', exact: true });
  if (await open.isVisible()) await open.click();
}

test('adding a laptop walks category, kind, then model, and back returns a level', async ({ page }) => {
  const evidence = await openProject(page, []);
  await openLibrary(page);

  const laptop = page.getByRole('button', { name: /^15 英寸笔记本/ });
  await expect(laptop).toHaveCount(0);

  await page.getByRole('button', { name: '电脑', exact: true }).click();
  await expect(page.getByRole('button', { name: '笔记本', exact: true })).toBeVisible();
  await expect(laptop).toHaveCount(0);

  await page.getByRole('button', { name: '返回上一层', exact: true }).click();
  await expect(page.getByRole('button', { name: '桌子', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '笔记本', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: '电脑', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '台式主机', exact: true }).focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(laptop).toBeVisible();
  await laptop.click();

  await expect(page.locator('.scene-tag')).toHaveText('15 英寸笔记本');
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('a category with one kind lists models immediately', async ({ page }) => {
  await openProject(page, []);
  await openLibrary(page);
  await page.getByRole('button', { name: '显示器', exact: true }).click();
  await expect(page.getByRole('button', { name: /^24 英寸显示器/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^27 英寸显示器/ })).toBeVisible();
  await expect(page.getByRole('button', { name: '返回上一层', exact: true })).toBeVisible();
});
