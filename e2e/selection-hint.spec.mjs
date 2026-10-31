import { test, expect } from '@playwright/test';
import { openProject } from './project-fixture.mjs';

async function expectFullyVisible(hint) {
  await expect(hint).toBeVisible();
  const fits = await hint.evaluate(element => element.scrollWidth <= element.clientWidth);
  expect(fits, 'the hint is not cut off at the right edge').toBe(true);
}

test('the hint under the toolbar fits the screen and names the selected device in plain words', async ({ page }, testInfo) => {
  const evidence = await openProject(page, []);
  const mobile = testInfo.project.use.viewport.width < 900;
  const hint = page.locator('.selection-hint');

  await expect(hint).toHaveText(mobile ? '点选设备即可编辑' : '点选 3D 画面中的设备，即可在右侧面板编辑');
  await expectFullyVisible(hint);

  // Adding a device from the library selects it.
  const openLibrary = page.getByRole('button', { name: '展开资产库', exact: true });
  if (await openLibrary.isVisible()) await openLibrary.click();
  await page.getByPlaceholder('搜索设备名称、类型、型号...').fill('27 英寸显示器');
  await page.getByRole('button', { name: /^27 英寸显示器/ }).click();

  await expect(hint).toContainText('已选中：27 英寸显示器');
  await expect(hint).not.toContainText('monitor');
  if (mobile) await expect(hint).not.toContainText('Shift');
  await expectFullyVisible(hint);
  expect(evidence).toEqual({ errors: [], writes: [] });
});
