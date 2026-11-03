import { test, expect } from '@playwright/test';
import { box, openProject } from './project-fixture.mjs';

// Everything that used to wrap into five rows on a phone (E10).
const STRIP = ['展开资产库', /^改进建议/, /^布局检查/, /^布线检查/, '桌面模板', '社区图库', '所有连接', '重置视角', '展开属性面板', '更多'];

test('on a phone the toolbar is two rows and every action can still be reached', async ({ page }, testInfo) => {
  test.skip(testInfo.project.use.viewport.width >= 900, 'the compact toolbar is the phone layout');
  const evidence = await openProject(page, [box('桌子 A')]);

  const toolbar = await page.locator('.toolbar').boundingBox();
  expect(toolbar.height, 'the toolbar leaves the screen to the 3D view').toBeLessThanOrEqual(110);
  for (const name of ['撤销', '重做', '保存项目']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeInViewport({ ratio: 1 });
  }

  const strip = page.getByRole('group', { name: '工具', exact: true });
  for (const name of STRIP) {
    const button = strip.getByRole('button', typeof name === 'string' ? { name, exact: true } : { name });
    await button.scrollIntoViewIfNeeded();
    await expect(button).toBeInViewport({ ratio: 1 });
  }

  // Room size is not on the phone toolbar. Later edits are in 设置.
  await expect(page.getByRole('button', { name: '房间尺寸', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('长:', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '更多', exact: true }).click();
  await page.getByRole('menu', { name: '更多', exact: true }).getByRole('menuitem', { name: '设置', exact: true }).click();
  const settings = page.getByRole('dialog', { name: '设置', exact: true });
  await settings.getByLabel('长:', { exact: true }).fill('6');
  await settings.getByRole('button', { name: '更新房间', exact: true }).click();
  await expect(page.getByText('房间尺寸已更新', { exact: true })).toBeVisible();
  await settings.getByRole('button', { name: '关闭设置', exact: true }).click();
  await expect(settings).toHaveCount(0);
  await expect(page.getByLabel('长:', { exact: true })).toHaveCount(0);

  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('on a touch screen a toolbar button can be tapped just outside its drawn edge', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ ...testInfo.project.use, hasTouch: true });
  const page = await context.newPage();
  const evidence = await openProject(page, [box('桌子 A')]);
  expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);

  for (const name of ['保存项目', '撤销']) {
    const button = page.getByRole('button', { name, exact: true });
    const rect = await button.boundingBox();
    expect(rect.height, 'the drawn size stays small').toBeLessThan(44);
    const reach = (44 - rect.height) / 2 - 1;
    for (const y of [rect.y - reach, rect.y + rect.height + reach]) {
      const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('button')?.textContent, [rect.x + rect.width / 2, y]);
      expect(hit, `${name} at y=${y}`).toBe(name);
    }
  }

  expect(evidence).toEqual({ errors: [], writes: [] });
  await context.close();
});
