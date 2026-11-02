import { test, expect } from '@playwright/test';
import { openProject } from './project-fixture.mjs';
import { DEVICE_CATALOG } from '../src/domain/catalog.js';
import { placeCatalogObject } from '../src/domain/placement.js';

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

// A desk turned 90° against the side wall: its back is toward -x and the
// seat is on the +x side. The library places by the desk's own directions.
test('on a turned desk, devices from the library go to its back and its seat half', async ({ page }) => {
  const room = { length: 4, width: 3.5, height: 2.7 };
  const deskModel = DEVICE_CATALOG.flatMap(category => category.models).find(model => model.modelId === 'office-desk');
  const placed = placeCatalogObject({ modelTemplate: deskModel, categoryId: 'furniture', room, id: 'desk' }).object;
  const desk = { ...placed, rotation: { x: 0, y: 0, z: 90 } };
  const evidence = await openProject(page, [desk], [], { room });
  const library = page.getByPlaceholder('搜索设备名称、类型、型号...');
  for (const name of ['27 英寸显示器', '15 英寸笔记本', '台式主机']) {
    const openLibrary = page.getByRole('button', { name: '展开资产库', exact: true });
    if (await openLibrary.isVisible()) await openLibrary.click();
    await library.fill(name);
    await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
  }
  const closeLibrary = page.getByRole('button', { name: '收起资产库', exact: true });
  if (page.viewportSize().width < 900 && await closeLibrary.isVisible()) await closeLibrary.click();

  const openPanel = page.getByRole('button', { name: '展开属性面板', exact: true });
  const positionOf = async name => {
    if (await openPanel.isVisible()) await openPanel.click();
    await page.getByLabel('设备', { exact: true }).selectOption({ label: name });
    const value = async label => Number(await page.getByLabel(label, { exact: true }).inputValue());
    return { x: await value('左右 X'), y: await value('前后 Y') };
  };
  const screen = await positionOf('27 英寸显示器');
  expect(screen.x).toBeLessThan(-0.2); // at the back
  expect(screen.y).toBeCloseTo(0, 2); // centred along the desk
  expect((await positionOf('15 英寸笔记本')).x).toBeGreaterThan(0); // on the seat half
  expect((await positionOf('台式主机')).x).toBeLessThan(-desk.scale.y / 2); // behind the desk
  await expect(page.getByRole('button', { name: /^布局检查/ })).toHaveAccessibleName('布局检查');
  expect(evidence).toEqual({ errors: [], writes: [] });
});
