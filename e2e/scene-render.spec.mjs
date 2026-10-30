import { test, expect } from '@playwright/test';
import { openProject } from './project-fixture.mjs';

// Guards against a canvas that mounts without errors but never draws (this
// happened under StrictMode with React.lazy). A blank canvas screenshot
// compresses to about 4 KB; the grid, room, and devices make it 45 KB+.
const DRAWN_MIN_BYTES = 20000;

async function expectCanvasDrawn(page) {
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  await expect.poll(async () => (await canvas.screenshot()).length, { timeout: 15000 }).toBeGreaterThan(DRAWN_MIN_BYTES);
}

test('the 3D view really draws the room and the devices', async ({ page }) => {
  const evidence = await openProject(page, []);
  await expectCanvasDrawn(page);
  await page.getByRole('button', { name: '桌面模板', exact: true }).click();
  await page.getByRole('button', { name: '使用模板：电竞桌', exact: true }).click();
  await expectCanvasDrawn(page);
  expect(evidence).toEqual({ errors: [], writes: [] });
});
