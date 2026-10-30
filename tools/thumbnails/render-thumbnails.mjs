// Renders public/thumbnails/<modelId>.webp, the small pictures on the asset
// library cards, from the catalog GLBs in public/models/. Rerun after
// changing or adding a model:
//
//   node tools/thumbnails/render-thumbnails.mjs
//
// It starts Vite (so render.html can import three), opens the page in
// Playwright's Chromium (set CHROMIUM_PATH to use another binary), renders
// each model on a transparent background, and writes each image with a
// small .webp.json note saying where it came from.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { chromium } from 'playwright';
import { createServer } from 'vite';

import { DEVICE_CATALOG } from '../../src/domain/catalog.js';

export const THUMBNAIL_SIZE = 112; // drawn at 56 px, so sharp on 2x screens

// Camera direction (three.js x right, y up, z toward the front) for devices
// people recognise from above: a power strip by its row of sockets.
const VIEWS = { 'power-strip': [0.35, 1.1, 0.8] };

const root = fileURLToPath(new URL('../..', import.meta.url));
const outDir = new URL('../../public/thumbnails/', import.meta.url);

const server = await createServer({ root, logLevel: 'error', server: { host: '127.0.0.1', port: 0 } });
await server.listen();
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage();
  page.on('pageerror', error => { throw error; });
  await page.goto(`${server.resolvedUrls.local[0]}tools/thumbnails/render.html`);
  await page.waitForFunction(() => window.thumbnailsReady === true);
  await mkdir(outDir, { recursive: true });
  for (const model of DEVICE_CATALOG.flatMap(category => category.models)) {
    const dataUrl = await page.evaluate(
      ([url, size, view]) => window.renderThumbnail(url, size, view),
      [`/models/${model.modelId}.glb`, THUMBNAIL_SIZE, VIEWS[model.modelId]],
    );
    if (!dataUrl.startsWith('data:image/webp;base64,')) throw new Error(`${model.modelId}: not a WebP`);
    await writeFile(new URL(`${model.modelId}.webp`, outDir), Buffer.from(dataUrl.split(',')[1], 'base64'));
    // Provenance next to the image, in the sidecar format impeccable's
    // `embed-prompt` uses for WebP (`embed-prompt --scan public/thumbnails`).
    const provenance = { prompt: `origin: rendered from public/models/${model.modelId}.glb by tools/thumbnails/render-thumbnails.mjs`, createdAt: new Date().toISOString() };
    await writeFile(new URL(`${model.modelId}.webp.json`, outDir), `${JSON.stringify(provenance, null, 2)}\n`);
    console.log(`thumbnails/${model.modelId}.webp`);
  }
} finally {
  await browser.close();
  await server.close();
}
