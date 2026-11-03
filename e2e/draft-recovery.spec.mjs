import { test, expect } from '@playwright/test';
import { createProjectDraft } from '../src/domain/draft.js';
import { PROJECT_STORAGE_KEY } from '../src/domain/local-project-store.js';
import { box, openProject, waitForSceneDownloads } from './project-fixture.mjs';

const DRAFT_KEY = 'desklab.project-draft.v1';

function draftOf(name) {
  return createProjectDraft({
    room: { length: 10, width: 10, height: 3 },
    objects: [box(name)],
    connections: [],
  }, '2026-11-04T01:00:00.000Z');
}

async function seedDraft(page, name) {
  await waitForSceneDownloads(page);
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), {
    key: DRAFT_KEY,
    raw: JSON.stringify(draftOf(name)),
  });
  await page.reload();
  const banner = page.getByRole('alert').filter({ hasText: '发现未保存的本地草稿' });
  await expect(banner).toBeVisible();
  await expect(page.getByRole('button', { name: '保存项目', exact: true })).toBeDisabled();
  return banner;
}

async function savedProject(page) {
  return page.evaluate(key => localStorage.getItem(key), PROJECT_STORAGE_KEY);
}

test('discarding a local draft leaves the saved desk', async ({ page }) => {
  const evidence = await openProject(page, [box('已保存的桌子')]);
  const banner = await seedDraft(page, '草稿里的台灯');
  await banner.getByRole('button', { name: '放弃', exact: true }).click();
  await expect(page.getByText('已放弃本地草稿', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '保存项目', exact: true })).toBeEnabled();
  const saved = await savedProject(page);
  expect(saved).toContain('已保存的桌子');
  expect(saved).not.toContain('草稿里的台灯');
  expect(await page.evaluate(key => localStorage.getItem(key), DRAFT_KEY)).toBeNull();
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('restoring a local draft can be undone and does not replace the save', async ({ page }) => {
  const evidence = await openProject(page, [box('已保存的桌子')]);
  const banner = await seedDraft(page, '草稿里的台灯');
  await banner.getByRole('button', { name: '恢复草稿', exact: true }).click();
  await expect(page.getByText('已恢复本地草稿，请确认后保存', { exact: true })).toBeVisible();
  const openPanel = page.getByRole('button', { name: '展开属性面板', exact: true });
  if (await openPanel.isVisible()) await openPanel.click();
  const picker = page.getByLabel('设备', { exact: true });
  await expect(picker.locator('option', { hasText: '草稿里的台灯' })).toHaveCount(1);
  const saved = await savedProject(page);
  expect(saved).toContain('已保存的桌子');
  expect(saved).not.toContain('草稿里的台灯');

  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(picker.locator('option', { hasText: '草稿里的台灯' })).toHaveCount(0);
  await expect(picker.locator('option', { hasText: '已保存的桌子' })).toHaveCount(1);
  expect(evidence).toEqual({ errors: [], writes: [] });
});
