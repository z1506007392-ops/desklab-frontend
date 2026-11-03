import { test, expect } from '@playwright/test';
import { box, openProject } from './project-fixture.mjs';

async function openLogin(page) {
  await page.getByRole('button', { name: '改进建议', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '自动检查与改进建议', exact: true });
  const section = dialog.getByRole('region', { name: 'AI 建议', exact: true });
  await section.getByRole('button', { name: '让 AI 看看', exact: true }).click();
  const login = page.getByRole('dialog', { name: '登录后使用 AI', exact: true });
  await expect(login).toBeVisible();
  return { dialog, section, login };
}

function quiet(evidence) {
  return evidence.errors.filter(message => !/Failed to load resource|net::ERR_/.test(message));
}

test('a short code stays on that step, and switching email clears the error', async ({ page }) => {
  let verified = 0;
  const evidence = await openProject(page, [box('桌子')], [], {
    session: null,
    auth: {
      requestCode: () => ({ ok: true }),
      verify: () => { verified += 1; return { status: 400, json: { error: 'code_wrong', message: '验证码不对' } }; },
    },
  });
  const { login } = await openLogin(page);
  await login.getByLabel('邮箱', { exact: true }).fill('leo@example.com');
  await login.getByRole('button', { name: '获取验证码', exact: true }).click();
  await expect(login.getByText('验证码已发到 leo@example.com')).toBeVisible();
  await login.getByLabel('验证码', { exact: true }).fill('12');
  await login.getByRole('button', { name: '登录', exact: true }).click();
  await expect(login.getByRole('alert')).toContainText('请填写 6 位验证码');
  await expect(login.getByText('验证码已发到 leo@example.com')).toBeVisible();
  expect(verified).toBe(0);

  await login.getByRole('button', { name: '换个邮箱', exact: true }).click();
  await expect(login.getByRole('alert')).toHaveCount(0);
  await expect(login.getByLabel('邮箱', { exact: true })).toBeVisible();
  expect(quiet(evidence)).toEqual([]);
});

test('a dropped code request stays on the email step and shows the network sentence', async ({ page }) => {
  const evidence = await openProject(page, [box('桌子')], [], { session: null });
  await page.route('**/api/auth/request-code', route => route.abort('failed'));
  const { login } = await openLogin(page);
  await login.getByLabel('邮箱', { exact: true }).fill('leo@example.com');
  await login.getByRole('button', { name: '获取验证码', exact: true }).click();
  await expect(login.getByRole('alert')).toContainText('网络连接失败，请检查网络后再试');
  await expect(login.getByLabel('邮箱', { exact: true })).toBeVisible();
  expect(quiet(evidence)).toEqual([]);
});

test('a code response that is not JSON stays on the form', async ({ page }) => {
  const evidence = await openProject(page, [box('桌子')], [], { session: null });
  await page.route('**/api/auth/request-code', route => route.fulfill({
    status: 502,
    contentType: 'text/plain',
    body: 'nope',
  }));
  const { login } = await openLogin(page);
  await login.getByLabel('邮箱', { exact: true }).fill('leo@example.com');
  await login.getByRole('button', { name: '获取验证码', exact: true }).click();
  await expect(login.getByRole('alert')).toContainText('登录没有完成，请稍后再试');
  await expect(login.getByLabel('邮箱', { exact: true })).toBeVisible();
  await expect(login.getByText(/验证码已发到/)).toHaveCount(0);
  expect(quiet(evidence)).toEqual([]);
});

test('a failed logout stays signed in and the next try can leave', async ({ page }) => {
  let tries = 0;
  const evidence = await openProject(page, [box('桌子')], [], {
    session: { email: 'leo@example.com', remaining: 4 },
    auth: {
      logout: () => {
        tries += 1;
        if (tries === 1) return { status: 502, json: { message: '退出没有完成，请再试一次' } };
        return { ok: true };
      },
    },
  });
  await page.getByRole('button', { name: '改进建议', exact: true }).click();
  const section = page.getByRole('dialog', { name: '自动检查与改进建议', exact: true })
    .getByRole('region', { name: 'AI 建议', exact: true });
  await expect(section.getByText('今日剩余 4 次')).toBeVisible();
  await section.getByRole('button', { name: '退出', exact: true }).click();
  await expect(section.getByRole('alert')).toContainText('退出没有完成，请再试一次');
  await expect(section.getByText('今日剩余 4 次')).toBeVisible();
  await expect(section.getByRole('button', { name: '退出', exact: true })).toBeEnabled();

  await section.getByRole('button', { name: '退出', exact: true }).click();
  await expect(section.getByText(/今日剩余/)).toHaveCount(0);
  await expect(section.getByRole('button', { name: '退出', exact: true })).toHaveCount(0);
  await expect(section.getByRole('alert')).toHaveCount(0);
  expect(tries).toBe(2);
  expect(quiet(evidence)).toEqual([]);
});
