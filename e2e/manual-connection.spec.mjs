import { test, expect } from '@playwright/test';
import { openProject } from './project-fixture.mjs';

const ROOM = { length: 4, width: 3.5, height: 2.7 };
const isPhone = page => page.viewportSize().width < 900;

async function addMonitorToGamingDesk(page) {
  await page.getByRole('button', { name: '桌面模板', exact: true }).click();
  await page.getByRole('dialog', { name: '桌面模板', exact: true })
    .getByRole('button', { name: '使用模板：电竞桌', exact: true }).click();
  const openLibrary = page.getByRole('button', { name: '展开资产库', exact: true });
  if (await openLibrary.isVisible()) await openLibrary.click();
  await page.getByRole('button', { name: '显示器', exact: true }).click();
  await page.getByRole('button', { name: /^27 英寸显示器/ }).click();
  const closeLibrary = page.getByRole('button', { name: '收起资产库', exact: true });
  if (isPhone(page) && await closeLibrary.isVisible()) await closeLibrary.click();
  const openPanel = page.getByRole('button', { name: '展开属性面板', exact: true });
  if (await openPanel.isVisible()) await openPanel.click();
  await page.getByRole('tab', { name: '连接', exact: true }).click();
}

test('a screen can be wired by hand from the screen end, with a cable long enough for the route', async ({ page }) => {
  const prompts = [];
  page.on('dialog', dialog => { prompts.push(dialog.message()); dialog.dismiss(); });
  const evidence = await openProject(page, [], [], { room: ROOM });
  await addMonitorToGamingDesk(page);

  // Auto-wiring plugged the new screen into the computer; unplug it.
  const list = page.locator('.connection-list');
  const video = list.locator('.connection-list-item').filter({ hasText: '接收自 台式主机' });
  await video.getByRole('button', { name: '删除', exact: true }).click();
  await expect(list).not.toContainText('接收自 台式主机');

  // Start from the screen, which only has inputs.
  await page.getByRole('button', { name: '新建连接', exact: true }).click();
  const draft = page.locator('.connection-draft');
  await expect(draft).toContainText('1. 当前设备的接口');
  const [ownPort, target] = [draft.locator('select').nth(0), draft.locator('select').nth(1)];
  await expect(ownPort.locator('option')).toContainText(['HDMI 输入']);
  await ownPort.selectOption({ label: 'HDMI 输入' });
  await target.selectOption({ label: '台式主机' });

  // The computer's only free HDMI port is chosen, and the length covers the route.
  await expect(draft).toContainText('HDMI 输出');
  const length = Number(await draft.getByRole('spinbutton').inputValue());
  expect([1, 1.5, 1.8, 2, 3]).toContain(length);
  await expect(draft.locator('.cable-distance')).toHaveClass(/cable-distance-ok/);
  await draft.getByRole('button', { name: '确认连接', exact: true }).click();

  // Saved like auto-wiring would: from the computer to the screen.
  await expect(draft).toHaveCount(0);
  await expect(list).toContainText('接收自 台式主机');
  await expect(list).toContainText(`(${length}m)`);
  expect(prompts).toEqual([]);
  await expect(page.getByRole('button', { name: /^布线检查/ })).toHaveAccessibleName('布线检查');
  expect(evidence).toEqual({ errors: [], writes: [] });
});
