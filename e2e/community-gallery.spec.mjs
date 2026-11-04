import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { PROJECT_STORAGE_KEY } from '../src/domain/local-project-store.js';
import { box, openProject } from './project-fixture.mjs';

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function readStorage(page) {
  return page.evaluate(key => localStorage.getItem(key), PROJECT_STORAGE_KEY);
}

test('a local gallery opens an example, copies it, and keeps a desk file on this device', async ({ page }) => {
  const evidence = await openProject(page, [box('我的桌子')]);
  const saved = await readStorage(page);
  await page.getByRole('button', { name: '社区图库', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '社区图库', exact: true });
  await expect(dialog).toContainText('不会上传，也不会同步');
  await expect(dialog.getByRole('button', { name: '打开：线收进桌下槽', exact: true })).toBeVisible();

  await dialog.getByRole('button', { name: '打开：线收进桌下槽', exact: true }).click();
  const banner = page.getByRole('region', { name: '社区图库', exact: true });
  await expect(banner).toContainText('线收进桌下槽');
  await expect(page.getByRole('button', { name: '保存项目', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '重置视角', exact: true })).toBeEnabled();
  await expect(page.getByText(/只读分享/)).toHaveCount(0);
  await expect(page.getByText(/图库里的桌子，可以转视角查看/)).toBeVisible();
  expect(page.url()).toContain('#desklab-gallery/managed-cables');
  expect(await readStorage(page)).toBe(saved);

  await page.getByRole('button', { name: '更多', exact: true }).click();
  await page.getByRole('menu', { name: '更多', exact: true }).getByRole('menuitem', { name: '购线清单', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '购线清单', exact: true })).toContainText('桌下理线槽');
  await page.keyboard.press('Escape');

  await banner.getByRole('button', { name: '返回我的桌面', exact: true }).click();
  await expect(banner).toHaveCount(0);
  await expect(page.getByRole('button', { name: '保存项目', exact: true })).toBeEnabled();
  expect(page.url()).not.toContain('#desklab-gallery');
  expect(await readStorage(page)).toBe(saved);

  await page.getByRole('button', { name: '社区图库', exact: true }).click();
  await page.getByRole('dialog', { name: '社区图库', exact: true })
    .getByRole('button', { name: '复制到我的项目：极简单屏', exact: true }).click();
  await expect(page.getByText(/已复制“极简单屏”/)).toBeVisible();
  await page.getByRole('button', { name: '撤销', exact: true }).click();

  await page.getByRole('button', { name: '社区图库', exact: true }).click();
  const gallery = page.getByRole('dialog', { name: '社区图库', exact: true });
  await gallery.getByLabel('显示名', { exact: true }).fill('小林');
  await gallery.getByLabel('这张桌子的名字', { exact: true }).fill('我的一角');
  await gallery.getByLabel('选择实拍', { exact: true }).setInputFiles({
    name: 'desk.png', mimeType: 'image/png', buffer: TINY_PNG,
  });
  await expect(gallery.locator('.gallery-photo')).toBeVisible();
  await gallery.getByRole('button', { name: '把当前桌子放进图库', exact: true }).click();
  await expect(gallery.getByText('“我的一角”已放进这台设备的图库。')).toBeVisible();
  const mine = gallery.locator('.template-card').filter({ hasText: '我的一角' });
  await expect(mine).toContainText('小林');
  await expect(mine.locator('img')).toBeVisible();
  expect(await readStorage(page)).toBe(saved);

  const downloadPromise = page.waitForEvent('download');
  await mine.getByRole('button', { name: '导出文件：我的一角', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('desklab-desk.json');
  const fileText = await readFile(await download.path(), 'utf8');
  expect(fileText).toContain('"kind": "desklab-community-desk"');
  expect(fileText).not.toContain('desklab.project');

  page.once('dialog', popup => popup.accept());
  await mine.getByRole('button', { name: '删除：我的一角', exact: true }).click();
  await expect(gallery.getByRole('button', { name: '删除：我的一角', exact: true })).toHaveCount(0);
  await gallery.getByLabel('导入桌子文件', { exact: true }).setInputFiles({
    name: 'desklab-desk.json', mimeType: 'application/json', buffer: Buffer.from(fileText),
  });
  await expect(gallery.getByText(/已导入“我的一角”/)).toBeVisible();
  await expect(gallery.getByText('小林')).toBeVisible();
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('a built-in gallery address is read-only and an unknown one opens your own desk', async ({ page }) => {
  const evidence = await openProject(page, [box('我的桌子')]);
  const saved = await readStorage(page);
  await page.evaluate(() => { window.location.hash = '#desklab-gallery/gaming'; });
  await page.reload();
  await expect(page.getByRole('region', { name: '社区图库', exact: true })).toContainText('超宽');
  await expect(page.getByRole('button', { name: '保存项目', exact: true })).toBeDisabled();
  await expect(page.getByRole('region', { name: '只读分享', exact: true })).toHaveCount(0);
  expect(await readStorage(page)).toBe(saved);

  page.once('dialog', popup => popup.accept());
  await page.getByRole('region', { name: '社区图库', exact: true })
    .getByRole('button', { name: '复制到我的项目', exact: true }).click();
  await expect(page.getByText('已复制到当前项目，尚未保存')).toBeVisible();
  await expect(page.getByText('未保存', { exact: true })).toBeVisible();
  expect(await readStorage(page)).toBe(saved);

  await page.evaluate(() => { window.location.hash = '#desklab-gallery/missing'; });
  await page.reload();
  await expect(page.getByText('图库里没有这张桌子，已打开你自己的桌面。')).toBeVisible();
  await expect(page.getByRole('region', { name: '社区图库', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '保存项目', exact: true })).toBeEnabled();
  expect(evidence.errors).toEqual([]);
  expect(evidence.writes).toEqual([]);
});

test('a desk file with a bad picture is refused and the saved project stays', async ({ page }) => {
  const evidence = await openProject(page, [box('我的桌子')]);
  const saved = await readStorage(page);
  await page.getByRole('button', { name: '社区图库', exact: true }).click();
  const gallery = page.getByRole('dialog', { name: '社区图库', exact: true });
  await gallery.getByLabel('导入桌子文件', { exact: true }).setInputFiles({
    name: 'desklab-desk.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({
      kind: 'desklab-community-desk',
      version: 1,
      title: '外来',
      authorName: '甲',
      photo: 'javascript:alert(1)',
      project: {
        room: { length: 4, width: 4, height: 3 },
        objects: [box('桌子')],
        connections: [],
      },
    })),
  });
  await expect(gallery.getByText('照片需要是这台设备上的一张图片。')).toBeVisible();
  await expect(gallery.getByRole('button', { name: '打开：外来', exact: true })).toHaveCount(0);
  expect(await readStorage(page)).toBe(saved);
  expect(evidence.errors).toEqual([]);
  expect(evidence.writes).toEqual([]);
});
