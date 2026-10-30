import { expect } from '@playwright/test';
import { isProjectEnvelope } from '../src/domain/project-validation.js';
import { PROJECT_STORAGE_KEY } from '../src/domain/local-project-store.js';

export function box(id, x = 0) {
  return {
    id, name: id, type: 'furniture', shape: 'box',
    position: { x, y: 0, z: 0.5 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    ports: [],
  };
}

export async function openProject(page, objects, connections = []) {
  const project = {
    id: 'default', updatedAt: '2026-09-09T00:00:00.000Z',
    room: { length: 10, width: 10, height: 3 }, objects, connections,
  };
  expect(isProjectEnvelope(project, { requireStoredFields: true })).toBe(true);
  const errors = [];
  const writes = [];
  page.on('pageerror', error => {
    errors.push(error.message);
    console.error('Browser runtime error:', error.message);
  });
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  // The project is seeded into this browser's storage once per tab (a reload
  // must show what the user saved, not the seed). Projects never go to a
  // server, so any API request is recorded as unexpected.
  await page.addInitScript(({ key, raw }) => {
    if (sessionStorage.getItem('desklab-e2e-seeded')) return;
    localStorage.setItem(key, raw);
    sessionStorage.setItem('desklab-e2e-seeded', '1');
  }, { key: PROJECT_STORAGE_KEY, raw: JSON.stringify(project) });
  await page.route('**/api/**', route => {
    writes.push(`${route.request().method()} ${route.request().url()}`);
    return route.abort();
  });
  await page.goto('/');
  await expect(page).toHaveTitle('DeskLab');
  await expect(page.getByRole('button', { name: '保存项目', exact: true })).toBeEnabled();
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  return { errors, writes };
}
