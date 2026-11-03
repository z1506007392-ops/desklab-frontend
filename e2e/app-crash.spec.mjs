import { test, expect } from '@playwright/test';
import { PROJECT_STORAGE_KEY } from '../src/domain/local-project-store.js';
import { PHONE_NOTICE_STORAGE_KEY } from '../src/domain/phone-notice.js';
import { isProjectEnvelope } from '../src/domain/project-validation.js';
import { box } from './project-fixture.mjs';

test('a crash in the page shell keeps the saved desk and a refresh recovers', async ({ page }) => {
  const project = {
    id: 'default',
    updatedAt: '2026-09-09T00:00:00.000Z',
    room: { length: 10, width: 10, height: 3 },
    objects: [box('已保存的桌子')],
    connections: [],
  };
  expect(isProjectEnvelope(project, { requireStoredFields: true })).toBe(true);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.addInitScript(({ projectKey, projectRaw, phoneKey }) => {
    localStorage.setItem(projectKey, projectRaw);
    localStorage.setItem(phoneKey, '1');
    const stored = sessionStorage.getItem('desklab-shell-crash-left');
    const count = stored === null ? 1 : Number(stored);
    if (count > 0) {
      window.__DESKLAB_E2E_CRASH_SHELL__ = true;
      sessionStorage.setItem('desklab-shell-crash-left', String(count - 1));
    }
  }, {
    projectKey: PROJECT_STORAGE_KEY,
    projectRaw: JSON.stringify(project),
    phoneKey: PHONE_NOTICE_STORAGE_KEY,
  });

  await page.goto('/');
  const alert = page.getByRole('alert', { name: '出错提示' });
  await expect(alert).toContainText('页面出了点问题');
  await expect(alert).toContainText('可以刷新页面再试，你保存过的桌面不受影响');
  await alert.getByRole('button', { name: '刷新页面', exact: true }).click();
  await expect(page.getByRole('button', { name: '保存项目', exact: true })).toBeEnabled();
  await expect(alert).toHaveCount(0);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key), PROJECT_STORAGE_KEY)).toContain('已保存的桌子');
  expect(errors.filter(message => !/页面外壳|above error|React will try|consider adding an error boundary/.test(message))).toEqual([]);
});
