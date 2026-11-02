import { test, expect } from '@playwright/test';
import { box, openProject } from './project-fixture.mjs';

const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
const notice = page => page.getByRole('region', { name: '建议用电脑打开', exact: true });

// The owner's call (E59): on a phone, suggest the computer web version once.
test('a phone visitor is told once that a computer works better, and it stays dismissed', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ ...testInfo.project.use, ...PHONE });
  const page = await context.newPage();
  const evidence = await openProject(page, [box('桌子 A')], [], { phoneNotice: true });
  await expect(notice(page)).toContainText('为了您的正常使用体验，建议在电脑浏览器里打开 DeskLab');
  await expect(notice(page)).toContainText('手机上也可以继续查看和简单修改');
  await notice(page).getByRole('button', { name: '知道了', exact: true }).click();
  await expect(notice(page)).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: '保存项目', exact: true })).toBeVisible();
  await expect(notice(page)).toHaveCount(0);
  expect(evidence).toEqual({ errors: [], writes: [] });
  await context.close();
});

test('the phone notice can copy the address to open on a computer', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ ...testInfo.project.use, ...PHONE });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await context.newPage();
  const evidence = await openProject(page, [box('桌子 A')], [], { phoneNotice: true });
  await notice(page).getByRole('button', { name: '复制网址', exact: true }).click();
  await expect(page.getByText('网址已复制，可以发到电脑上打开', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());
  await expect(notice(page)).toHaveCount(0);
  expect(evidence).toEqual({ errors: [], writes: [] });
  await context.close();
});

test('a computer, even with a narrow window, gets no phone notice', async ({ browser }, testInfo) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 600, height: 800 }]) {
    const context = await browser.newContext({ ...testInfo.project.use, viewport, hasTouch: false });
    const page = await context.newPage();
    const evidence = await openProject(page, [box('桌子 A')], [], { phoneNotice: true });
    await expect(page.getByRole('button', { name: '保存项目', exact: true })).toBeVisible();
    await expect(notice(page)).toHaveCount(0);
    expect(evidence).toEqual({ errors: [], writes: [] });
    await context.close();
  }
});
