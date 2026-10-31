import { test, expect } from '@playwright/test';
import { openProject } from './project-fixture.mjs';

const ROOM = { length: 4, width: 3.5, height: 2.7 };

async function startWithDesk(page) {
  const evidence = await openProject(page, [], [], { room: ROOM });
  await page.getByRole('button', { name: '桌面模板', exact: true }).click();
  await page.getByRole('dialog', { name: '桌面模板', exact: true }).getByRole('button', { name: '使用模板：电竞桌', exact: true }).click();
  return evidence;
}

async function addDevice(page, category, name) {
  const openLibrary = page.getByRole('button', { name: '展开资产库', exact: true });
  if (await openLibrary.isVisible()) await openLibrary.click();
  await page.getByRole('button', { name: category, exact: true }).click();
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
  const closeLibrary = page.getByRole('button', { name: '收起资产库', exact: true });
  if (await closeLibrary.isVisible() && testIsPhone(page)) await closeLibrary.click();
}

const testIsPhone = page => page.viewportSize().width < 900;

async function readPosition(page) {
  const openPanel = page.getByRole('button', { name: '展开属性面板', exact: true });
  if (await openPanel.isVisible()) await openPanel.click();
  const value = async label => Number(await page.getByLabel(label, { exact: true }).inputValue());
  const position = { x: await value('左右 X'), y: await value('前后 Y'), z: await value('上下 Z') };
  const closePanel = page.getByRole('button', { name: '收起属性面板', exact: true });
  if (testIsPhone(page) && await closePanel.isVisible()) await closePanel.click();
  return position;
}

// The selected device's tag sits just above its top. The point is on the
// body, off the center, so it misses the move handles that leave the middle.
async function grabPoint(page) {
  const tag = page.locator('.scene-tag');
  await expect(tag).toBeVisible();
  await page.waitForTimeout(500); // let the tag's entrance settle
  const box = await tag.boundingBox();
  const phone = page.viewportSize().width < 900;
  // Desktop handles sit on the center line under the tag, so the grab steps
  // sideways onto the screen. On a phone the same sideways step clips a handle.
  return phone
    ? { x: box.x + box.width / 2, y: box.y + box.height + 24 }
    : { x: box.x + box.width / 2 + 36, y: box.y + box.height + 22 };
}

// Drags with a pause halfway, like a user who stops to look before letting
// go (and like a slow CI machine): the drag must still be one undo step.
async function drag(page, from, dx, dy) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx / 2, from.y + dy / 2, { steps: 8 });
  await page.waitForTimeout(700);
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 8 });
  await page.mouse.up();
}

test('a monitor dragged off the desk drops to the floor, and one undo puts it back', async ({ page }) => {
  const evidence = await startWithDesk(page);
  await addDevice(page, '显示设备', '24 英寸显示器');
  const before = await readPosition(page);
  expect(before.z).toBeGreaterThan(0.7); // stands on the desk

  await drag(page, await grabPoint(page), testIsPhone(page) ? -150 : -250, 40);
  const after = await readPosition(page);
  expect(after.x).not.toBeCloseTo(before.x, 2);
  expect(after.z, 'it rests on the floor instead of hanging in the air').toBeCloseTo(0.16, 2);
  await expect(page.getByRole('button', { name: /^布局检查/ })).toHaveAccessibleName('布局检查');

  await page.getByRole('button', { name: '撤销', exact: true }).click();
  expect(await readPosition(page)).toEqual(before);
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('a monitor dragged a little along the desk stays on the desk', async ({ page }) => {
  const evidence = await startWithDesk(page);
  await addDevice(page, '显示设备', '24 英寸显示器');
  const before = await readPosition(page);
  await drag(page, await grabPoint(page), 30, 0);
  const after = await readPosition(page);
  expect(after.x).not.toBeCloseTo(before.x, 2);
  expect(after.z).toBeCloseTo(before.z, 3);
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('device shortcuts leave buttons and open dialogs alone', async ({ page }) => {
  const prompts = [];
  page.on('dialog', dialog => { prompts.push(dialog.message()); dialog.dismiss(); });
  const evidence = await startWithDesk(page);
  await addDevice(page, '网络', '路由器');
  const before = await readPosition(page);

  // Space presses a focused button instead of lifting the device.
  const connectionsButton = page.getByRole('button', { name: '所有连接', exact: true });
  await connectionsButton.focus();
  await page.keyboard.press('Space');
  const list = page.getByRole('dialog', { name: '全部连接清单', exact: true });
  await expect(list).toBeVisible();

  // With a dialog open, arrows and Delete do not touch the device behind it.
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Delete');
  await list.getByRole('button', { name: /关闭/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await readPosition(page)).toEqual(before);
  expect(prompts).toEqual([]);

  // Outside dialogs the shortcuts still move the selected device.
  await page.locator('.selection-hint').click();
  await page.keyboard.press('ArrowRight');
  expect((await readPosition(page)).x).toBeCloseTo(before.x - 0.1, 3);
  expect(evidence).toEqual({ errors: [], writes: [] });
});
