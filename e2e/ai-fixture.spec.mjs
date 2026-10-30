import { test, expect } from '@playwright/test';
import { box, openProject } from './project-fixture.mjs';

const askAi = page => page.evaluate(async () => {
  const response = await fetch('/api/ai/layout', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: 1, summary: { objects: [] }, goal: '整洁' }),
  });
  return { status: response.status, body: await response.json() };
}).catch(error => ({ failed: String(error) }));

test('the fixture can answer the AI endpoint and records what was asked', async ({ page }) => {
  const evidence = await openProject(page, [box('桌子 A')], [], {
    ai: body => (body.goal === '整洁'
      ? { version: 1, model: 'test', suggestions: [] }
      : { status: 503, json: { error: 'ai_unavailable', message: 'AI 功能暂未开放' } }),
  });
  expect(await askAi(page)).toEqual({ status: 200, body: { version: 1, model: 'test', suggestions: [] } });
  expect(evidence.aiRequests).toEqual([{ version: 1, summary: { objects: [] }, goal: '整洁' }]);
  expect(evidence.writes).toEqual([]);
  expect(evidence.errors).toEqual([]);
});

test('without an AI answer, an AI request counts as an unexpected server call', async ({ page }) => {
  const evidence = await openProject(page, [box('桌子 A')]);
  expect(await askAi(page)).toHaveProperty('failed');
  expect(evidence.writes).toHaveLength(1);
  expect(evidence.writes[0]).toMatch(/^POST .*\/api\/ai\/layout$/);
});
