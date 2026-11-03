import { test, expect } from '@playwright/test';
import { openProject } from './project-fixture.mjs';

test('without WebGL the page explains it and everything else still works', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function getContext(type, ...rest) {
      if (/webgl/i.test(type)) return null;
      return original.call(this, type, ...rest);
    };
  });
  const evidence = await openProject(page, []);

  await expect(page.getByRole('alert').filter({ hasText: '你的浏览器无法显示 3D 画面' })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);

  await page.getByRole('button', { name: '桌面模板', exact: true }).click();
  await page.getByRole('button', { name: '使用模板：超宽', exact: true }).click();
  await page.getByRole('button', { name: '所有连接', exact: true }).click();
  const list = page.getByRole('dialog', { name: '全部连接清单', exact: true });
  await expect(list).toContainText('台式主机网线');
  await list.getByRole('button', { name: /关闭/ }).click();
  await page.getByRole('button', { name: '保存项目', exact: true }).click();
  await expect(page.getByText(/^已保存$/)).toBeVisible();
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('missing model files fall back to simple shapes without breaking the 3D view', async ({ page }) => {
  await page.route(/\/models\/[^/?#]+\.glb(?:\?.*)?$/, route => route.fulfill({ status: 404, body: '' }));
  const evidence = await openProject(page, []);
  await page.getByRole('button', { name: '桌面模板', exact: true }).click();
  await page.getByRole('button', { name: '使用模板：超宽', exact: true }).click();
  await page.waitForTimeout(1500);
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: '3D 画面' })).toHaveCount(0);
  // The browser logs the 404. R3F also reports the caught load error globally
  // (the view falls back to a box; the app does not raise the error notice).
  expect(evidence.errors.filter(message => !/^Failed to load resource/.test(message) && !/^Could not load /.test(message))).toEqual([]);
  expect(evidence.writes).toEqual([]);
});

test('if the 3D view crashes, the rest of the page survives and the view can be reloaded', async ({ page }) => {
  // The up-front check gets a context, the renderer's first attempt does
  // not (as when a GPU process dies), and later attempts work again.
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    // The renderer passes context attributes; the up-front check does not.
    let rendererFailed = false;
    HTMLCanvasElement.prototype.getContext = function getContext(type, ...rest) {
      if (/webgl/i.test(type) && rest.length > 0 && !rendererFailed) {
        rendererFailed = true;
        return null;
      }
      return original.call(this, type, ...rest);
    };
  });
  const evidence = await openProject(page, []);

  const fallback = page.getByRole('alert').filter({ hasText: '3D 画面出了点问题' });
  await expect(fallback).toBeVisible();
  await page.getByRole('button', { name: '桌面模板', exact: true }).click();
  await page.getByRole('button', { name: '使用模板：超宽', exact: true }).click();
  await expect(page.getByRole('button', { name: '保存项目', exact: true })).toBeEnabled();

  await fallback.getByRole('button', { name: '重新加载 3D 画面', exact: true }).click();
  await expect(fallback).toHaveCount(0);
  await expect(page.locator('canvas')).toBeVisible();
  // React reports the caught render error once; nothing else may fail.
  expect(evidence.errors.filter(message => !/WebGL|context/i.test(message))).toEqual([]);
  expect(evidence.writes).toEqual([]);
});

test('if the 3D code fails to download, a page refresh fetches it again', async ({ page }) => {
  let failSceneCode = true;
  await page.route(/\/(src\/components\/Scene3D\.jsx|assets\/Scene3D-[^/]+\.js)(\?.*)?$/, route => (
    failSceneCode ? route.abort('failed') : route.fallback()
  ));
  const evidence = await openProject(page, []);

  const fallback = page.getByRole('alert').filter({ hasText: '3D 画面没有下载完整' });
  await expect(fallback).toBeVisible();
  await expect(page.getByRole('button', { name: '保存项目', exact: true })).toBeEnabled();

  failSceneCode = false;
  await fallback.getByRole('button', { name: '刷新页面', exact: true }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: '3D 画面' })).toHaveCount(0);
  expect(evidence.writes).toEqual([]);
});
