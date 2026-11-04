import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { box, openProject } from './project-fixture.mjs';

test('three local layouts can be saved, switched, exported, and not synced', async ({ page }) => {
  const evidence = await openProject(page, [box('现在的桌子')]);
  page.on('dialog', dialog => dialog.accept());

  await page.getByRole('button', { name: '更多', exact: true }).click();
  await page.getByRole('menu', { name: '更多', exact: true }).getByRole('menuitem', { name: '我的摆法', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '我的摆法', exact: true });
  await expect(dialog).toContainText('不会同步');
  await dialog.getByLabel('从当前桌面留一套').fill('想买的');
  await dialog.getByRole('button', { name: '留下这套', exact: true }).click();
  await expect(dialog.getByRole('listitem').filter({ hasText: '想买的' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: '换成这套：想买的', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: '删除：想买的', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '关闭我的摆法', exact: true }).click();
  await expect(dialog).toHaveCount(0);

  await page.getByRole('button', { name: '桌面模板', exact: true }).click();
  await page.getByRole('dialog', { name: '桌面模板', exact: true }).getByRole('button', { name: '使用模板：极简单屏', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: '更多', exact: true }).click();
  await page.getByRole('menu', { name: '更多', exact: true }).getByRole('menuitem', { name: '我的摆法', exact: true }).click();
  await page.getByRole('dialog', { name: '我的摆法', exact: true }).getByRole('button', { name: '换成这套：想买的', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('已换成摆法「想买的」，尚未保存', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: '更多', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('menu', { name: '更多', exact: true }).getByRole('menuitem', { name: '导出备份', exact: true }).click();
  const download = await downloadPromise;
  const backup = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(backup.layoutSchemes.schemes.map(scheme => scheme.name)).toEqual(['想买的']);
  expect(backup.objects.some(object => object.name === '现在的桌子')).toBe(true);

  expect(evidence.errors).toEqual([]);
  expect(evidence.writes).toEqual([]);
});

test('a fourth layout is blocked until one saved copy is deleted', async ({ page }) => {
  const evidence = await openProject(page, [box('现在的桌子')]);
  page.on('dialog', dialog => dialog.accept());

  await page.getByRole('button', { name: '更多', exact: true }).click();
  await page.getByRole('menu', { name: '更多', exact: true }).getByRole('menuitem', { name: '我的摆法', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '我的摆法', exact: true });
  for (const name of ['第一套', '第二套', '第三套']) {
    await dialog.getByLabel('从当前桌面留一套').fill(name);
    await dialog.getByRole('button', { name: '留下这套', exact: true }).click();
    await expect(dialog.getByRole('listitem').filter({ hasText: name })).toBeVisible();
  }
  await expect(dialog.getByRole('button', { name: '已经有 3 套', exact: true })).toBeDisabled();
  await expect(dialog.getByLabel('从当前桌面留一套')).toBeDisabled();

  const second = dialog.getByRole('listitem').filter({ hasText: '第二套' });
  await second.getByRole('button', { name: /删除/ }).click();
  await expect(dialog.getByRole('listitem').filter({ hasText: '第二套' })).toHaveCount(0);
  const nameBox = dialog.getByLabel('从当前桌面留一套');
  await expect(nameBox).toBeEnabled();
  await expect(dialog.getByRole('button', { name: '已经有 3 套', exact: true })).toHaveCount(0);

  await nameBox.fill('第四套');
  await dialog.getByRole('button', { name: '留下这套', exact: true }).click();
  await expect(dialog.getByRole('listitem').filter({ hasText: '第四套' })).toBeVisible();
  await expect(page.getByText('已留下摆法「第四套」', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('listitem')).toHaveCount(3);

  expect(evidence.errors).toEqual([]);
  expect(evidence.writes).toEqual([]);
});
