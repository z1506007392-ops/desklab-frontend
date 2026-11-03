import { test, expect } from '@playwright/test';
import { box, openProject } from './project-fixture.mjs';

const ROOM = { length: 4, width: 3.5, height: 2.7 };
const isPhone = page => page.viewportSize().width < 900;

// Reads several devices' y with one opening of the panel.
async function ysOf(page, names) {
  const openPanel = page.getByRole('button', { name: '展开属性面板', exact: true });
  if (await openPanel.isVisible()) await openPanel.click();
  const ys = {};
  for (const name of names) {
    await page.getByLabel('设备', { exact: true }).selectOption({ label: name });
    ys[name] = Number(await page.getByLabel('前后 Y', { exact: true }).inputValue());
  }
  const closePanel = page.getByRole('button', { name: '收起属性面板', exact: true });
  if (isPhone(page) && await closePanel.isVisible()) await closePanel.click();
  return ys;
}

async function openSettings(page) {
  await page.getByRole('button', { name: '更多', exact: true }).click();
  await page.getByRole('menu', { name: '更多', exact: true }).getByRole('menuitem', { name: '设置', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '设置', exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function setRoomWidth(page, width) {
  const dialog = await openSettings(page);
  await dialog.getByLabel('宽:', { exact: true }).fill(String(width));
  await dialog.getByRole('button', { name: '更新房间', exact: true }).click();
  await expect(page.getByText('房间尺寸已更新', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '关闭设置', exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

// People pick a template first and then type in their own room. The layout
// moves with the back wall it stands against, as one piece.
test('after a template, a narrower or wider room keeps the desk against its wall and nothing in the way', async ({ page }) => {
  // Two resizes with readings in between: on the CI runner a phone takes
  // longer than the default budget.
  test.setTimeout(60_000);
  const evidence = await openProject(page, [], [], { room: ROOM });
  await page.getByRole('button', { name: '桌面模板', exact: true }).click();
  await page.getByRole('dialog', { name: '桌面模板', exact: true })
    .getByRole('button', { name: '使用模板：超宽', exact: true }).click();
  const names = ['书桌', '带鱼屏显示器', '插排', '墙壁插座'];
  const before = await ysOf(page, names);

  for (const width of [3.2, 4.5]) {
    await setRoomWidth(page, width);
    const shift = (width - ROOM.width) / 2;
    const after = await ysOf(page, names);
    for (const name of names) expect(after[name], `${name} at ${width} m`).toBeCloseTo(before[name] + shift, 3);
    await expect(page.getByRole('button', { name: /^布局检查/ }), `layout at ${width} m`).toHaveAccessibleName('布局检查');
    await expect(page.getByRole('button', { name: /^布线检查/ }), `wiring at ${width} m`).toHaveAccessibleName('布线检查');
  }

  // Undo puts the room and the layout back together.
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  expect((await ysOf(page, ['书桌']))['书桌']).toBeCloseTo(before['书桌'] + (3.2 - ROOM.width) / 2, 3);
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('the workbench has no room-size controls, and a later pick can be left', async ({ page }) => {
  const evidence = await openProject(page, [box('桌子 A')]);
  await expect(page.getByRole('button', { name: '房间尺寸', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('长:', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('宽:', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('高:', { exact: true })).toHaveCount(0);

  const settings = await openSettings(page);
  await expect(settings.getByLabel('长:', { exact: true })).toBeVisible();
  await settings.getByRole('button', { name: '重新选择房间', exact: true }).click();
  const room = page.getByRole('dialog', { name: '这间房有多大' });
  await expect(room).toBeVisible();
  await expect(room.getByRole('button', { name: '返回', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '保存项目', exact: true })).toBeHidden();
  await room.getByRole('button', { name: '返回', exact: true }).click();
  await expect(room).toHaveCount(0);
  await expect(page.getByRole('button', { name: '保存项目', exact: true })).toBeEnabled();

  await openSettings(page);
  await page.getByRole('dialog', { name: '设置', exact: true }).getByRole('button', { name: '重新选择房间', exact: true }).click();
  await expect(room).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(room).toHaveCount(0);
  await expect(page.getByRole('button', { name: '保存项目', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: '房间尺寸', exact: true })).toHaveCount(0);
  expect(evidence).toEqual({ errors: [], writes: [] });
});
