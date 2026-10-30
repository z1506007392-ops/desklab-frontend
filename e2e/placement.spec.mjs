import { test, expect } from '@playwright/test';
import { openProject } from './project-fixture.mjs';

test('devices added from the library land in free spots on and around the desk', async ({ page }) => {
  const evidence = await openProject(page, []);
  const library = page.getByPlaceholder('搜索设备名称、类型、型号...');
  const add = async name => {
    // On narrow screens the library starts collapsed and closes after adding.
    const openLibrary = page.getByRole('button', { name: '展开资产库', exact: true });
    if (await openLibrary.isVisible()) await openLibrary.click();
    await library.fill(name);
    await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
  };

  await add('书桌');
  await add('27 英寸显示器');
  await add('15 英寸笔记本');
  await add('台式主机');
  await add('插排');

  // Nothing overlaps or floats, so the layout check has nothing to report.
  await expect(page.getByRole('button', { name: '布局检查', exact: true })).toBeVisible();
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('a newly added device gets its power line drawn automatically', async ({ page }) => {
  const evidence = await openProject(page, []);
  const library = page.getByPlaceholder('搜索设备名称、类型、型号...');
  for (const name of ['书桌', '墙壁插座', '插排', '台式主机']) {
    const openLibrary = page.getByRole('button', { name: '展开资产库', exact: true });
    if (await openLibrary.isVisible()) await openLibrary.click();
    await library.fill(name);
    await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
  }

  await page.getByRole('button', { name: '所有连接', exact: true }).click();
  const list = page.getByRole('dialog', { name: '全部连接清单', exact: true });
  await expect(list).toContainText('插排电源线');
  await expect(list).toContainText('台式主机电源线');
  await list.getByRole('button', { name: /关闭/ }).click();

  // Nothing about power is reported as a problem or a purchase.
  await expect(page.getByRole('button', { name: '布线检查', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '改进建议', exact: true })).toBeVisible();
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('a newly added computer is cabled to the monitor and router already on the desk', async ({ page }) => {
  const evidence = await openProject(page, []);
  const library = page.getByPlaceholder('搜索设备名称、类型、型号...');
  for (const name of ['书桌', '路由器', '27 英寸显示器', '台式主机']) {
    const openLibrary = page.getByRole('button', { name: '展开资产库', exact: true });
    if (await openLibrary.isVisible()) await openLibrary.click();
    await library.fill(name);
    await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
  }

  await page.getByRole('button', { name: '所有连接', exact: true }).click();
  const list = page.getByRole('dialog', { name: '全部连接清单', exact: true });
  await expect(list).toContainText(/台式主机(HDMI|DP)线/);
  await expect(list).toContainText('台式主机网线');
  await list.getByRole('button', { name: /关闭/ }).click();

  // Nobody is told to plug in their own monitor or network cable.
  await expect(page.getByRole('button', { name: '改进建议', exact: true })).toBeVisible();
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('adding a second power strip to a template creates no wiring problem', async ({ page }) => {
  const evidence = await openProject(page, []);
  await page.getByRole('button', { name: '桌面模板', exact: true }).click();
  await page.getByRole('button', { name: '使用模板：电竞桌', exact: true }).click();
  const openLibrary = page.getByRole('button', { name: '展开资产库', exact: true });
  if (await openLibrary.isVisible()) await openLibrary.click();
  await page.getByPlaceholder('搜索设备名称、类型、型号...').fill('插排');
  await page.getByRole('button', { name: /^插排/ }).click();
  await expect(page.getByRole('button', { name: '布线检查', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '改进建议', exact: true })).toBeVisible();
  expect(evidence).toEqual({ errors: [], writes: [] });
});
