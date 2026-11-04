import { randomBytes } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { PROJECT_STORAGE_KEY } from '../src/domain/local-project-store.js';
import { box, openProject, waitForSceneDownloads } from './project-fixture.mjs';

function device(id, x, y, port) {
  return {
    ...box(id, x),
    type: 'device',
    position: { x, y, z: 0.5 },
    ports: [port],
  };
}

const hdmiOut = { id: 'hdmi-out', name: 'HDMI 输出', type: 'hdmi', direction: 'output' };
const hdmiIn = { id: 'hdmi-in', name: 'HDMI 输入', type: 'hdmi', direction: 'input' };
const sharedObjects = [
  device('主机', -1, 0, hdmiOut),
  device('屏幕', 1, 0, hdmiIn),
];
const sharedConnections = [{
  id: 'hdmi-1', name: '屏幕线', cableType: 'hdmi', length: 3,
  fromObjectId: '主机', fromPortId: 'hdmi-out', toObjectId: '屏幕', toPortId: 'hdmi-in',
}];

function mineProject() {
  return JSON.stringify({
    id: 'default',
    updatedAt: '2026-09-09T00:00:00.000Z',
    room: { length: 10, width: 10, height: 3 },
    objects: [box('我的桌子')],
    connections: [],
  });
}

async function rememberClipboard(page, context, browserName) {
  await page.addInitScript(() => {
    const clipboard = navigator.clipboard;
    if (!clipboard?.writeText) return;
    const writeText = clipboard.writeText.bind(clipboard);
    clipboard.writeText = async (text) => {
      window.__deskLabCopied = text;
      return writeText(text);
    };
  });
  if (browserName === 'chromium') {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  }
}

async function readStorage(page) {
  return page.evaluate(key => localStorage.getItem(key), PROJECT_STORAGE_KEY);
}

test('a share link is read-only and does not replace the saved desk', async ({ page, context, browserName }) => {
  await rememberClipboard(page, context, browserName);
  const evidence = await openProject(page, sharedObjects, sharedConnections);
  await page.getByRole('button', { name: '更多', exact: true }).click();
  await page.getByRole('menu', { name: '更多', exact: true }).getByRole('menuitem', { name: '复制分享链接', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '分享链接', exact: true });
  await expect(dialog).toContainText('不会覆盖对方自己保存的项目');
  await expect(dialog.getByText('可能打不开')).toHaveCount(0);
  await dialog.getByRole('button', { name: '复制链接', exact: true }).click();
  await expect(page.getByText('分享链接已复制', { exact: true })).toBeVisible();
  const url = await page.evaluate(async () => {
    try { return await navigator.clipboard.readText(); }
    catch { return window.__deskLabCopied || ''; }
  });
  expect(url).toContain('#desklab-share-2.');

  const mine = mineProject();
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: PROJECT_STORAGE_KEY, raw: mine });
  // A hash-only navigation does not reload the page, so open the link the way a
  // new tab would: a full load with the fragment already in the address.
  await page.evaluate(nextHash => { window.location.hash = nextHash; }, new URL(url).hash);
  // Reload only once the 3D models have finished downloading: iPhone WebKit
  // reports each download a reload cancels as a page error.
  await waitForSceneDownloads(page);
  await page.reload();
  const banner = page.getByRole('region', { name: '只读分享', exact: true });
  await expect(banner).toBeVisible();
  await expect(page.getByRole('button', { name: '保存项目', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '重置视角', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: '桌面模板', exact: true })).toBeDisabled();
  await expect(page.getByRole('region', { name: '开始搭建', exact: true })).toHaveCount(0);
  await expect(page.getByText(/只读分享，可以转视角查看/)).toBeVisible();
  await page.getByRole('button', { name: /^改进建议/ }).click();
  const advice = page.getByRole('dialog', { name: '自动检查与改进建议', exact: true });
  await expect(advice.getByRole('button', { name: '让 AI 看看', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(advice).toHaveCount(0);
  expect(await readStorage(page)).toBe(mine);

  await page.getByRole('button', { name: '更多', exact: true }).click();
  await page.getByRole('menu', { name: '更多', exact: true }).getByRole('menuitem', { name: '购线清单', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '购线清单', exact: true })).toContainText('HDMI 线');
  await page.keyboard.press('Escape');

  page.once('dialog', popup => popup.dismiss());
  await banner.getByRole('button', { name: '复制一份到我的项目', exact: true }).click();
  await expect(banner).toBeVisible();
  expect(await readStorage(page)).toBe(mine);

  page.once('dialog', popup => popup.accept());
  await banner.getByRole('button', { name: '复制一份到我的项目', exact: true }).click();
  await expect(banner).toHaveCount(0);
  await expect(page.getByRole('button', { name: '保存项目', exact: true })).toBeEnabled();
  await expect(page.getByText('已复制到当前项目，尚未保存')).toBeVisible();
  expect(await readStorage(page)).toBe(mine);

  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('Enter on the copy button copies the share link', async ({ page, context, browserName }) => {
  await rememberClipboard(page, context, browserName);
  const evidence = await openProject(page, sharedObjects, sharedConnections);
  await page.getByRole('button', { name: '更多', exact: true }).click();
  await page.getByRole('menu', { name: '更多', exact: true }).getByRole('menuitem', { name: '复制分享链接', exact: true }).click();
  const copy = page.getByRole('dialog', { name: '分享链接', exact: true }).getByRole('button', { name: '复制链接', exact: true });
  await copy.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('分享链接已复制', { exact: true })).toBeVisible();
  const url = await page.evaluate(async () => {
    try { return await navigator.clipboard.readText(); }
    catch { return window.__deskLabCopied || ''; }
  });
  expect(url).toContain('#desklab-share-2.');
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('a damaged share link explains itself and leaves the saved desk', async ({ page }) => {
  const evidence = await openProject(page, [box('我的桌子')]);
  const before = await readStorage(page);
  await page.evaluate(() => { window.location.hash = '#desklab-share-1.not-a-real-link'; });
  await waitForSceneDownloads(page); // see the reload above
  await page.reload();
  await expect(page.getByText('分享链接已损坏，打不开。已打开你自己的桌面。')).toBeVisible();
  await expect(page.getByRole('region', { name: '只读分享', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '保存项目', exact: true })).toBeEnabled();
  expect(await readStorage(page)).toBe(before);
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('a very long share link warns before it is copied', async ({ page }) => {
  const noisy = { ...box('桌子'), name: randomBytes(1800).toString('base64url') };
  const evidence = await openProject(page, [noisy]);
  await page.getByRole('button', { name: '更多', exact: true }).click();
  await page.getByRole('menu', { name: '更多', exact: true }).getByRole('menuitem', { name: '复制分享链接', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '分享链接', exact: true });
  await expect(dialog).toContainText('可能打不开');
  expect(await dialog.getByLabel('分享链接', { exact: true }).inputValue()).toContain('#desklab-share-2.');
  expect(evidence).toEqual({ errors: [], writes: [] });
});

// The share dialog opens after an await (the link is compressed first), so
// React updates the Escape listener only after the dialog is already on the
// page. An Escape pressed in that moment used to reach the old listener.
test('Escape closes the share dialog even when pressed the moment it appears', async ({ page }) => {
  const evidence = await openProject(page, [box('桌子 A')]);
  await page.evaluate(() => {
    new MutationObserver((records, observer) => {
      const dialog = document.querySelector('[role="dialog"][aria-label="分享链接"], [role="dialog"][aria-labelledby]');
      if (!dialog || !/分享链接/.test(dialog.textContent)) return;
      observer.disconnect();
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      window.escapeSentAsDialogAppeared = true;
    }).observe(document.body, { childList: true, subtree: true });
  });
  await page.getByRole('button', { name: '更多', exact: true }).click();
  await page.getByRole('menu', { name: '更多', exact: true }).getByRole('menuitem', { name: '复制分享链接', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.escapeSentAsDialogAppeared)).toBe(true);
  await expect(page.getByRole('dialog', { name: '分享链接', exact: true })).toHaveCount(0);
  expect(evidence).toEqual({ errors: [], writes: [] });
});
