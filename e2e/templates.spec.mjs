import { test, expect } from '@playwright/test';
import { box, openProject } from './project-fixture.mjs';

test('a new user can start from a desk template that is ready to use, and undo it', async ({ page }) => {
  const evidence = await openProject(page, []);

  await page.getByRole('button', { name: '改进建议', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '使用桌面模板', exact: true }).click();

  const picker = page.getByRole('dialog', { name: '桌面模板', exact: true });
  await expect(picker).toBeVisible();
  await expect(picker).not.toContainText('替换当前场景');
  await expect(picker).toContainText('家庭办公');
  await expect(picker).toContainText('台式机双屏');
  await picker.getByRole('button', { name: '使用模板：电竞桌', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // A template is placed and wired so that every check comes back clean.
  await expect(page.getByRole('button', { name: '布局检查', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '布线检查', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '改进建议', exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: '未保存' })).toBeVisible();

  await page.getByRole('button', { name: '所有连接', exact: true }).click();
  const connections = page.getByRole('dialog', { name: '全部连接清单', exact: true });
  await expect(connections).toContainText('台式主机到带鱼屏显示器的DP线');
  await expect(connections).toContainText('台式主机网线');
  await connections.getByRole('button', { name: /关闭/ }).click();

  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await page.getByRole('button', { name: '改进建议', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('先添加设备，建立你的桌面方案。');

  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('a user can generate a desk from their own device list', async ({ page }) => {
  const evidence = await openProject(page, []);
  await page.getByRole('button', { name: '桌面模板', exact: true }).click();
  const picker = page.getByRole('dialog', { name: '桌面模板', exact: true });

  await picker.getByRole('button', { name: '减少15 英寸笔记本', exact: true }).click();
  await picker.getByRole('button', { name: '增加台式主机', exact: true }).click();
  await expect(picker.getByRole('button', { name: '增加台式主机', exact: true }), 'one desktop per desk').toBeDisabled();
  await picker.getByRole('button', { name: '增加27 英寸显示器', exact: true }).click();
  await picker.getByRole('button', { name: '增加27 英寸显示器', exact: true }).click();
  await expect(picker.getByRole('group', { name: '27 英寸显示器' }).getByLabel('27 英寸显示器数量')).toHaveText('3');

  const notes = picker.getByRole('list', { name: '生成提示' });
  await expect(notes).toContainText('桌面宽度 1.4m 放不下 3 台显示器');
  const deskLength = picker.getByLabel('书桌长度 (m)');
  await deskLength.fill('2.4');
  await expect(deskLength).toHaveValue('2.4');
  await expect(notes).not.toContainText('放不下');
  await expect(notes).toContainText('“27 英寸显示器 3”暂时没有可用的视频输出');

  await picker.getByRole('button', { name: '减少27 英寸显示器', exact: true }).click();
  await expect(notes).toHaveCount(0);
  await picker.getByRole('button', { name: '生成桌面', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await expect(page.getByRole('button', { name: '布局检查', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '布线检查', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '改进建议', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '所有连接', exact: true }).click();
  const connections = page.getByRole('dialog', { name: '全部连接清单', exact: true });
  await expect(connections).toContainText('台式主机到27 英寸显示器 1');
  await expect(connections).toContainText('台式主机到27 英寸显示器 2');
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('the template picker warns before replacing an existing scene', async ({ page }) => {
  const evidence = await openProject(page, [box('桌子 A')]);
  await page.getByRole('button', { name: '桌面模板', exact: true }).click();
  const picker = page.getByRole('dialog', { name: '桌面模板', exact: true });
  await expect(picker).toContainText('套用后会替换当前场景，可以用“撤销”恢复。');
  await picker.getByRole('button', { name: '关闭桌面模板', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('the connections list names cables in plain words', async ({ page }) => {
  const evidence = await openProject(page, []);
  await page.getByRole('button', { name: '桌面模板', exact: true }).click();
  await page.getByRole('button', { name: '使用模板：电竞桌', exact: true }).click();
  await page.getByRole('button', { name: '所有连接', exact: true }).click();
  const list = page.getByRole('dialog', { name: '全部连接清单', exact: true });
  await expect(list).toContainText('网线（');
  await expect(list).toContainText('电源线（');
  await expect(list).not.toContainText(/\b(ethernet|hdmi|usb_c|displayport|power)\b/);
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('the template picker closes with Escape like the other dialogs', async ({ page }) => {
  const evidence = await openProject(page, [box('桌子 A')]);
  await page.getByRole('button', { name: '桌面模板', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '桌面模板', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('a generated desk comes with a keyboard and mouse by default', async ({ page }) => {
  const evidence = await openProject(page, []);
  await page.getByRole('button', { name: '桌面模板', exact: true }).click();
  const picker = page.getByRole('dialog', { name: '桌面模板', exact: true });
  for (const name of ['键盘', '鼠标']) {
    await expect(picker.getByRole('group', { name }).getByLabel(`${name}数量`)).toHaveText('1');
  }
  await picker.getByRole('button', { name: '生成桌面', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  const openPanel = page.getByRole('button', { name: '展开属性面板', exact: true });
  if (await openPanel.isVisible()) await openPanel.click();
  const devices = page.getByLabel('设备', { exact: true });
  await expect(devices.locator('option', { hasText: '键盘' })).toHaveCount(1);
  await expect(devices.locator('option', { hasText: '鼠标' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: /^布局检查/ })).toHaveAccessibleName('布局检查');
  await expect(page.getByRole('button', { name: /^布线检查/ })).toHaveAccessibleName('布线检查');
  expect(evidence).toEqual({ errors: [], writes: [] });
});
