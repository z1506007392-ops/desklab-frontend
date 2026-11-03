import { test, expect } from '@playwright/test';
import { openProject } from './project-fixture.mjs';

// jsDelivr, where Troika fetches fonts a page does not supply, is often slow
// or unreachable from mainland China. The 3D view must not depend on it: the
// axis letters come from this site, and nothing else is fetched from outside.
const DRAWN_MIN_BYTES = 20000; // see scene-render.spec.mjs

test('the 3D view draws with jsDelivr unreachable, and the page fetches nothing from other sites', async ({ page }) => {
  const outside = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) && !['data:', 'blob:'].includes(url.protocol)) outside.push(request.url());
  });
  await page.route('**/cdn.jsdelivr.net/**', route => route.abort());
  const evidence = await openProject(page, []);
  await page.getByRole('button', { name: '桌面模板', exact: true }).click();
  await page.getByRole('button', { name: '使用模板：超宽', exact: true }).click();
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  await expect.poll(async () => (await canvas.screenshot()).length, { timeout: 15000 }).toBeGreaterThan(DRAWN_MIN_BYTES);
  expect(outside).toEqual([]);
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('if the axis letters cannot load, only the letters are missing', async ({ page }) => {
  await page.route(/\/fonts\/axis-label\.woff(?:\?.*)?$/, route => route.abort());
  const evidence = await openProject(page, []);
  await page.getByRole('button', { name: '桌面模板', exact: true }).click();
  await page.getByRole('button', { name: '使用模板：超宽', exact: true }).click();
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  await expect.poll(async () => (await canvas.screenshot()).length, { timeout: 15000 }).toBeGreaterThan(DRAWN_MIN_BYTES);
  // The failed font download is the only complaint.
  expect(evidence.errors.filter(error => !/Failed to fetch|Load failed|axis-label|Failure loading font/.test(error))).toEqual([]);
  expect(evidence.writes).toEqual([]);
});
