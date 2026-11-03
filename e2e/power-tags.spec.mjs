import { test, expect } from '@playwright/test';
import { openProject } from './project-fixture.mjs';
import { hydrateProjectObjects } from '../src/domain/catalog.js';
import { buildTemplateScene } from '../src/domain/desk-templates.js';
import { findPowerTags } from '../src/domain/power-tags.js';

const ROOM = { length: 4, width: 3.5, height: 2.7 };

// The gaming desk with its strip rated lower than what is plugged into it.
function overloadedGamingDesk(stripLimit) {
  const scene = buildTemplateScene('gaming');
  const objects = hydrateProjectObjects(scene.objects);
  const strip = objects.find(object => object.modelId === 'power-strip');
  strip.maxLoad = stripLimit;
  return { objects, connections: scene.connections, strip };
}

test('an overloaded strip carries a tag, and once selected its load is in the panel instead', async ({ page }) => {
  const { objects, connections, strip } = overloadedGamingDesk(400);
  const [expected] = findPowerTags(objects, connections);
  expect(expected.text).toMatch(/^超载 \d+W \/ 400W$/);
  const evidence = await openProject(page, objects, connections, { room: ROOM });

  const powerTag = page.locator('.power-tag');
  await expect(powerTag).toHaveText([expected.text]);

  await page.getByRole('button', { name: /^布线检查/ }).click();
  const report = page.getByRole('dialog', { name: '布线检查', exact: true });
  await report.locator('.wiring-issue').filter({ hasText: '电源负载超标' })
    .getByRole('button', { name: /^定位/ }).click();
  await expect(page.locator('.scene-tag')).toHaveText(strip.name);
  await expect(powerTag).toHaveCount(0);
  await expect(page.getByText(/^已接负载：/)).toHaveText(`已接负载：${expected.load}W / 400W`);
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('a desk whose power is fine shows no power tags', async ({ page }) => {
  const evidence = await openProject(page, [], [], { room: ROOM });
  await page.getByRole('button', { name: '桌面模板', exact: true }).click();
  await page.getByRole('dialog', { name: '桌面模板', exact: true })
    .getByRole('button', { name: '使用模板：超宽', exact: true }).click();
  const openLibrary = page.getByRole('button', { name: '展开资产库', exact: true });
  if (await openLibrary.isVisible()) await openLibrary.click();
  await page.getByRole('button', { name: '显示器', exact: true }).click();
  await page.getByRole('button', { name: /^27 英寸显示器/ }).click();
  // The selection tag shows the overlay is drawn; no power tag beside it.
  await expect(page.locator('.scene-tag')).toBeVisible();
  await expect(page.locator('.power-tag')).toHaveCount(0);
  expect(evidence).toEqual({ errors: [], writes: [] });
});
