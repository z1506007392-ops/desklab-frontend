import { test, expect } from '@playwright/test';
import { box, openProject } from './project-fixture.mjs';

function hdmiEnds(leftName, leftX, rightName, rightX) {
  return [
    {
      ...box(leftName, leftX), type: 'device',
      ports: [{ id: 'hdmi-out', name: 'HDMI 输出', type: 'hdmi', direction: 'output' }],
    },
    {
      ...box(rightName, rightX), type: 'device',
      ports: [{ id: 'hdmi-in', name: 'HDMI 输入', type: 'hdmi', direction: 'input' }],
    },
  ];
}

function hdmiCable(name, length, from, to) {
  return {
    id: 'hdmi-1', name, cableType: 'hdmi', length,
    fromObjectId: from, fromPortId: 'hdmi-out', toObjectId: to, toPortId: 'hdmi-in',
  };
}

async function openWiring(page) {
  await page.getByRole('button', { name: /^布线检查/ }).click();
  return page.getByRole('dialog', { name: '布线检查', exact: true });
}

test('extending one short cable is a single undo and redo step', async ({ page }) => {
  const evidence = await openProject(
    page,
    hdmiEnds('主机', -1, '显示器', 1),
    [hdmiCable('太短的 HDMI 线', 0.5, '主机', '显示器')],
  );
  await expect(page.getByRole('button', { name: '布线检查 (1)', exact: true })).toBeVisible();
  const dialog = await openWiring(page);
  await expect(dialog).toContainText('太短的 HDMI 线');
  await expect(dialog.getByRole('button', { name: /^一键延长过短线材/ })).toBeVisible();
  await dialog.getByRole('button', { name: /^延长到推荐长度/ }).click();
  await expect(page.getByText(/线材已延长到约/)).toBeVisible();
  await dialog.getByRole('button', { name: '关闭布线检查', exact: true }).click();
  await expect(page.getByRole('button', { name: '布线检查', exact: true })).toBeVisible();

  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(page.getByRole('button', { name: '布线检查 (1)', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '重做', exact: true }).click();
  await expect(page.getByRole('button', { name: '布线检查', exact: true })).toBeVisible();
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('extending every short cable is one undo step', async ({ page }) => {
  const evidence = await openProject(
    page,
    hdmiEnds('主机', -1, '显示器', 1),
    [hdmiCable('太短的 HDMI 线', 0.5, '主机', '显示器')],
  );
  const dialog = await openWiring(page);
  await dialog.getByRole('button', { name: '一键延长过短线材 (1)', exact: true }).click();
  await expect(page.getByText('已自动应用 1 项改进建议', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '关闭布线检查', exact: true }).click();
  await expect(page.getByRole('button', { name: '布线检查', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(page.getByRole('button', { name: '布线检查 (1)', exact: true })).toBeVisible();
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('cleaning a connection to a missing device can be undone', async ({ page }) => {
  const cable = {
    id: 'dangling-1', name: '断掉的线', cableType: 'hdmi', length: 2,
    fromObjectId: '主机', fromPortId: 'hdmi-out', toObjectId: 'missing-device', toPortId: 'hdmi-in',
  };
  await page.addInitScript(extra => {
    window.__DESKLAB_E2E_DANGLING_CABLE__ = extra;
  }, cable);
  const evidence = await openProject(page, hdmiEnds('主机', 0, '显示器', 0.3));
  await expect(page.getByRole('button', { name: '布线检查 (1)', exact: true })).toBeVisible();
  const dialog = await openWiring(page);
  await expect(dialog).toContainText('断掉的线');
  page.once('dialog', popup => popup.accept());
  await dialog.getByRole('button', { name: '清理无效连接 (1)', exact: true }).click();
  await expect(page.getByText('已清理 1 条无效连接', { exact: true })).toBeVisible();
  await expect(dialog).toContainText('当前未发现可识别的布线问题');
  await dialog.getByRole('button', { name: '关闭布线检查', exact: true }).click();
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(page.getByRole('button', { name: '布线检查 (1)', exact: true })).toBeVisible();
  const again = await openWiring(page);
  await expect(again).toContainText('断掉的线');
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('a passive cable past the usual length is explained in the wiring report', async ({ page }) => {
  const evidence = await openProject(
    page,
    hdmiEnds('主机', -0.2, '显示器', 0.2),
    [hdmiCable('很长的 HDMI 线', 10, '主机', '显示器')],
  );
  const dialog = await openWiring(page);
  await expect(dialog).toContainText('很长的 HDMI 线');
  await expect(dialog).toContainText('有源线');
  expect(evidence).toEqual({ errors: [], writes: [] });
});
