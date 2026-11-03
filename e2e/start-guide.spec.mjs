import { test, expect } from '@playwright/test';
import { encodeShareLink } from '../src/domain/share-link.js';
import { openProject, waitForSceneDownloads } from './project-fixture.mjs';

const guide = page => page.getByRole('dialog', { name: '新手引导', exact: true });

// A quick reload on iPhone WebKit can abort the 3D module download. The guide
// tests only care about the dialog, and the page already explains a failed download.
function withoutSceneDownloadErrors(evidence) {
  return {
    errors: evidence.errors.filter(error => !/dynamically imported module|Importing a module script failed|TypeError: Load failed/.test(error)),
    writes: evidence.writes,
  };
}

const roomStep = page => page.getByRole('dialog', { name: '这间房有多大' });
const deskStep = page => page.getByRole('dialog', { name: '放一张桌子', exact: true });

test('a first visit asks only for the room, then offers a desk on that room', async ({ page }) => {
  const evidence = await openProject(page, [], [], { saved: false });
  const room = roomStep(page);
  await expect(room).toBeVisible();
  await expect(room).toBeInViewport({ ratio: 1 });
  await expect(room.getByRole('radio', { name: /默认/ })).toBeChecked();
  await expect(room.getByRole('button')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(room).toBeVisible();
  await expect(room.getByRole('button', { name: '返回', exact: true })).toHaveCount(0);
  await expect(guide(page)).toHaveCount(0);

  await room.getByRole('button', { name: '生成这个房间', exact: true }).click();
  await expect(room).toHaveCount(0);
  const desk = deskStep(page);
  await expect(desk).toBeVisible();
  await expect(desk).toContainText('5 × 4 米的房间已经生成');
  await expect(desk.getByRole('button')).toHaveCount(2);

  await desk.getByRole('button', { name: '用电竞桌', exact: true }).click();
  await expect(desk).toHaveCount(0);
  await expect(page.getByText('已放上电竞桌', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '房间尺寸', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('长:', { exact: true })).toHaveCount(0);
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('choosing to place things yourself opens the device library', async ({ page }) => {
  const evidence = await openProject(page, [], [], { saved: false });
  await page.getByRole('button', { name: '生成这个房间', exact: true }).click();
  await page.getByRole('button', { name: '自己摆', exact: true }).click();
  await expect(deskStep(page)).toHaveCount(0);
  await expect(page.getByPlaceholder('搜索设备名称、类型、型号...')).toBeVisible();
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('the longer guide still starts a template from the menu', async ({ page }) => {
  const evidence = await openProject(page, []);
  await expect(roomStep(page)).toHaveCount(0);
  await page.getByRole('button', { name: '更多', exact: true }).click();
  await page.getByRole('menu', { name: '更多', exact: true }).getByRole('menuitem', { name: '新手引导', exact: true }).click();
  await guide(page).getByRole('button', { name: '从模板开始', exact: true }).click();
  const picker = page.getByRole('dialog', { name: '桌面模板', exact: true });
  await expect(picker).toBeVisible();
  await picker.getByRole('button', { name: '使用模板：极简单屏', exact: true }).click();
  await expect(guide(page)).toHaveCount(0);
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('a user who already saved an empty room is not shown the entry or the guide', async ({ page }) => {
  const evidence = await openProject(page, []);
  await expect(page.getByRole('button', { name: '桌面模板', exact: true })).toBeVisible();
  await expect(roomStep(page)).toHaveCount(0);
  await expect(guide(page)).toHaveCount(0);
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('the guide moves by keyboard, stays dismissed, and can be reopened', async ({ page }) => {
  const evidence = await openProject(page, []);
  await page.getByRole('button', { name: '更多', exact: true }).click();
  await page.getByRole('menu', { name: '更多', exact: true }).getByRole('menuitem', { name: '新手引导', exact: true }).click();
  const dialog = guide(page);
  await expect(dialog.getByRole('heading', { name: '先放上一张桌子' })).toBeVisible();
  await dialog.getByRole('heading', { name: '先放上一张桌子' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(dialog.getByRole('heading', { name: '拖动，或用控制柄' })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(dialog.getByRole('heading', { name: '把线接上' })).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(dialog.getByRole('heading', { name: '拖动，或用控制柄' })).toBeVisible();
  await dialog.getByRole('button', { name: '下一步', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(dialog.getByRole('heading', { name: '把线接上' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  // Reload only once the 3D models have finished downloading: iPhone WebKit
  // reports each download a reload cancels as a page error.
  await waitForSceneDownloads(page);
  await page.reload();
  await expect(page.getByRole('button', { name: '桌面模板', exact: true })).toBeVisible();
  await expect(dialog).toHaveCount(0);

  await page.getByRole('button', { name: '更多', exact: true }).click();
  await page.getByRole('menu', { name: '更多', exact: true }).getByRole('menuitem', { name: '新手引导', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: '先放上一张桌子' })).toBeVisible();
  await dialog.getByRole('button', { name: '跳过', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(withoutSceneDownloadErrors(evidence)).toEqual({ errors: [], writes: [] });
});

test('opening a share link does not show the guide or mark it seen', async ({ page }) => {
  const link = await encodeShareLink({
    room: { length: 4, width: 3, height: 2.6 },
    objects: [],
    connections: [],
  }, { origin: 'http://127.0.0.1:5174', pathname: '/', search: '' });
  const evidence = await openProject(page, [], [], { saved: false });
  await page.evaluate(nextHash => { window.location.hash = nextHash; }, link.hash);
  await waitForSceneDownloads(page); // see the reload above
  await page.reload();
  await expect(page.getByRole('region', { name: '只读分享', exact: true })).toBeVisible();
  await expect(roomStep(page)).toHaveCount(0);
  await expect(deskStep(page)).toHaveCount(0);
  await expect(guide(page)).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('desklab.guide-seen.v1'))).toBeNull();
  expect(withoutSceneDownloadErrors(evidence)).toEqual({ errors: [], writes: [] });
});
