import { test, expect } from '@playwright/test';
import { box, openProject } from './project-fixture.mjs';

const DATA_TOOLS = ['导入备份', '导出备份', '粘贴项目', '复制项目'];

test('project data tools and axes live behind the more menu', async ({ page }) => {
  const evidence = await openProject(page, [box('桌子 A')]);

  for (const name of DATA_TOOLS) {
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
  }
  await expect(page.getByRole('checkbox', { name: '显示坐标轴' })).toHaveCount(0);

  const more = page.getByRole('button', { name: '更多', exact: true });
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await more.click();
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  const menu = page.getByRole('menu', { name: '更多', exact: true });
  for (const name of DATA_TOOLS) {
    await expect(menu.getByRole('menuitem', { name, exact: true })).toBeEnabled();
  }
  const axes = menu.getByRole('menuitemcheckbox', { name: '显示坐标轴' });
  await expect(axes).toBeChecked();
  await axes.click();
  await expect(axes).not.toBeChecked();
  await expect(menu, 'toggling axes keeps the menu open').toBeVisible();
  await expect(menu).toBeInViewport({ ratio: 1 });

  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(more).toBeFocused();

  await more.click();
  await page.getByText('DeskLab MVP', { exact: true }).click();
  await expect(menu).toHaveCount(0);

  await more.click();
  const download = page.waitForEvent('download');
  await menu.getByRole('menuitem', { name: '导出备份', exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/^desklab-project-.*\.json$/);
  await expect(menu).toHaveCount(0);

  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('importing a file that is not a backup explains it in plain words', async ({ page }) => {
  const evidence = await openProject(page, [box('桌子 A')]);
  await page.getByLabel('导入 DeskLab 备份文件', { exact: true }).setInputFiles({
    name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello'),
  });
  await expect(page.getByText('导入失败：这不是 DeskLab 的备份文件，或者文件已损坏')).toBeVisible();
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('the about and privacy dialog says where the desk is kept and what AI sends', async ({ page }) => {
  const evidence = await openProject(page, [box('桌子 A')]);
  const open = async () => {
    await page.getByRole('button', { name: '更多', exact: true }).click();
    await page.getByRole('menu', { name: '更多', exact: true }).getByRole('menuitem', { name: '关于与隐私', exact: true }).click();
    return page.getByRole('dialog', { name: '关于与隐私', exact: true });
  };
  const dialog = await open();
  await expect(dialog).toContainText('项目只保存在你这台设备的浏览器里');
  await expect(dialog).toContainText('导出备份');
  await expect(dialog).toContainText('发送给 DeepSeek');
  await expect(dialog).toContainText('不使用统计或广告追踪');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  const again = await open();
  await again.getByRole('button', { name: '关闭关于与隐私', exact: true }).click();
  await expect(again).toHaveCount(0);
  expect(evidence).toEqual({ errors: [], writes: [] });
});
