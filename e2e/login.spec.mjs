import { test, expect } from '@playwright/test';
import { box, openProject } from './project-fixture.mjs';

async function openAi(page) {
  await page.getByRole('button', { name: '改进建议', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '自动检查与改进建议', exact: true });
  const section = dialog.getByRole('region', { name: 'AI 建议', exact: true });
  return { dialog, section };
}

test('signing in is required before AI, and it does not start a request by itself', async ({ page }) => {
  let requests = 0;
  const evidence = await openProject(page, [box('桌子')], [], {
    session: null,
    auth: {
      requestCode: body => {
        requests += 1;
        return body.email === 'leo@example.com' ? { ok: true } : { status: 400, json: { error: 'bad_email', message: '请填写有效的邮箱地址' } };
      },
      verify: body => (body.code === '123456'
        ? { email: 'leo@example.com', remaining: 19 }
        : { status: 400, json: { error: 'code_wrong', message: '验证码不对' } }),
      logout: () => ({ ok: true }),
    },
    ai: () => ({ version: 1, model: 'test', suggestions: [], remaining: 18 }),
  });
  const { dialog, section } = await openAi(page);
  const ask = section.getByRole('button', { name: '让 AI 看看', exact: true });
  await expect(ask).toBeEnabled();
  await ask.click();
  const login = page.getByRole('dialog', { name: '登录后使用 AI', exact: true });
  await expect(login).toBeVisible();
  await expect(dialog).toBeVisible();
  expect(evidence.aiRequests).toEqual([]);

  await page.keyboard.press('Escape');
  await expect(login).toHaveCount(0);
  await expect(dialog).toBeVisible();

  await ask.click();
  await login.getByLabel('邮箱', { exact: true }).fill('not-an-email');
  await login.getByRole('button', { name: '获取验证码', exact: true }).click();
  await expect(login.getByRole('alert')).toContainText('请填写有效的邮箱地址');
  expect(requests).toBe(0);

  await login.getByLabel('邮箱', { exact: true }).fill('leo@example.com');
  await login.getByRole('button', { name: '获取验证码', exact: true }).click();
  await expect(login.getByText('验证码已发到 leo@example.com')).toBeVisible();
  await login.getByLabel('验证码', { exact: true }).fill('000000');
  await login.getByRole('button', { name: '登录', exact: true }).click();
  await expect(login.getByRole('alert')).toContainText('验证码不对');

  await login.getByLabel('验证码', { exact: true }).fill('123456');
  await login.getByRole('button', { name: '登录', exact: true }).click();
  await expect(login).toHaveCount(0);
  await expect(section.getByText('今日剩余 19 次')).toBeVisible();
  expect(evidence.aiRequests).toEqual([]);

  await ask.click();
  await expect(section.getByText('AI 这次没有找到能让布局更好的改动。')).toBeVisible();
  await expect(section.getByText('今日剩余 18 次')).toBeVisible();
  expect(evidence.aiRequests).toHaveLength(1);

  await section.getByRole('button', { name: '退出', exact: true }).click();
  await expect(section.getByText(/今日剩余/)).toHaveCount(0);
  await ask.click();
  await expect(page.getByRole('dialog', { name: '登录后使用 AI', exact: true })).toBeVisible();
  expect(evidence.errors.filter(message => !/Failed to load resource/.test(message))).toEqual([]);
  expect(evidence.writes).toEqual([]);
});

test('when mail is not configured, the login dialog says so', async ({ page }) => {
  const evidence = await openProject(page, [box('桌子')], [], {
    session: null,
    auth: {
      requestCode: () => ({ status: 503, json: { error: 'auth_unavailable', message: '登录暂未开放' } }),
    },
  });
  const { section } = await openAi(page);
  await section.getByRole('button', { name: '让 AI 看看', exact: true }).click();
  const login = page.getByRole('dialog', { name: '登录后使用 AI', exact: true });
  await login.getByLabel('邮箱', { exact: true }).fill('leo@example.com');
  await login.getByRole('button', { name: '获取验证码', exact: true }).click();
  await expect(login.getByRole('alert')).toContainText('登录暂未开放');
  expect(evidence.errors.filter(message => !/Failed to load resource/.test(message))).toEqual([]);
  expect(evidence.writes).toEqual([]);
});

test('a rejected session opens the login dialog again', async ({ page }) => {
  const evidence = await openProject(page, [box('桌子')], [], {
    ai: () => ({ status: 401, json: { error: 'auth_required', message: '请先登录后再使用 AI' } }),
  });
  const { dialog, section } = await openAi(page);
  await expect(section.getByText('今日剩余 20 次')).toBeVisible();
  await section.getByRole('button', { name: '让 AI 看看', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '登录后使用 AI', exact: true })).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(section.getByRole('alert')).toHaveCount(0);
  expect(evidence.writes).toEqual([]);
});
