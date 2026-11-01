import { expect } from '@playwright/test';
import { DEVICE_CATALOG } from '../src/domain/catalog.js';
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
 * - room: the stored room size (default 10 x 10 x 3 m).
 * - ai: (requestBody) => responseJson | { status, json } answers
 *   POST /api/ai/layout; each request body is collected in
 *   evidence.aiRequests. Without it, an AI request fails the test like any
 *   other /api call.
 */
export async function openProject(page, objects, connections = [], { saved = true, ai = null, room = { length: 10, width: 10, height: 3 } } = {}) {
  const project = {
    id: 'default', updatedAt: '2026-09-09T00:00:00.000Z',
    room, objects, connections,
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
  trackDownloads(page);
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
  // Room for every request in the resource timing list (Vite's dev server
  // loads hundreds of modules), so waitForSceneDownloads can see the models.
  await page.addInitScript(() => performance.setResourceTimingBufferSize(5000));
  await page.goto('/');
  await expect(page).toHaveTitle('DeskLab');
  await expect(page.getByRole('button', { name: '保存项目', exact: true })).toBeEnabled();
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  return ai ? { errors, writes, aiRequests } : { errors, writes };
}

const MODEL_FILES = [...new Set(DEVICE_CATALOG.flatMap(({ models }) => models)
  .map(model => model.assetUrl).filter(Boolean))];

// Requests each page has started and not yet finished or failed.
const downloadsInFlight = new WeakMap();

function trackDownloads(page) {
  if (downloadsInFlight.has(page)) return;
  const inFlight = new Set();
  downloadsInFlight.set(page, inFlight);
  page.on('request', request => inFlight.add(request));
  page.on('requestfinished', request => inFlight.delete(request));
  page.on('requestfailed', request => inFlight.delete(request));
}

/**
 * Waits until the 3D view has finished downloading: every catalog model (it
 * fetches all of them once it loads), then nothing in flight for half a
 * second (the axis label font, anything else it loads). Call it before a
 * reload: iPhone WebKit reports each download a reload cancels as a page
 * error. 'networkidle' is not enough, since Playwright marks it once per page
 * load, possibly before the 3D view starts its downloads. Pages must have
 * been opened with openProject.
 */
export async function waitForSceneDownloads(page) {
  await page.waitForFunction(files => {
    const done = new Set(performance.getEntriesByType('resource').map(entry => new URL(entry.name).pathname));
    return files.every(file => done.has(file));
  }, MODEL_FILES);
  const inFlight = downloadsInFlight.get(page);
  let quietSince = Date.now();
  while (Date.now() - quietSince < 500) {
    if (inFlight.size > 0) quietSince = Date.now();
    await page.waitForTimeout(50);
  }
}
