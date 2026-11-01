import { test, expect } from '@playwright/test';
import { encodeShareLink } from '../src/domain/share-link.js';
import { openProject } from './project-fixture.mjs';

const guide = page => page.getByRole('dialog', { name: '新手引导', exact: true });

// A quick reload on iPhone WebKit can abort the 3D module download. The guide
// tests only care about the dialog, and the page already explains a failed download.
function withoutSceneDownloadErrors(evidence) {
  return {
    errors: evidence.errors.filter(error => !/dynamically imported module|Importing a module script failed|TypeError: Load failed/.test(error)),
    writes: evidence.writes,
  };
}

test('a first-time visitor is offered three ways to start, and a template ends the guide', async ({ page }) => {
  const evidence = await openProject(page, [], [], { saved: false });
  await expect(guide(page)).toBeVisible();
  await expect(guide(page)).toBeInViewport({ ratio: 1 });
  await expect(guide(page).getByText('第 1 步，共 5 步')).toBeVisible();

  await guide(page).getByRole('button', { name: '从模板开始', exact: true }).click();
  const picker = page.getByRole('dialog', { name: '桌面模板', exact: true });
  await expect(picker).toBeVisible();
  await picker.getByRole('button', { name: '使用模板：家庭办公', exact: true }).click();
  await expect(guide(page)).toHaveCount(0);

  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(guide(page), 'a dismissed guide stays away for this visit').toHaveCount(0);
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('"generate from my devices" opens the picker at the device form', async ({ page }) => {
  const evidence = await openProject(page, [], [], { saved: false });
  await guide(page).getByRole('button', { name: '按我的设备生成', exact: true }).click();
  const picker = page.getByRole('dialog', { name: '桌面模板', exact: true });
  await expect(picker.getByRole('heading', { name: '按我的设备生成', exact: true })).toBeInViewport();
  await expect(guide(page)).toHaveCount(0);
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('"I will place things myself" closes the guide and opens the device library', async ({ page }) => {
  const evidence = await openProject(page, [], [], { saved: false });
  await guide(page).getByRole('button', { name: '自己摆', exact: true }).click();
  await expect(guide(page)).toHaveCount(0);
  await expect(page.getByPlaceholder('搜索设备名称、类型、型号...')).toBeVisible();
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('a user who already saved an empty room is not shown the guide', async ({ page }) => {
  const evidence = await openProject(page, []);
  await expect(page.getByRole('button', { name: '桌面模板', exact: true })).toBeVisible();
  await expect(guide(page)).toHaveCount(0);
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('the guide moves by keyboard, stays dismissed, and can be reopened', async ({ page }) => {
  const evidence = await openProject(page, [], [], { saved: false });
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
  await page.waitForLoadState('networkidle');
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
  await page.waitForLoadState('networkidle'); // see the reload above
  await page.reload();
  await expect(page.getByRole('region', { name: '只读分享', exact: true })).toBeVisible();
  await expect(guide(page)).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('desklab.guide-seen.v1'))).toBeNull();
  expect(withoutSceneDownloadErrors(evidence)).toEqual({ errors: [], writes: [] });
});
