import { test, expect } from '@playwright/test';
import { openProject } from './project-fixture.mjs';

const guide = page => page.getByRole('region', { name: '开始搭建', exact: true });

test('a first-time visitor is offered three ways to start, and a template ends the guide', async ({ page }) => {
  const evidence = await openProject(page, [], [], { saved: false });
  await expect(guide(page)).toBeVisible();
  await expect(guide(page)).toBeInViewport({ ratio: 1 });

  await guide(page).getByRole('button', { name: '从模板开始', exact: true }).click();
  const picker = page.getByRole('dialog', { name: '桌面模板', exact: true });
  await expect(picker).toBeVisible();
  await picker.getByRole('button', { name: '使用模板：家庭办公', exact: true }).click();
  await expect(guide(page)).toHaveCount(0);

  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(guide(page), 'a dismissed guide stays away for this visit').toHaveCount(0);
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('"generate from my devices" opens the picker at the device form', async ({ page }) => {
  const evidence = await openProject(page, [], [], { saved: false });
  await guide(page).getByRole('button', { name: '按我的设备生成', exact: true }).click();
  const picker = page.getByRole('dialog', { name: '桌面模板', exact: true });
  await expect(picker.getByRole('heading', { name: '按我的设备生成', exact: true })).toBeInViewport();
  await expect(guide(page)).toHaveCount(0);
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('"I will place things myself" closes the guide and opens the device library', async ({ page }) => {
  const evidence = await openProject(page, [], [], { saved: false });
  await guide(page).getByRole('button', { name: '自己摆', exact: true }).click();
  await expect(guide(page)).toHaveCount(0);
  await expect(page.getByPlaceholder('搜索设备名称、类型、型号...')).toBeVisible();
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('a user who already saved an empty room is not shown the guide', async ({ page }) => {
  const evidence = await openProject(page, []);
  await expect(page.getByRole('button', { name: '桌面模板', exact: true })).toBeVisible();
  await expect(guide(page)).toHaveCount(0);
  expect(evidence).toEqual({ errors: [], writes: [] });
});
