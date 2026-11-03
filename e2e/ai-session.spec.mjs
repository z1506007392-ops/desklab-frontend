import { test, expect } from '@playwright/test';
import { openProject } from './project-fixture.mjs';
import { buildTemplateScene } from '../src/domain/desk-templates.js';

function messyGaming() {
  const scene = buildTemplateScene('gaming');
  const objects = scene.objects.map(object => (object.modelId === 'ultrawide-monitor'
    ? { ...object, position: { ...object.position, x: 0.4 } }
    : object));
  return { ...scene, objects };
}

async function openAiSection(page) {
  await page.getByRole('button', { name: '改进建议', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '自动检查与改进建议', exact: true });
  return dialog.getByRole('region', { name: 'AI 建议', exact: true });
}

test('a dropped session check stays on the page and does not ask for login', async ({ page }) => {
  const scene = messyGaming();
  const evidence = await openProject(page, scene.objects, scene.connections, {
    room: scene.room,
    session: { email: 'tester@example.com', remaining: 20 },
    ai: () => ({ version: 1, model: 'test', suggestions: [] }),
  });
  let offline = true;
  await page.route('**/api/auth/me', route => {
    if (!offline || route.request().method() !== 'GET') return route.fallback();
    return route.abort('failed');
  });
  const section = await openAiSection(page);
  const alert = section.getByRole('alert').filter({ hasText: '网络连接失败' });
  await expect(alert).toContainText('网络连接失败，请检查网络后再试');
  await expect(section.getByRole('button', { name: '让 AI 看看', exact: true })).toBeDisabled();
  await expect(page.getByRole('dialog', { name: '登录后使用 AI', exact: true })).toHaveCount(0);
  offline = false;
  await alert.getByRole('button', { name: '再试一次', exact: true }).click();
  await expect(section).toContainText('今日剩余 20 次');
  await expect(alert).toHaveCount(0);
  expect(evidence.errors.filter(message => !/Failed to load resource/.test(message))).toEqual([]);
});
