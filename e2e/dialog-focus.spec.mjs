import { test, expect } from '@playwright/test';
import { box, openProject } from './project-fixture.mjs';

test('a dialog keeps keyboard focus inside and returns it when closed', async ({ page }) => {
  const evidence = await openProject(page, [box('桌子 A')]);
  const opener = page.getByRole('button', { name: '桌面模板', exact: true });
  await opener.click();
  const dialog = page.getByRole('dialog', { name: '桌面模板', exact: true });
  await expect(dialog).toBeVisible();
  await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);

  const firstLabel = await dialog.evaluate(element => {
    const items = [...element.querySelectorAll('button:not([disabled]), input:not([disabled])')];
    items[0].focus();
    return items.at(-1).getAttribute('aria-label') || items.at(-1).textContent;
  });
  await page.keyboard.press('Shift+Tab');
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent)).toBe(firstLabel);

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('arrow keys move between the property and connection tabs', async ({ page }) => {
  const evidence = await openProject(page, [box('桌子 A')]);
  const openPanel = page.getByRole('button', { name: '展开属性面板', exact: true });
  if (await openPanel.isVisible()) await openPanel.click();
  const properties = page.getByRole('tab', { name: '属性', exact: true });
  const connections = page.getByRole('tab', { name: '连接', exact: true });
  await properties.focus();
  await page.keyboard.press('ArrowRight');
  await expect(connections).toBeFocused();
  await expect(connections).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowLeft');
  await expect(properties).toBeFocused();
  await expect(properties).toHaveAttribute('aria-selected', 'true');
  expect(evidence).toEqual({ errors: [], writes: [] });
});
