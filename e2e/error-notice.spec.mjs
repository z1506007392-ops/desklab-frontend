import { test, expect } from '@playwright/test';
import { box, openProject } from './project-fixture.mjs';

test('an unexpected error is explained, can be copied, and dismissed', async ({ page, context, browserName }) => {
  // Clipboard permissions exist only in Chromium. WebKit accepts the write
  // from the button but refuses a later readText() outside that gesture, so
  // remember the text the app actually passed to writeText.
  await page.addInitScript(() => {
    window.__deskLabRejections = [];
    window.addEventListener('unhandledrejection', event => {
      const reason = event.reason;
      window.__deskLabRejections.push(reason instanceof Error ? reason.message : String(reason ?? ''));
    });
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
  const evidence = await openProject(page, [box('桌子 A')]);
  const notice = page.getByRole('alert', { name: '出错提示' });
  await expect(notice).toHaveCount(0);

  await page.evaluate(() => setTimeout(() => { throw new Error('测试用的错误'); }, 0));
  await expect(notice).toContainText('页面出了点问题');
  await expect(notice).toContainText('你保存过的桌面不受影响');
  await notice.getByRole('button', { name: '复制错误信息', exact: true }).click();
  await expect(notice.getByRole('button', { name: '已复制', exact: true })).toBeVisible();
  const copied = await page.evaluate(async () => {
    try { return await navigator.clipboard.readText(); } catch { return window.__deskLabCopied || ''; }
  });
  expect(copied).toContain('错误：测试用的错误');
  expect(copied).toContain('DeskLab 错误信息');

  await notice.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(notice).toHaveCount(0);

  await page.evaluate(() => { Promise.reject(new Error('没人处理的 Promise')); });
  await expect(notice).toBeVisible();
  const rejections = await page.evaluate(() => window.__deskLabRejections || []);
  const seen = new Set([...evidence.errors, ...rejections]);
  expect(seen.has('测试用的错误')).toBe(true);
  expect(seen.has('没人处理的 Promise')).toBe(true);
  expect(evidence.writes).toEqual([]);
});

test('handled noise does not raise the notice', async ({ page }) => {
  const evidence = await openProject(page, [box('桌子 A')]);
  await page.evaluate(() => {
    setTimeout(() => { throw new Error('ResizeObserver loop completed with undelivered notifications.'); }, 0);
    Promise.reject(new Error('Could not load /models/router.glb: fetch failed'));
  });
  await page.waitForTimeout(500);
  await expect(page.getByRole('alert', { name: '出错提示' })).toHaveCount(0);
  expect(evidence.writes).toEqual([]);
});
