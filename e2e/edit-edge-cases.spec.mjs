import { test, expect } from '@playwright/test';
import { openProject, waitForSceneDownloads } from './project-fixture.mjs';
import { DEVICE_CATALOG } from '../src/domain/catalog.js';
import { placeCatalogObject } from '../src/domain/placement.js';

const ROOM = { length: 4, width: 3.5, height: 2.7 };

// Every test here loads the gaming desk and drags in the 3D view, which
// takes 12-17 s locally with software rendering and about twice that on CI
// since the SimReady models (E58); the default 30 s is too tight.
test.describe.configure({ timeout: 60_000 });

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

  // Far enough to clear the tower beside the desk. A shorter slide can stop
  // on that tower, and the monitor then sits on it (0.695 m) instead of the floor.
  await drag(page, await grabPoint(page), testIsPhone(page) ? -150 : -320, 40);
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

  // Off the desk, then up onto the toolbar before letting go. Keep the
  // sideways offset: a taller monitor's tag sits higher, and sliding straight
  // up from the start would raycast back onto the desktop.
  const from = await grabPoint(page);
  const dx = testIsPhone(page) ? -220 : -280;
  await drag(page, from, dx, 40, { releaseAt: { x: from.x + dx, y: 8 } });
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

  // One undo for the turn, then the moves; the screen comes back with the
  // desk. Arrow presses less than half a second apart are one undo step
  // (unit-tested with a fake clock in project-history.test.js); on the CI
  // runner a press can wait longer than that for a frame, so undo until the
  // desk is back, at most once per press.
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  expect((await posesOf('带鱼屏显示器'))[0].turn).toBeCloseTo(screen.turn, 1);
  for (let step = 0; step < 3; step += 1) {
    await page.getByRole('button', { name: '撤销', exact: true }).click();
    if ((await posesOf('书桌'))[0].y === desk.y) break;
  }
  expect(await posesOf('带鱼屏显示器', '书桌')).toEqual([screen, desk]);
  expect(evidence).toEqual({ errors: [], writes: [] });
});

// A screen pushed mostly past the desk edge would tip over in real life:
// the layout check says so and pushes it back for free.
test('a screen pushed mostly off the desk edge is reported and can be pushed back', async ({ page }) => {
  test.setTimeout(60_000);
  const evidence = await startWithDesk(page);
  const openPanel = page.getByRole('button', { name: '展开属性面板', exact: true });
  if (await openPanel.isVisible()) await openPanel.click();
  await page.getByLabel('设备', { exact: true }).selectOption({ label: '带鱼屏显示器' });
  const closePanel = page.getByRole('button', { name: '收起属性面板', exact: true });
  if (testIsPhone(page) && await closePanel.isVisible()) await closePanel.click();
  await page.locator('.selection-hint').click();
  // Eight steps still leave its middle over the 1.6 m desk; the ninth does not.
  for (let step = 0; step < 8; step += 1) await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('button', { name: /^布局检查/ })).toHaveAccessibleName('布局检查');
  await page.keyboard.press('ArrowLeft');
  expect((await readPosition(page)).x).toBeCloseTo(0.9, 3);
  await expect(page.getByRole('button', { name: /^布局检查/ })).not.toHaveAccessibleName('布局检查');

  await page.getByRole('button', { name: /^布局检查/ }).click();
  const report = page.getByRole('dialog', { name: '布局检查', exact: true });
  await expect(report).toContainText('带鱼屏显示器 大半悬在书桌外面，会掉下去');
  await report.getByRole('button', { name: /^推回去/ }).click();
  await expect(page.getByText('已推回去，放稳了', { exact: true })).toBeVisible();
  await expect(report).toContainText('当前未发现可识别的布局问题');
  await page.keyboard.press('Escape');
  expect((await readPosition(page)).x).toBeCloseTo(0.39, 3); // its edge on the desk edge

  await page.getByRole('button', { name: '撤销', exact: true }).click();
  expect((await readPosition(page)).x).toBeCloseTo(0.9, 3);
  expect(evidence).toEqual({ errors: [], writes: [] });
});

// A monitor added before the desk stands on the floor. Dragged onto the
// desk, it is let go standing on the desktop instead of inside the desk.
test('a monitor dragged from the floor onto the desk stands on the desktop, and one undo puts it back', async ({ page }) => {
  const models = DEVICE_CATALOG.flatMap(category => category.models.map(model => ({ model, categoryId: category.category })));
  const make = (modelId, objects) => {
    const { model, categoryId } = models.find(entry => entry.model.modelId === modelId);
    return placeCatalogObject({ modelTemplate: model, categoryId, room: ROOM, id: modelId, objects }).object;
  };
  const desk = make('office-desk', []);
  const placed = make('monitor-24', [desk]);
  const onFloor = { ...placed, position: { x: 1.25, y: 0, z: placed.scale.z / 2 } };
  // Framed like a generated desk, so the monitor is big enough to grab.
  const camera = { position: { x: 0, y: 2.15, z: -2.8 }, target: { x: 0, y: 0.75, z: 0 } };
  const evidence = await openProject(page, [desk, onFloor], [], { room: ROOM, camera });
  const openPanel = page.getByRole('button', { name: '展开属性面板', exact: true });
  if (await openPanel.isVisible()) await openPanel.click();
  await page.getByLabel('设备', { exact: true }).selectOption({ label: '24 英寸显示器' });
  const closePanel = page.getByRole('button', { name: '收起属性面板', exact: true });
  if (testIsPhone(page) && await closePanel.isVisible()) await closePanel.click();
  const before = await readPosition(page);

  // Sideways onto the desk, letting go with its middle over the desktop.
  await drag(page, await grabPoint(page), testIsPhone(page) ? 120 : 150, 0);
  const after = await readPosition(page);
  expect(Math.abs(after.x), 'over the 1.4 m desk').toBeLessThan(0.7);
  expect(after.z).toBeCloseTo(desk.scale.z + onFloor.scale.z / 2, 3);
  await expect(page.getByRole('button', { name: /^布局检查/ }), 'standing on the desk, not inside it').toHaveAccessibleName('布局检查');

  await page.getByRole('button', { name: '撤销', exact: true }).click();
  expect(await readPosition(page)).toEqual(before);
  expect(evidence).toEqual({ errors: [], writes: [] });
});

// Someone using only the keyboard cannot drag; the arrows land the monitor
// the same way: onto the desk from the floor, and down again past its end.
test('arrow keys move a monitor onto the desk and off its far end like a drag would', async ({ page }) => {
  test.setTimeout(60_000);
  const models = DEVICE_CATALOG.flatMap(category => category.models.map(model => ({ model, categoryId: category.category })));
  const make = (modelId, objects) => {
    const { model, categoryId } = models.find(entry => entry.model.modelId === modelId);
    return placeCatalogObject({ modelTemplate: model, categoryId, room: ROOM, id: modelId, objects }).object;
  };
  const desk = make('office-desk', []);
  const placed = make('monitor-24', [desk]);
  const onFloor = { ...placed, position: { x: 1.25, y: 0, z: placed.scale.z / 2 } };
  const evidence = await openProject(page, [desk, onFloor], [], { room: ROOM });
  const openPanel = page.getByRole('button', { name: '展开属性面板', exact: true });
  if (await openPanel.isVisible()) await openPanel.click();
  await page.getByLabel('设备', { exact: true }).selectOption({ label: '24 英寸显示器' });
  const closePanel = page.getByRole('button', { name: '收起属性面板', exact: true });
  if (testIsPhone(page) && await closePanel.isVisible()) await closePanel.click();
  const press = async (key, times) => {
    await page.locator('.selection-hint').click();
    for (let step = 0; step < times; step += 1) await page.keyboard.press(key);
  };
  const deskTopZ = desk.scale.z + onFloor.scale.z / 2;

  // Five steps: its middle is still past the desk's end, so it stays down.
  await press('ArrowRight', 5);
  expect(await readPosition(page)).toEqual({ x: 0.75, y: 0, z: onFloor.position.z });
  // The sixth puts its middle over the desk: it stands on top.
  await press('ArrowRight', 1);
  const stood = await readPosition(page);
  expect(stood.x).toBeCloseTo(0.65, 3);
  expect(stood.y).toBeCloseTo(0, 3);
  // The height field shows three decimals, so 0.75 + 0.195 is 0.945.
  expect(stood.z).toBeCloseTo(deskTopZ, 3);
  await expect(page.getByRole('button', { name: /^布局检查/ })).toHaveAccessibleName('布局检查');

  // Across the desk and off the other end: it drops to the floor.
  await press('ArrowRight', 17);
  const past = await readPosition(page);
  expect(past.x).toBeCloseTo(-1.05, 3);
  expect(past.z).toBeCloseTo(onFloor.position.z, 3);
  await expect(page.getByRole('button', { name: /^布局检查/ })).toHaveAccessibleName('布局检查');
  expect(evidence).toEqual({ errors: [], writes: [] });
});

// Taking away the desk drops what stood on it, says so first, and one undo
// puts the desk and everything on it back.
test('deleting the desk drops what stood on it instead of leaving it in the air', async ({ page }) => {
  const prompts = [];
  page.on('dialog', dialog => { prompts.push(dialog.message()); dialog.accept(); });
  const evidence = await startWithDesk(page);
  const openPanel = page.getByRole('button', { name: '展开属性面板', exact: true });
  if (await openPanel.isVisible()) await openPanel.click();
  const picker = page.getByLabel('设备', { exact: true });
  await picker.selectOption({ label: '15 英寸笔记本' });
  const laptopZ = Number(await page.getByLabel('上下 Z', { exact: true }).inputValue());
  await picker.selectOption({ label: '书桌' });
  await page.getByRole('button', { name: '删除设备', exact: true }).click();
  await expect(page.getByText('删除成功', { exact: true })).toBeVisible();
  expect(prompts).toEqual(['确定要删除设备“书桌”吗？\n上面放着的 2 件设备会落到下面。']);

  await expect(page.getByRole('button', { name: /^布局检查/ }), 'nothing left in the air').toHaveAccessibleName('布局检查');
  if (await openPanel.isVisible()) await openPanel.click();
  await picker.selectOption({ label: '15 英寸笔记本' });
  expect(Number(await page.getByLabel('上下 Z', { exact: true }).inputValue())).toBeLessThan(0.2);

  await page.getByRole('button', { name: '撤销', exact: true }).click();
  if (await openPanel.isVisible()) await openPanel.click();
  await expect(picker.locator('option', { hasText: '书桌' })).toHaveCount(1);
  await picker.selectOption({ label: '15 英寸笔记本' });
  expect(Number(await page.getByLabel('上下 Z', { exact: true }).inputValue())).toBeCloseTo(laptopZ, 3);
  expect(evidence).toEqual({ errors: [], writes: [] });
});

// With the desk turned round, "重置视角" looks from behind its seat, so the
// screens face the viewer, and from close enough to see the desk the way a
// template opens (E63); the view is what gets saved with the project.
test('reset view looks from the seat side of a turned desk', async ({ page }) => {
  const { PROJECT_STORAGE_KEY } = await import('../src/domain/local-project-store.js');
  const { deskCameraPose } = await import('../src/domain/camera-snapshot.js');
  const models = DEVICE_CATALOG.flatMap(category => category.models.map(model => ({ model, categoryId: category.category })));
  const make = (modelId, objects) => {
    const { model, categoryId } = models.find(entry => entry.model.modelId === modelId);
    return placeCatalogObject({ modelTemplate: model, categoryId, room: ROOM, id: modelId, objects }).object;
  };
  const placedDesk = make('office-desk', []);
  const desk = { ...placedDesk, rotation: { x: 0, y: 0, z: 180 } };
  const screen = make('monitor-27', [desk]);
  const evidence = await openProject(page, [desk, screen], [], { room: ROOM });
  // The view has to be up before it can be turned or reset.
  await waitForSceneDownloads(page);
  const canvas = await page.locator('canvas').first().boundingBox();
  // Turn the view away first, so the reset has something to undo.
  await page.mouse.move(canvas.x + canvas.width * 0.5, canvas.y + canvas.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(canvas.x + canvas.width * 0.8, canvas.y + canvas.height * 0.2, { steps: 10 });
  await page.mouse.up();
  // Reset while the spin is still easing out, then give any leftover a
  // second to show: the view used to drift off the reset pose (E62 CI).
  await page.getByRole('button', { name: '重置视角', exact: true }).click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: '保存项目', exact: true }).click();
  const savedCamera = () => page.evaluate(key => JSON.parse(localStorage.getItem(key))?.camera ?? null, PROJECT_STORAGE_KEY);
  await expect.poll(savedCamera, { message: 'the view is saved with the project' }).not.toBeNull();
  const camera = await savedCamera();
  // The seat of a desk turned 180° is on the room's +y side; three.js z is
  // the room's y. Without the turn the view would come from -y.
  const expected = deskCameraPose(desk);
  expect(camera.position.z, 'from the seat side').toBeGreaterThan(desk.position.y);
  for (const axis of ['x', 'y', 'z']) {
    expect(camera.position[axis], `position ${axis}`).toBeCloseTo(expected.position[axis], 2);
    expect(camera.target[axis], `target ${axis}`).toBeCloseTo(expected.target[axis], 2);
  }
  expect(evidence.errors).toEqual([]);
});
