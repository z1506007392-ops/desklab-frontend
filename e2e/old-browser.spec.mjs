import { test, expect } from '@playwright/test';

test('a browser that is too old gets an explanation instead of a blank page', async ({ page }) => {
  await page.addInitScript(() => { delete window.structuredClone; });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('你的浏览器版本太旧，DeskLab 打不开');
  await expect(page.getByRole('button', { name: '保存项目' })).toHaveCount(0);
  expect(errors).toEqual([]);
});
