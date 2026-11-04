import { test, expect } from '@playwright/test';
import { encodeShareLink } from '../src/domain/share-link.js';
import { box, openProject, waitForSceneDownloads } from './project-fixture.mjs';

const shared = {
  room: { length: 4, width: 3.5, height: 2.7 },
  objects: [box('桌子')],
  connections: [],
};

async function openShared(page, options) {
  const link = await encodeShareLink(shared, { origin: 'http://127.0.0.1:5174', pathname: '/', search: '' });
  const evidence = await openProject(page, [box('我的桌子')], [], options);
  await page.evaluate(nextHash => { window.location.hash = nextHash; }, link.hash);
  await waitForSceneDownloads(page);
  await page.reload();
  await expect(page.getByRole('region', { name: '只读分享', exact: true })).toBeVisible();
  return evidence;
}

async function openAdvice(page) {
  await page.getByRole('button', { name: /^改进建议/ }).click();
  return page.getByRole('dialog', { name: '自动检查与改进建议', exact: true });
}

test('a read-only share does not open login, and copying it does', async ({ page }) => {
  const evidence = await openShared(page, { session: null });
  const advice = await openAdvice(page);
  const ask = advice.getByRole('button', { name: '让 AI 看看', exact: true });
  await expect(ask).toBeDisabled();
  await expect(page.getByRole('dialog', { name: '登录后使用 AI', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');

  page.once('dialog', popup => popup.accept());
  await page.getByRole('region', { name: '只读分享', exact: true }).getByRole('button', { name: '复制一份到我的项目', exact: true }).click();
  await expect(page.getByRole('region', { name: '只读分享', exact: true })).toHaveCount(0);

  const own = await openAdvice(page);
  await own.getByRole('button', { name: '让 AI 看看', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '登录后使用 AI', exact: true })).toBeVisible();
  expect(evidence.writes.filter(line => line.includes('/api/ai/layout'))).toEqual([]);
  expect(evidence.errors.filter(message => !/Failed to load resource|net::ERR_/.test(message))).toEqual([]);
});

test('after copying a share, a signed-in person can ask AI without the login dialog', async ({ page }) => {
  const evidence = await openShared(page, {
    session: { email: 'leo@example.com', remaining: 20 },
    ai: () => ({ version: 1, model: 'test', suggestions: [], remaining: 19 }),
    auth: { logout: () => ({ ok: true }) },
  });
  const advice = await openAdvice(page);
  await expect(advice.getByRole('button', { name: '让 AI 看看', exact: true })).toBeDisabled();
  await expect(advice.getByRole('button', { name: '退出', exact: true })).toBeDisabled();
  await expect(advice.getByLabel('想怎么改？（可选）')).toBeDisabled();
  await expect(page.getByRole('dialog', { name: '登录后使用 AI', exact: true })).toHaveCount(0);
  expect(evidence.aiRequests).toEqual([]);
  expect(evidence.writes.filter(line => line.includes('/api/auth/logout') || line.includes('/api/ai/layout'))).toEqual([]);
  await page.keyboard.press('Escape');

  page.once('dialog', popup => popup.accept());
  await page.getByRole('region', { name: '只读分享', exact: true }).getByRole('button', { name: '复制一份到我的项目', exact: true }).click();
  await expect(page.getByText('已复制到当前项目，尚未保存')).toBeVisible();

  const own = await openAdvice(page);
  await expect(own.getByRole('button', { name: '退出', exact: true })).toBeEnabled();
  await expect(own.getByLabel('想怎么改？（可选）')).toBeEnabled();
  await own.getByRole('button', { name: '让 AI 看看', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '登录后使用 AI', exact: true })).toHaveCount(0);
  await expect(own.getByText('AI 这次没有找到能让布局更好的改动。')).toBeVisible();
  await expect(own.getByText('今日剩余 19 次')).toBeVisible();
  expect(evidence.aiRequests).toHaveLength(1);
  await own.getByRole('button', { name: '退出', exact: true }).click();
  await expect(own.getByRole('button', { name: '退出', exact: true })).toHaveCount(0);
  expect(evidence.errors.filter(message => !/Failed to load resource|net::ERR_/.test(message))).toEqual([]);
});
