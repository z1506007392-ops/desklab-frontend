import { test, expect } from '@playwright/test';
import { openProject } from './project-fixture.mjs';

test('library cards show a picture of each device without changing their names', async ({ page }) => {
  const evidence = await openProject(page, []);
  const openLibrary = page.getByRole('button', { name: '展开资产库', exact: true });
  if (await openLibrary.isVisible()) await openLibrary.click();
  await page.getByRole('button', { name: '供电', exact: true }).click();

  const card = page.getByRole('button', { name: /^插排/ });
  await expect(card).toHaveAccessibleName('插排 6 孔 · 最大 2500W');
  const picture = card.locator('img');
  await expect(picture).toHaveAttribute('alt', '');
  await expect(picture).toHaveAttribute('src', '/thumbnails/power-strip.webp');
  await expect.poll(() => picture.evaluate(img => img.complete && img.naturalWidth)).toBe(112);

  expect(evidence).toEqual({ errors: [], writes: [] });
});
