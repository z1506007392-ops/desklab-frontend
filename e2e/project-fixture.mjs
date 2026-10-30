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

/**
 * Open the app with `objects` and `connections` stored as the saved project.
 * Options:
 * - saved: false opens it as a first-time visitor with nothing stored.
 * - ai: (requestBody) => responseJson | { status, json } answers
 *   POST /api/ai/layout; each request body is collected in
 *   evidence.aiRequests. Without it, an AI request fails the test like any
 *   other /api call.
 */
export async function openProject(page, objects, connections = [], { saved = true, ai = null } = {}) {
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
  if (saved) {
    await page.addInitScript(({ key, raw }) => {
      if (sessionStorage.getItem('desklab-e2e-seeded')) return;
      localStorage.setItem(key, raw);
      sessionStorage.setItem('desklab-e2e-seeded', '1');
    }, { key: PROJECT_STORAGE_KEY, raw: JSON.stringify(project) });
  }
  await page.route('**/api/**', route => {
    writes.push(`${route.request().method()} ${route.request().url()}`);
    return route.abort();
  });
  // Registered later, so Playwright tries it before the catch-all above.
  const aiRequests = [];
  if (ai) {
    await page.route('**/api/ai/layout', async route => {
      if (route.request().method() !== 'POST') return route.fallback();
      const body = route.request().postDataJSON();
      aiRequests.push(body);
      const answer = await ai(body);
      const { status = 200, json = answer } = answer && 'status' in answer && 'json' in answer ? answer : {};
      return route.fulfill({ status, json });
    });
  }
  await page.goto('/');
  await expect(page).toHaveTitle('DeskLab');
  await expect(page.getByRole('button', { name: '保存项目', exact: true })).toBeEnabled();
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  return ai ? { errors, writes, aiRequests } : { errors, writes };
}
