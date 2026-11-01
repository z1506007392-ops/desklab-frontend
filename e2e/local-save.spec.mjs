import { test, expect } from '@playwright/test';
import { openProject, waitForSceneDownloads } from './project-fixture.mjs';
import { PROJECT_BACKUP_STORAGE_KEY, PROJECT_STORAGE_KEY } from '../src/domain/local-project-store.js';

async function applyGamingTemplate(page) {
  await page.getByRole('button', { name: '改进建议', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '使用桌面模板', exact: true }).click();
  await page.getByRole('dialog', { name: '桌面模板', exact: true })
    .getByRole('button', { name: '使用模板：电竞桌', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

async function expectTemplateCables(page) {
  await page.getByRole('button', { name: '所有连接', exact: true }).click();
  const list = page.getByRole('dialog', { name: '全部连接清单', exact: true });
  await expect(list).toContainText('台式主机网线');
  await list.getByRole('button', { name: /关闭/ }).click();
}

test('a saved desk stays in this browser after a reload, with no server involved', async ({ page }) => {
  const evidence = await openProject(page, []);
  await applyGamingTemplate(page);
  const unsaved = page.getByRole('status').filter({ hasText: '未保存' });
  await expect(unsaved).toBeVisible();

  await page.getByRole('button', { name: '保存项目', exact: true }).click();
  await expect(page.getByText(/^已保存$/)).toBeVisible();
  await expect(unsaved).toHaveCount(0);

  // Reload only once the 3D models have finished downloading: iPhone WebKit
  // reports each download a reload cancels as a page error.
  await waitForSceneDownloads(page);
  await page.reload();
  await expect(page.getByRole('button', { name: '保存项目', exact: true })).toBeEnabled();
  await expectTemplateCables(page);
  await expect(unsaved).toHaveCount(0);
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('a second tab cannot overwrite a newer save', async ({ page, context }) => {
  const evidence = await openProject(page, []);
  const other = await context.newPage();
  await other.goto('/');
  await expect(other.getByRole('button', { name: '保存项目', exact: true })).toBeEnabled();

  await applyGamingTemplate(page);
  await page.getByRole('button', { name: '保存项目', exact: true }).click();
  await expect(page.getByText(/^已保存$/)).toBeVisible();

  await other.getByRole('button', { name: '保存项目', exact: true }).click();
  await expect(other.getByText(/项目已在另一个页面中更新/)).toBeVisible();
  await waitForSceneDownloads(page); // see the first test
  await page.reload();
  await expectTemplateCables(page);
  expect(evidence.errors).toEqual([]);
});

test('a damaged save locks saving until the previous version is restored', async ({ page }) => {
  const evidence = await openProject(page, []);
  await applyGamingTemplate(page);
  await page.getByRole('button', { name: '保存项目', exact: true }).click();
  await expect(page.getByText(/^已保存$/)).toBeVisible();
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await page.getByRole('button', { name: '保存项目', exact: true }).click();
  await expect(page.getByText(/^已保存$/)).toBeVisible();

  await page.evaluate(key => localStorage.setItem(key, '{"room":'), PROJECT_STORAGE_KEY);
  await waitForSceneDownloads(page); // see the first test
  await page.reload();
  const banner = page.getByRole('alert').filter({ hasText: '本机保存的项目无法读取，保存已锁定' });
  await expect(banner).toBeVisible();
  await expect(page.getByRole('button', { name: '保存项目', exact: true })).toBeDisabled();

  page.once('dialog', dialog => dialog.accept());
  await banner.getByRole('button', { name: '恢复上一版本', exact: true }).click();
  await expect(page.getByRole('button', { name: '保存项目', exact: true })).toBeEnabled();
  await expectTemplateCables(page);
  expect(await page.evaluate(key => localStorage.getItem(key) !== null, PROJECT_BACKUP_STORAGE_KEY)).toBe(true);
  // The browser reports the corrupt read once; nothing else may fail.
  expect(evidence.errors.filter(message => !message.includes('无法读取'))).toEqual([]);
  expect(evidence.writes).toEqual([]);
});
