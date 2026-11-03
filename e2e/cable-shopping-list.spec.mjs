import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { box, openProject } from './project-fixture.mjs';

function device(id, x, y, port) {
  return {
    ...box(id, x),
    type: 'device',
    position: { x, y, z: 0.5 },
    ports: [port],
  };
}

const hdmiOut = { id: 'hdmi-out', name: 'HDMI 输出', type: 'hdmi', direction: 'output' };
const hdmiIn = { id: 'hdmi-in', name: 'HDMI 输入', type: 'hdmi', direction: 'input' };
const lan = { id: 'lan', name: '网口', type: 'ethernet', direction: 'bidirectional' };

// Two HDMI runs of 2 m, and one 0.4 m ethernet run. Shop sizes add slack and
// round up, then merge the matching HDMI lines.
const objects = [
  device('主机甲', -1, 0, hdmiOut),
  device('屏幕甲', 1, 0, hdmiIn),
  device('主机乙', -1, 2, hdmiOut),
  device('屏幕乙', 1, 2, hdmiIn),
  device('路由器', 0, 4, lan),
  device('笔记本', 0.4, 4, { ...lan, id: 'lan-2', name: '网口' }),
];
const connections = [
  { id: 'hdmi-1', name: '甲 HDMI', cableType: 'hdmi', length: 3, fromObjectId: '主机甲', fromPortId: 'hdmi-out', toObjectId: '屏幕甲', toPortId: 'hdmi-in' },
  { id: 'hdmi-2', name: '乙 HDMI', cableType: 'hdmi', length: 3, fromObjectId: '主机乙', fromPortId: 'hdmi-out', toObjectId: '屏幕乙', toPortId: 'hdmi-in' },
  { id: 'lan-1', name: '上网', cableType: 'ethernet', length: 1, fromObjectId: '路由器', fromPortId: 'lan', toObjectId: '笔记本', toPortId: 'lan-2' },
];

async function rememberClipboard(page, context, browserName) {
  await page.addInitScript(() => {
    const clipboard = navigator.clipboard;
    if (!clipboard?.writeText) return;
    const writeText = clipboard.writeText.bind(clipboard);
    clipboard.writeText = async (text) => {
      window.__deskLabCopied = text;
      return writeText(text);
    };
  });
  if (browserName === 'chromium') {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  }
}

test('the cable list merges matching lines and copies plain words', async ({ page, context, browserName }) => {
  await rememberClipboard(page, context, browserName);
  const evidence = await openProject(page, objects, connections);
  await page.getByRole('button', { name: '更多', exact: true }).click();
  await page.getByRole('menu', { name: '更多', exact: true }).getByRole('menuitem', { name: '购线清单', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: '购线清单', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('listitem')).toHaveText(['1 米 网线×1', '3 米 HDMI 线×2']);
  await expect(dialog).toContainText('不标价格');
  await expect(dialog).not.toContainText('hdmi-1');
  await expect(dialog).not.toContainText('主机甲');

  await dialog.getByRole('button', { name: '复制清单', exact: true }).click();
  await expect(page.getByText('购线清单已复制', { exact: true })).toBeVisible();
  const copied = await page.evaluate(async () => {
    try { return (await navigator.clipboard.readText()).replace(/\r\n/g, '\n'); }
    catch { return window.__deskLabCopied || ''; }
  });
  expect(copied).toBe('要买的线\n- 1 米 网线 ×1\n- 3 米 HDMI 线 ×2');

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('the cable list exports a markdown run sheet and a csv', async ({ page }) => {
  const evidence = await openProject(page, objects, connections);
  await page.getByRole('button', { name: '更多', exact: true }).click();
  await page.getByRole('menu', { name: '更多', exact: true }).getByRole('menuitem', { name: '购线清单', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '购线清单', exact: true });

  const markdownDownload = page.waitForEvent('download');
  await dialog.getByRole('button', { name: '导出 Markdown', exact: true }).click();
  const markdown = await markdownDownload;
  expect(markdown.suggestedFilename()).toBe('desklab-wiring.md');
  const markdownText = await readFile(await markdown.path(), 'utf8');
  expect(markdownText).toContain('| 主机甲 | HDMI 输出 | 屏幕甲 | HDMI 输入 | HDMI 线 |');
  expect(markdownText).toContain('先接电源，再接信号');
  expect(markdownText).not.toContain('hdmi-1');

  const csvDownload = page.waitForEvent('download');
  await dialog.getByRole('button', { name: '导出 CSV', exact: true }).click();
  const csv = await csvDownload;
  expect(csv.suggestedFilename()).toBe('desklab-wiring.csv');
  const csvText = await readFile(await csv.path(), 'utf8');
  expect(csvText).toContain('起点设备,起点接口,终点设备,终点接口,类型,走线长度（米）,购买长度（米）');
  expect(csvText).toContain('主机甲,HDMI 输出,屏幕甲,HDMI 输入,HDMI 线,');
  expect(evidence.errors).toEqual([]);
});

test('the connections list opens the same cable list', async ({ page }) => {
  const evidence = await openProject(page, objects, connections);
  await page.getByRole('button', { name: '所有连接', exact: true }).click();
  const connectionsDialog = page.getByRole('dialog', { name: '全部连接清单', exact: true });
  await connectionsDialog.getByRole('button', { name: '购线清单', exact: true }).click();
  await expect(connectionsDialog).toHaveCount(0);
  const shop = page.getByRole('dialog', { name: '购线清单', exact: true });
  await expect(shop.getByRole('listitem')).toHaveCount(2);
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('a project with no cables says there is nothing to buy', async ({ page }) => {
  const evidence = await openProject(page, [box('桌子')]);
  await page.getByRole('button', { name: '更多', exact: true }).click();
  await page.getByRole('menu', { name: '更多', exact: true }).getByRole('menuitem', { name: '购线清单', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '购线清单', exact: true });
  await expect(dialog).toContainText('当前没有需要买的线');
  await expect(dialog.getByRole('button', { name: '复制清单', exact: true })).toHaveCount(0);
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('a cable from the floor to the desk is bought long enough to go over the desk edge', async ({ page }) => {
  const evidence = await openProject(page, [], [], { room: { length: 4, width: 3.5, height: 2.7 } });
  await page.getByRole('button', { name: '桌面模板', exact: true }).click();
  await page.getByRole('dialog', { name: '桌面模板', exact: true })
    .getByRole('button', { name: '使用模板：电竞桌', exact: true }).click();
  await page.getByRole('button', { name: '更多', exact: true }).click();
  await page.getByRole('menu', { name: '更多', exact: true }).getByRole('menuitem', { name: '购线清单', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '购线清单', exact: true });
  // Tower on the floor to the screen on the desk: 1.21 m in a straight line
  // through the desktop (1.5 m to buy), 1.44 m over the back edge.
  await expect(dialog.getByRole('listitem').filter({ hasText: 'DP 线' })).toHaveText(['2 米 DP 线×1']);
  await expect(dialog).toContainText('不穿过桌面');
  expect(evidence).toEqual({ errors: [], writes: [] });
});
