import { test, expect } from '@playwright/test';
import { openProject } from './project-fixture.mjs';
import { decodePng } from './png-pixels.mjs';

// The first room after "生成这个房间" used to be a wireframe on an infinite
// grid, with the debug axes in front and the desk actions under the phone
// toolbar. These checks replace that picture on purpose: a solid floor, no
// axis colours, the whole room inside the canvas above the sheet, and both
// actions inside the visible viewport. No screenshot baseline — WebGL pixels
// shift across GPUs, so the ranges stay wide.

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 375, height: 667 },
  { width: 1440, height: 900 },
];

function roomFrameReport(buffer) {
  const { width, height, data } = decodePng(buffer);
  if (width < 2 || height < 2) return 'canvas has no pixels';
  const at = (x, y) => {
    const i = (y * width + x) * 4;
    return { r: data[i], g: data[i + 1], b: data[i + 2] };
  };
  const background = at(1, 1);
  const distance = (color, other) => (
    Math.abs(color.r - other.r) + Math.abs(color.g - other.g) + Math.abs(color.b - other.b)
  );
  if (background.r < 180 || background.g < 180 || background.b < 180) {
    return `corner is not the empty background (${background.r},${background.g},${background.b})`;
  }

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let room = 0;
  let warm = 0;
  let axis = 0;
  const step = Math.max(1, Math.floor(Math.min(width, height) / 180));
  // The element shot picks up a pixel or two of the sheet along the canvas
  // edge. That fringe is not the room.
  const fringe = 4;
  for (let y = fringe; y < height - fringe; y += step) {
    for (let x = fringe; x < width - fringe; x += step) {
      const color = at(x, y);
      const pureRed = color.r > 200 && color.g < 50 && color.b < 50;
      const pureGreen = color.g > 200 && color.r < 50 && color.b < 50;
      const pureBlue = color.b > 200 && color.r < 50 && color.g < 80;
      if (pureRed || pureGreen || pureBlue) axis += 1;
      const sheet = color.r > 248 && color.g > 248 && color.b > 248;
      if (sheet || distance(color, background) < 28) continue;
      room += 1;
      if (color.r > color.b + 10 && color.r + 8 >= color.g && color.g + 12 >= color.b && color.r > 150) {
        warm += 1;
      }
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  const samples = Math.ceil((width - fringe * 2) / step) * Math.ceil((height - fringe * 2) / step);
  if (room < samples * 0.04) return `room too small ${room}/${samples}`;
  if (warm < room * 0.12) return `floor not warm ${warm}/${room}`;
  if (axis > 12) return `axis pixels ${axis}`;
  const marginX = Math.min(minX, width - 1 - maxX) / width;
  const marginY = Math.min(minY, height - 1 - maxY) / height;
  if (marginX < 0.02) return `horizontal margin ${marginX.toFixed(3)}`;
  if (marginY < 0.02) return `vertical margin ${marginY.toFixed(3)}`;
  const centerX = (minX + maxX) / 2 / width;
  const centerY = (minY + maxY) / 2 / height;
  if (Math.abs(centerX - 0.5) > 0.12) return `off center x ${centerX.toFixed(3)}`;
  if (Math.abs(centerY - 0.5) > 0.16) return `off center y ${centerY.toFixed(3)}`;
  return 'ok';
}

async function expectDeskActionsInside(page) {
  const fit = await page.evaluate(() => {
    const view = window.visualViewport;
    const width = view?.width ?? window.innerWidth;
    const height = view?.height ?? window.innerHeight;
    const names = ['用电竞桌', '自己摆'];
    const buttons = names.map(name => {
      const button = [...document.querySelectorAll('button')].find(node => node.textContent.trim() === name);
      const rect = button.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return {
        name,
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        hit: hit?.closest('button')?.textContent?.trim() ?? '',
      };
    });
    return {
      width,
      height,
      scroll: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      buttons,
    };
  });
  expect(fit.scroll, 'the page scrolls, so the sheet is taller than the screen').toBeLessThanOrEqual(1);
  for (const button of fit.buttons) {
    expect(button.top, button.name).toBeGreaterThanOrEqual(-0.5);
    expect(button.left, button.name).toBeGreaterThanOrEqual(-0.5);
    expect(button.right, button.name).toBeLessThanOrEqual(fit.width + 0.5);
    expect(button.bottom, button.name).toBeLessThanOrEqual(fit.height + 0.5);
    expect(button.hit, button.name).toBe(button.name);
  }
}

test.beforeEach(({ }, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile',
    'the desktop Chrome project already repeats these viewports',
  );
});

for (const viewport of VIEWPORTS) {
  test(`the first room reads as a room at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const evidence = await openProject(page, [], [], { saved: false });
    await page.getByRole('button', { name: '生成这个房间', exact: true }).click();
    const desk = page.getByRole('dialog', { name: '放一张桌子', exact: true });
    await expect(desk).toBeVisible();
    await expect(desk.getByRole('button', { name: '用电竞桌', exact: true })).toBeVisible();
    await expect(desk.getByRole('button', { name: '自己摆', exact: true })).toBeVisible();
    await expectDeskActionsInside(page);

    const fitted = await page.evaluate(async () => {
      // cssRules collapses the repeated height declarations, so read the
      // stylesheet source. Both units have to be in the file: 100vh is the
      // large viewport on iPhone Safari, and the later dvh/svh replace it.
      const parts = [...document.querySelectorAll('style')].map(node => node.textContent || '');
      for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
        parts.push(await fetch(link.href).then(response => response.text()));
      }
      const text = parts.join('\n');
      const viewportMeta = document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? '';
      return {
        safeArea: text.includes('safe-area-inset-bottom'),
        dvh: text.includes('100dvh'),
        svh: text.includes('100svh'),
        viewportFit: viewportMeta.includes('viewport-fit=cover'),
      };
    });
    expect(fitted).toEqual({ safeArea: true, dvh: true, svh: true, viewportFit: true });

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    await expect.poll(async () => roomFrameReport(await canvas.screenshot()), {
      timeout: 15000,
    }).toBe('ok');
    expect(evidence).toEqual({ errors: [], writes: [] });
  });
}
