import { test, expect } from '@playwright/test';
import { openProject, waitForSceneDownloads } from './project-fixture.mjs';

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

// E62: the canvas draws on demand. A desk that sits still costs nothing,
// and turning the view or selecting a device still draws.
test('the 3D view draws only when something changes', async ({ page }) => {
  await page.addInitScript(() => {
    window.desklabDrawCalls = 0;
    for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
      for (const name of ['drawElements', 'drawArrays']) {
        const original = proto[name];
        proto[name] = function draw(...args) {
          window.desklabDrawCalls += 1;
          return original.apply(this, args);
        };
      }
    }
  });
  const evidence = await openProject(page, []);
  await page.getByRole('button', { name: '桌面模板', exact: true }).click();
  await page.getByRole('button', { name: '使用模板：电竞桌', exact: true }).click();
  await waitForSceneDownloads(page);
  await expectCanvasDrawn(page);
  const draws = () => page.evaluate(() => window.desklabDrawCalls);
  // Once the loads, the orbit's easing and the status message are over,
  // two seconds go by without a single draw (it used to be 60 a second).
  await expect.poll(async () => {
    const start = await draws();
    await page.waitForTimeout(2000);
    return (await draws()) - start;
  }, { timeout: 15000 }).toBe(0);
  const settled = await draws();

  // Turning the view draws, and the picture changes.
  const canvas = page.locator('canvas');
  const before = await canvas.screenshot();
  const box = await canvas.boundingBox();
  const start = { x: box.x + box.width * 0.5, y: box.y + box.height * 0.12 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (let step = 1; step <= 10; step += 1) await page.mouse.move(start.x + step * 15, start.y);
  await page.mouse.up();
  await page.waitForTimeout(1000);
  expect(await draws()).toBeGreaterThan(settled);
  expect((await canvas.screenshot()).equals(before)).toBe(false);

  // Selecting a device from the panel draws its highlight and tag.
  const turned = await draws();
  const openPanel = page.getByRole('button', { name: '展开属性面板', exact: true });
  if (await openPanel.isVisible()) await openPanel.click();
  await page.getByLabel('设备', { exact: true }).selectOption({ label: '台式主机' });
  await expect(page.locator('.scene-tag')).toBeVisible();
  await expect.poll(draws).toBeGreaterThan(turned);
  expect(evidence).toEqual({ errors: [], writes: [] });
});
