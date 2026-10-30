import { test, expect } from '@playwright/test';
import { openProject } from './project-fixture.mjs';

async function addTemplateAndSave(page) {
  await page.getByRole('button', { name: '桌面模板', exact: true }).click();
  await page.getByRole('button', { name: '使用模板：电竞桌', exact: true }).click();
  await page.getByRole('button', { name: '保存项目', exact: true }).click();
  await expect(page.getByText(/^✅ 已保存$/)).toBeVisible();
}

test('after saving a desk, the user is reminded to export a backup and can put it off', async ({ page }) => {
  const evidence = await openProject(page, []);
  const reminder = page.getByRole('region', { name: '备份提醒', exact: true });
  await expect(reminder).toHaveCount(0);

  await addTemplateAndSave(page);
  await expect(reminder).toBeVisible();
  await expect(reminder).toContainText('只保存在这个浏览器里');

  await reminder.getByRole('button', { name: '以后再说', exact: true }).click();
  await expect(reminder).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: '保存项目', exact: true }).click();
  await expect(page.getByText(/^✅ 已保存$/)).toBeVisible();
  await expect(reminder).toHaveCount(0);
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('exporting from the reminder downloads a backup that can be imported again', async ({ page }) => {
  const evidence = await openProject(page, []);
  await addTemplateAndSave(page);
  const reminder = page.getByRole('region', { name: '备份提醒', exact: true });

  const downloadPromise = page.waitForEvent('download');
  await reminder.getByRole('button', { name: '导出备份', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^desklab-project-.*\.json$/);
  await expect(reminder).toHaveCount(0);

  const path = await download.path();
  page.once('dialog', dialog => dialog.accept());
  await page.getByLabel('导入 DeskLab 备份文件', { exact: true }).setInputFiles(path);
  await expect(page.getByText(/备份已导入/)).toBeVisible();

  await page.getByRole('button', { name: '保存项目', exact: true }).click();
  await expect(page.getByText(/^✅ 已保存$/)).toBeVisible();
  await expect(reminder).toHaveCount(0, { timeout: 1000 });
  expect(evidence).toEqual({ errors: [], writes: [] });
});
