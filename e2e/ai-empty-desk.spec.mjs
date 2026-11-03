import { test, expect } from '@playwright/test';
import { openProject } from './project-fixture.mjs';

test('an empty desk tells you to place devices before AI, without asking you to sign in', async ({ page }) => {
  const evidence = await openProject(page, []);
  await page.getByRole('button', { name: '改进建议', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '自动检查与改进建议', exact: true });
  const section = dialog.getByRole('region', { name: 'AI 建议', exact: true });
  await expect(section.getByText('先放几件设备，AI 才能给建议。', { exact: true })).toBeVisible();
  await expect(section.getByRole('button', { name: '让 AI 看看', exact: true })).toBeDisabled();
  await expect(page.getByRole('dialog', { name: '登录后使用 AI', exact: true })).toHaveCount(0);
  expect(evidence).toEqual({ errors: [], writes: [] });
});
