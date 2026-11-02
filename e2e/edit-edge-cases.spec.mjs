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
  // The move handles' vertical arrow runs down the center line under the tag,
  // so the grab steps sideways onto the screen. On a phone the screen is
  // smaller and the red arrow points left, so a shorter step to the right.
  return phone
    ? { x: box.x + box.width / 2 + 18, y: box.y + box.height + 24 }
    : { x: box.x + box.width / 2 + 36, y: box.y + box.height + 22 };
}

// Off the desk, a dropped monitor rests on the floor or on whatever low
// thing is under it there (the strip and adapters by the wall), never in the
// air: well below the desktop, and the layout check finds nothing floating
// or overlapping.
async function expectDropped(page, position) {
  expect(position.z, 'well below the desktop').toBeLessThan(0.4);
  await expect(page.getByRole('button', { name: /^布局检查/ }), 'nothing floating or overlapping').toHaveAccessibleName('布局检查');
}

// Drags with a pause halfway, like a user who stops to look before letting
// go (and like a slow CI machine): the drag must still be one undo step.
// `releaseAt` lets go somewhere else, e.g. after sliding off the 3D view.
async function drag(page, from, dx, dy, { releaseAt = null } = {}) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx / 2, from.y + dy / 2, { steps: 8 });
  await page.waitForTimeout(700);
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 8 });
  if (releaseAt) await page.mouse.move(releaseAt.x, releaseAt.y, { steps: 4 });
  await page.mouse.up();
}

test('a monitor dragged off the desk drops down instead of hanging in the air, and one undo puts it back', async ({ page }) => {
  const evidence = await startWithDesk(page);
  await addDevice(page, '显示器', '24 英寸显示器');
  const before = await readPosition(page);
  expect(before.z).toBeGreaterThan(0.7); // stands on the desk

  await drag(page, await grabPoint(page), testIsPhone(page) ? -150 : -250, 40);
  const after = await readPosition(page);
  expect(after.x).not.toBeCloseTo(before.x, 2);
  await expectDropped(page, after);

  await page.getByRole('button', { name: '撤销', exact: true }).click();
  expect(await readPosition(page)).toEqual(before);
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('a monitor let go outside the 3D view still drops, and one undo puts it back', async ({ page }) => {
  const evidence = await startWithDesk(page);
  await addDevice(page, '显示器', '24 英寸显示器');
  const before = await readPosition(page);

  // Off the desk, then up onto the toolbar before letting go.
  const from = await grabPoint(page);
  await drag(page, from, testIsPhone(page) ? -150 : -250, 40, { releaseAt: { x: from.x, y: 20 } });
  const after = await readPosition(page);
  expect(after.x).not.toBeCloseTo(before.x, 2);
  await expectDropped(page, after);

  await page.getByRole('button', { name: '撤销', exact: true }).click();
  expect(await readPosition(page)).toEqual(before);
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('a monitor dragged a little along the desk stays on the desk', async ({ page }) => {
  const evidence = await startWithDesk(page);
  await addDevice(page, '显示器', '24 英寸显示器');
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

// What stands on a desk goes along when the desk is moved or turned: the
// screen keeps its spot on the desktop and turns with it, the floor stays.
test('a desk moved and turned takes what stands on it along, and undo puts it all back', async ({ page }) => {
  // Many steps, and a phone opens the panel for each reading: on the CI
  // runner this takes about twice as long as the default budget allows.
  test.setTimeout(60_000);
  const evidence = await startWithDesk(page);
  // Reads several devices with one opening of the panel; the last one named
  // stays selected.
  const posesOf = async (...names) => {
    const openPanel = page.getByRole('button', { name: '展开属性面板', exact: true });
    if (await openPanel.isVisible()) await openPanel.click();
    const poses = [];
    for (const name of names) {
      await page.getByLabel('设备', { exact: true }).selectOption({ label: name });
      const value = async label => Number(await page.getByLabel(label, { exact: true }).inputValue());
      poses.push({ x: await value('左右 X'), y: await value('前后 Y'), z: await value('上下 Z'), turn: await value('旋转 (°)') });
    }
    const closePanel = page.getByRole('button', { name: '收起属性面板', exact: true });
    if (testIsPhone(page) && await closePanel.isVisible()) await closePanel.click();
    return poses;
  };
  const [screen, tower, desk] = await posesOf('带鱼屏显示器', '台式主机', '书桌');

  await page.locator('.selection-hint').click();
  for (let step = 0; step < 3; step += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('q');

  const [movedScreen, movedTower, movedDesk] = await posesOf('带鱼屏显示器', '台式主机', '书桌');
  expect(movedDesk.y).toBeCloseTo(desk.y - 0.3, 3);
  expect(movedDesk.turn).toBeCloseTo(15, 1);
  const radians = (15 * Math.PI) / 180;
  const dx = screen.x - desk.x;
  const dy = screen.y - desk.y;
  expect(movedScreen.x).toBeCloseTo(movedDesk.x + dx * Math.cos(radians) - dy * Math.sin(radians), 2);
  expect(movedScreen.y).toBeCloseTo(movedDesk.y + dx * Math.sin(radians) + dy * Math.cos(radians), 2);
  expect(movedScreen.z).toBeCloseTo(screen.z, 3);
  expect(movedScreen.turn).toBeCloseTo(screen.turn + 15, 1);
  expect(movedTower).toEqual(tower);
  await expect(page.getByRole('button', { name: /^布局检查/ }), 'nothing left floating or overlapping').toHaveAccessibleName('布局检查');

  // One undo for the turn, one for the moves; the screen comes back with the desk.
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  expect((await posesOf('带鱼屏显示器'))[0].turn).toBeCloseTo(screen.turn, 1);
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  expect(await posesOf('带鱼屏显示器', '书桌')).toEqual([screen, desk]);
  expect(evidence).toEqual({ errors: [], writes: [] });
});
