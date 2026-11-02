import { test, expect } from '@playwright/test';
import { box, openProject } from './project-fixture.mjs';

test('no automatic suggestions still directs the user to unresolved layout problems', async ({ page }) => {
  const evidence = await openProject(page, [box('桌子 A'), box('桌子 B')]);
  await expect(page.getByRole('button', { name: '布局检查 (1)', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '改进建议', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('免费改进 0', { exact: true })).toBeVisible();
  await expect(dialog.getByText('加购建议 0', { exact: true })).toBeVisible();
  await expect(dialog).toContainText('还有 1 项检查问题需要处理');
  await expect(dialog).not.toContainText('完美');
  await dialog.getByRole('button', { name: '查看布局问题 (1)', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(page.getByRole('dialog', { name: '布局检查', exact: true }))
    .toContainText('桌子 A 与 桌子 B 可能互相穿插');
  await expect(page.getByRole('button', { name: '撤销', exact: true })).toBeDisabled();
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('an empty project explains how to start instead of presenting an all-clear', async ({ page }) => {
  const evidence = await openProject(page, []);
  await page.getByRole('button', { name: '改进建议', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('先添加设备，建立你的桌面方案。');
  await expect(dialog).not.toContainText('完美');
  await expect(dialog.getByRole('button', { name: /查看.*问题/ })).toHaveCount(0);
  await dialog.getByRole('button', { name: '添加第一件设备', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByPlaceholder('搜索设备名称、类型、型号...')).toBeVisible();
  await expect(page.getByRole('button', { name: '撤销', exact: true })).toBeDisabled();
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('applying free fixes keeps manual problems visible and supports undo and redo', async ({ page }) => {
  const floating = { ...box('悬空设备', 3), position: { x: 3, y: 0, z: 1.5 } };
  const evidence = await openProject(page, [box('桌子 A'), box('桌子 B'), floating]);
  const openRecommendations = () => page.getByRole('button', { name: /^改进建议/ }).click();
  const closeRecommendations = () => page.getByRole('button', { name: '关闭改进建议', exact: true }).click();
  await openRecommendations();
  const dialog = page.getByRole('dialog', { name: '自动检查与改进建议', exact: true });
  await expect(dialog).toContainText('还有 2 项检查问题需要处理');
  await dialog.getByRole('button', { name: '一键修复所有免费项 (1)', exact: true }).click();
  await expect(dialog.getByText('免费改进 0', { exact: true })).toBeVisible();
  await expect(dialog).toContainText('还有 1 项检查问题需要处理');
  await expect(dialog).not.toContainText('完美');
  await closeRecommendations();
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await openRecommendations();
  await expect(dialog.getByText('免费改进 1', { exact: true })).toBeVisible();
  await expect(dialog).toContainText('还有 2 项检查问题需要处理');
  await closeRecommendations();
  await page.getByRole('button', { name: '重做', exact: true }).click();
  await openRecommendations();
  await expect(dialog.getByText('免费改进 0', { exact: true })).toBeVisible();
  await expect(dialog).toContainText('还有 1 项检查问题需要处理');
  expect(evidence).toEqual({ errors: [], writes: [] });
});

// A computer and a monitor 2m apart joined by a 0.5m HDMI cable: a real wiring
// problem with a matching purchase (a longer cable).
const shortHdmiSetup = () => [
  { ...box('主机', -1), type: 'device', ports: [{ id: 'hdmi-out', name: 'HDMI 输出', type: 'hdmi', direction: 'output' }] },
  { ...box('显示器', 1), type: 'device', ports: [{ id: 'hdmi-in', name: 'HDMI 输入', type: 'hdmi', direction: 'input' }] },
];
const shortHdmiCable = {
  id: 'short-hdmi', name: '太短的 HDMI 线', cableType: 'hdmi', length: 0.5,
  fromObjectId: '主机', fromPortId: 'hdmi-out', toObjectId: '显示器', toPortId: 'hdmi-in',
};

test('wiring problems remain reachable alongside purchase suggestions', async ({ page }) => {
  const evidence = await openProject(page, shortHdmiSetup(), [shortHdmiCable]);
  await page.getByRole('button', { name: /^改进建议/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('加购建议 1', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '查看布线问题 (1)', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(page.getByRole('dialog', { name: '布线检查', exact: true })).toContainText('太短的 HDMI 线');
  await expect(page.getByRole('button', { name: '撤销', exact: true })).toBeDisabled();
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('a checked layout describes the scope of the result without guaranteeing perfection', async ({ page }) => {
  const evidence = await openProject(page, [box('桌子 A', -2), box('桌子 B', 2)]);
  await page.getByRole('button', { name: '改进建议', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '自动检查与改进建议', exact: true });
  await expect(dialog).toContainText('当前检查未发现需要处理的问题');
  await expect(dialog).toContainText('根据当前设备、位置和连接规则生成建议');
  await expect(dialog).not.toContainText('完美');
  await expect(dialog.getByRole('button', { name: /查看.*问题/ })).toHaveCount(0);
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('purchase suggestions are summarized as a copyable shopping list', async ({ page, context }, info) => {
  // Three plugs for one two-socket wall outlet, plus the too-short HDMI cable.
  const wallOutlet = {
    id: '墙插', name: '墙插', type: 'outlet', modelId: 'wall-outlet', shape: 'box',
    position: { x: 0, y: 4.99, z: 0.3 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 0.08, y: 0.02, z: 0.08 },
    ports: [1, 2].map(n => ({ id: `ac-out-${n}`, name: `插座 ${n}`, type: 'ac_output', direction: 'output' })),
  };
  const plugged = (name, x) => ({
    ...box(name, x), type: 'device',
    ports: [{ id: 'power-in', name: '电源输入', type: 'ac_input', direction: 'input' }],
  });
  const evidence = await openProject(page,
    [...shortHdmiSetup(), wallOutlet, plugged('音箱', -3), plugged('台灯', 3), plugged('充电座', -5 + 0.5)],
    [shortHdmiCable]);
  await page.getByRole('button', { name: /^改进建议/ }).click();
  const list = page.getByRole('dialog').getByRole('group', { name: '购物清单' });
  await expect(list.getByRole('listitem')).toHaveText(['3m HDMI 线×1', '插排×1']);

  if (info.project.use.viewport.width >= 900) {
    if (info.project.use.browserName === 'chromium' || info.project.use.channel === 'chrome' || !info.project.use.browserName) {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    }
    await list.getByRole('button', { name: '复制清单', exact: true }).click();
    // The OS clipboard may store line breaks as CRLF.
    await expect.poll(() => page.evaluate(async () => (await navigator.clipboard.readText()).replace(/\r\n/g, '\n')))
      .toBe('DeskLab 购物清单\n- 3m HDMI 线 ×1\n- 插排 ×1');
  }
  expect(evidence).toEqual({ errors: [], writes: [] });
});

// The comfort tips the AI gets are offered to everyone, as optional ones:
// they are not counted on the toolbar, and one click applies the fix.
test('a screen off to one side gets an optional tip that centres it with one click', async ({ page }) => {
  const { buildTemplateScene } = await import('../src/domain/desk-templates.js');
  const scene = buildTemplateScene('gaming');
  const objects = scene.objects.map(object => (object.modelId === 'ultrawide-monitor'
    ? { ...object, position: { ...object.position, x: 0.4 } }
    : object));
  const evidence = await openProject(page, objects, scene.connections, { room: scene.room });
  // Nothing is wrong with the desk, so the toolbar shows no count.
  const suggestions = page.getByRole('button', { name: '改进建议', exact: true });
  await expect(suggestions).toBeVisible();
  await suggestions.click();
  const dialog = page.getByRole('dialog', { name: '自动检查与改进建议', exact: true });
  await expect(dialog.getByRole('heading', { name: '摆放小建议（可选）', exact: true })).toBeVisible();
  const tip = dialog.getByRole('group', { name: '带鱼屏显示器挪到座位正前方', exact: true });
  await expect(tip).toContainText('带鱼屏显示器偏离了座位正前方。');
  await tip.getByRole('button', { name: '照做', exact: true }).click();
  await expect(page.getByText('已调整：带鱼屏显示器挪到座位正前方', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: '摆放小建议（可选）', exact: true })).toHaveCount(0);

  const xOf = async () => {
    await dialog.getByRole('button', { name: '关闭改进建议' }).click();
    const openPanel = page.getByRole('button', { name: '展开属性面板', exact: true });
    if (await openPanel.isVisible()) await openPanel.click();
    await page.getByLabel('设备', { exact: true }).selectOption({ label: '带鱼屏显示器' });
    return Number(await page.getByLabel('左右 X', { exact: true }).inputValue());
  };
  expect(await xOf()).toBe(0);
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  const openPanel = page.getByRole('button', { name: '展开属性面板', exact: true });
  if (await openPanel.isVisible()) await openPanel.click();
  await page.getByLabel('设备', { exact: true }).selectOption({ label: '带鱼屏显示器' });
  expect(Number(await page.getByLabel('左右 X', { exact: true }).inputValue())).toBe(0.4);
  expect(evidence).toEqual({ errors: [], writes: [] });
});
