import { test, expect } from '@playwright/test';
import { openProject } from './project-fixture.mjs';
import { buildTemplateScene } from '../src/domain/desk-templates.js';
import { PROJECT_STORAGE_KEY } from '../src/domain/local-project-store.js';

// The gaming template with its ultrawide pushed 0.4 m to the right.
function messyGaming() {
  const scene = buildTemplateScene('gaming');
  const objects = scene.objects.map(object => (object.modelId === 'ultrawide-monitor'
    ? { ...object, position: { ...object.position, x: 0.4 } }
    : object));
  return { ...scene, objects };
}

const monitorId = scene => scene.objects.find(object => object.modelId === 'ultrawide-monitor').id;

function answer(scene) {
  const monitor = scene.objects.find(object => object.modelId === 'ultrawide-monitor');
  return {
    version: 1,
    model: 'test',
    suggestions: [
      { id: 'good', title: '显示器移到正前方', reason: '显示器正对座位，看屏幕不用歪头。', category: 'ergonomics',
        actions: [{ type: 'move', objectId: monitor.id, x: 0, y: monitor.position.y }] },
      { id: 'floor', title: '显示器放地上', reason: '桌面更空。', category: 'space',
        actions: [{ type: 'move', objectId: monitor.id, x: 1.5, y: 0 }] },
      { id: 'worse', title: '显示器再往右', reason: '换个位置。', category: 'space',
        actions: [{ type: 'move', objectId: monitor.id, x: 0.7, y: monitor.position.y }] },
    ],
  };
}

async function openAiSection(page) {
  await page.getByRole('button', { name: '改进建议', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '自动检查与改进建议', exact: true });
  return { dialog, section: dialog.getByRole('region', { name: 'AI 建议', exact: true }) };
}

async function storedMonitorX(page, scene) {
  return page.evaluate(([key, id]) => JSON.parse(localStorage.getItem(key)).objects.find(o => o.id === id).position.x, [PROJECT_STORAGE_KEY, monitorId(scene)]);
}

test('AI suggestions are checked, previewed, applied, and undone', async ({ page }) => {
  const scene = messyGaming();
  const evidence = await openProject(page, scene.objects, scene.connections, { room: scene.room, ai: () => answer(scene) });
  const { dialog, section } = await openAiSection(page);
  await expect(section).toContainText('使用 AI 时，桌面布局数据会发送给 DeepSeek 处理');

  await section.getByLabel('想怎么改？（可选）').fill('适合打游戏');
  await section.getByRole('button', { name: '让 AI 看看', exact: true }).click();
  const card = section.getByRole('group', { name: '显示器移到正前方', exact: true });
  await expect(card).toBeVisible();
  await expect(card).toContainText('会调整：带鱼屏显示器');
  // The other two would put the monitor on the floor or make things worse.
  await expect(section.getByRole('group')).toHaveCount(1);
  expect(evidence.aiRequests).toHaveLength(1);
  expect(evidence.aiRequests[0].goal).toBe('适合打游戏');
  expect(evidence.aiRequests[0].summary.hints.map(hint => hint.code)).toEqual(['monitor_off_center']);

  await card.getByRole('button', { name: '预览', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const preview = page.getByRole('region', { name: 'AI 预览', exact: true });
  await expect(preview).toContainText('预览 AI 建议：显示器移到正前方');
  await expect(page.getByRole('button', { name: '保存项目', exact: true })).toBeDisabled();
  await preview.getByRole('button', { name: '取消', exact: true }).click();
  await expect(preview).toHaveCount(0);

  const reopened = await openAiSection(page);
  await reopened.section.getByRole('group', { name: '显示器移到正前方' }).getByRole('button', { name: '应用', exact: true }).click();
  await expect(page.getByText(/已应用 AI 建议：显示器移到正前方/)).toBeVisible();
  await page.getByRole('button', { name: '保存项目', exact: true }).click();
  await expect(page.getByText(/^✅ 已保存$/)).toBeVisible();
  expect(await storedMonitorX(page, scene)).toBe(0);

  // Applied suggestions disappear; undo brings the old layout back.
  const again = await openAiSection(page);
  await expect(again.section.getByRole('group')).toHaveCount(0);
  await again.dialog.getByRole('button', { name: '关闭改进建议' }).click();
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await page.getByRole('button', { name: '保存项目', exact: true }).click();
  await expect(page.getByText(/^✅ 已保存$/)).toBeVisible();
  expect(await storedMonitorX(page, scene)).toBe(0.4);
  expect(evidence.errors).toEqual([]);
  expect(evidence.writes).toEqual([]);
});

test('when no suggestion survives the checks, the user is told so', async ({ page }) => {
  const scene = messyGaming();
  const all = answer(scene);
  const evidence = await openProject(page, scene.objects, scene.connections, {
    room: scene.room, ai: () => ({ ...all, suggestions: all.suggestions.slice(1) }),
  });
  const { section } = await openAiSection(page);
  await section.getByRole('button', { name: '让 AI 看看', exact: true }).click();
  await expect(section.getByText('AI 这次没有找到能让布局更好的改动。')).toBeVisible();
  expect(evidence.errors).toEqual([]);
});

test('before the AI is switched on, the section says so and nothing else breaks', async ({ page }) => {
  const scene = messyGaming();
  const evidence = await openProject(page, scene.objects, scene.connections, {
    room: scene.room, ai: () => ({ status: 503, json: { error: 'ai_unavailable', message: 'AI 功能暂未开放' } }),
  });
  const { dialog, section } = await openAiSection(page);
  await section.getByRole('button', { name: '让 AI 看看', exact: true }).click();
  await expect(section).toContainText('AI 功能暂未开放');
  await expect(section.getByRole('button', { name: '让 AI 看看' })).toHaveCount(0);
  await expect(dialog.getByText(/免费改进/)).toBeVisible();
  expect(evidence.errors.filter(message => !/Failed to load resource/.test(message))).toEqual([]);
});

test('a slow or failed answer explains itself and can be retried', async ({ page }) => {
  const scene = messyGaming();
  let calls = 0;
  const evidence = await openProject(page, scene.objects, scene.connections, {
    room: scene.room,
    ai: () => {
      calls += 1;
      return calls === 1
        ? { status: 504, json: { error: 'ai_timeout', message: 'AI 想得太久了，请再试一次' } }
        : answer(scene);
    },
  });
  const { section } = await openAiSection(page);
  await section.getByRole('button', { name: '让 AI 看看', exact: true }).click();
  const alert = section.getByRole('alert');
  await expect(alert).toContainText('AI 想得太久了，请再试一次');
  await alert.getByRole('button', { name: '再试一次', exact: true }).click();
  await expect(section.getByRole('group', { name: '显示器移到正前方' })).toBeVisible();
  expect(evidence.errors.filter(message => !/Failed to load resource/.test(message))).toEqual([]);
});

test('a request in progress can be cancelled', async ({ page }) => {
  const scene = messyGaming();
  let release;
  const evidence = await openProject(page, scene.objects, scene.connections, {
    room: scene.room,
    ai: () => new Promise(resolve => { release = () => resolve(answer(scene)); }),
  });
  const { section } = await openAiSection(page);
  await section.getByRole('button', { name: '让 AI 看看', exact: true }).click();
  const status = section.getByRole('status').filter({ hasText: 'AI 正在看你的桌面' });
  await expect(status).toBeVisible();
  await status.getByRole('button', { name: '取消', exact: true }).click();
  await expect(status).toHaveCount(0);
  await expect(section.getByRole('button', { name: '让 AI 看看', exact: true })).toBeEnabled();
  release?.();
  await page.waitForTimeout(300);
  await expect(section.getByRole('group')).toHaveCount(0, { timeout: 1000 });
  expect(evidence.writes).toEqual([]);
});
