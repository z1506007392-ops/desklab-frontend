import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildEvalScenes, evalProbeDecision, readResumeResults, runEval, summarize } from '../tools/ai-eval/lib.mjs';
import { createLayoutHandler } from '../server/ai/layout-handler.js';
import { createMockFetch } from '../server/ai/mock-model.js';
import { analyzeLayoutHeuristics } from '../src/domain/layout-heuristics.js';
import { scoreLayout } from '../src/domain/layout-score.js';
import { isProjectEnvelope } from '../src/domain/project-validation.js';

const MESS_HINT = {
  'monitor-off-centre': 'monitor_off_center',
  'monitor-turned-away': 'monitor_facing_away',
  'monitor-too-close': 'monitor_too_close',
  'laptop-at-back': 'laptop_at_back',
  'tower-in-legroom': 'tower_blocks_legroom',
  'tower-on-desk': 'tower_on_desk_center',
  'strip-on-desk': 'strip_on_desk',
  'cable-too-long': 'cable_too_long',
  'router-buried': 'router_buried',
  'console-on-desk': 'console_on_desk',
  'lamp-in-front': 'lamp_blocks_work',
  'speakers-in-front': 'speakers_block_seat',
  'mouse-far': 'mouse_far_from_keyboard',
};

test('the evaluation set has at least 15 scenes and each kind is what it claims', () => {
  const scenes = buildEvalScenes();
  assert.ok(scenes.length >= 15, `${scenes.length} scenes`);
  assert.equal(new Set(scenes.map(scene => scene.id)).size, scenes.length, 'ids are unique');
  for (const scene of scenes) {
    assert.ok(isProjectEnvelope(scene.project), scene.id);
    const score = scoreLayout(scene.project);
    if (scene.kind === 'good') assert.equal(score.hints + score.warnings + score.errors, 0, `${scene.id} should be a good desk`);
    if (scene.kind === 'messy') assert.ok(score.hints + score.warnings > 0, `${scene.id} should have something to fix`);
    assert.ok(scene.goals.length >= 1);
  }
  assert.ok(scenes.filter(scene => scene.kind === 'messy').length >= 9);
  const goalSentences = new Set(scenes.flatMap(scene => scene.goals).filter(Boolean));
  assert.ok(goalSentences.size >= 7, `only ${goalSentences.size} goal sentences`);
  for (const scene of scenes) {
    const mess = scene.id.split('/')[1];
    const code = MESS_HINT[mess];
    if (!code) continue;
    const hints = analyzeLayoutHeuristics(scene.project.room, scene.project.objects, scene.project.connections);
    assert.ok(hints.some(hint => hint.code === code), `${scene.id} should report ${code}`);
  }
});

test('a run through the mock model produces sound metrics', async () => {
  const handler = createLayoutHandler({
    fetchImpl: createMockFetch({ delayMs: 0 }),
    logger: { log() {} },
    sessionOf: async () => ({ email: 'eval@localhost' }),
  });
  const post = async body => {
    const response = await handler({
      request: new Request('https://desklab.test/api/ai/layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      env: { DEEPSEEK_API_KEY: 'mock' },
    });
    return { status: response.status, json: await response.json() };
  };
  const results = await runEval({ post });
  const { metrics, checks } = summarize(results);
  assert.equal(metrics.parseRate, 1);
  assert.equal(metrics.newErrors, 0, 'validation never lets a suggestion add errors');
  assert.equal(metrics.jargonRate, 0);
  assert.ok(metrics.acceptedSuggestions > 0, 'the mock fixes at least the off-centre monitors');
  assert.ok(metrics.averageImprovement > 0);
  assert.equal(checks.parseRate, true);
  // Hint fixes are copied, so the offline mock is expected to clear the
  // messy-desk bar. This is not a live DeepSeek score.
  assert.ok(metrics.messyHelpedRate >= 0.8, `messyHelpedRate ${metrics.messyHelpedRate}`);
});

test('a run can skip finished pairs and stop early', async () => {
  const calls = [];
  const post = async body => { calls.push(body.goal); return { status: calls.length > 2 ? 429 : 200, json: { suggestions: [] } }; };
  const results = await runEval({
    post,
    skip: scene => scene === 'home-office',
    onResult: result => (result.status === 429 ? 'stop' : undefined),
  });
  assert.equal(results.length, 3, 'two answers and the refused one');
  assert.equal(results.at(-1).status, 429);
  assert.ok(!results.some(result => result.scene === 'home-office'));
});

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const resultsDir = join(repoRoot, 'tools', 'ai-eval', 'results');
const resultNames = () => (existsSync(resultsDir) ? readdirSync(resultsDir).sort() : []);

function runEvalScript(args) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, ['tools/ai-eval/run-eval.mjs', ...args], {
      cwd: repoRoot,
      // The test runner's own --test flag must not be forwarded to this script.
      execArgv: [],
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    const timer = setTimeout(() => child.kill(), 15000);
    child.on('close', status => {
      clearTimeout(timer);
      resolve({ status, stdout, stderr });
    });
  });
}

test('a probe or a saved file decides whether a run may start', () => {
  assert.equal(evalProbeDecision(null).ok, false);
  assert.equal(evalProbeDecision(null).code, 2);
  assert.match(evalProbeDecision(null).message, /Nothing answers/);
  assert.match(evalProbeDecision({ status: 503 }).message, /no DEEPSEEK_API_KEY/);
  assert.match(evalProbeDecision({ status: 401 }).message, /AI_EVAL_COOKIE/);
  assert.equal(evalProbeDecision({ status: 200 }).ok, true);

  assert.match(readResumeResults('{').message, /not valid JSON/);
  assert.match(readResumeResults('{"ok":true}').message, /not a list/);
  const saved = readResumeResults(JSON.stringify([{ status: 200, scene: 'a' }, { status: 429, scene: 'b' }]));
  assert.equal(saved.ok, true);
  assert.deepEqual(saved.results.map(result => result.scene), ['a']);
});

test('a missing server, a 503, and a corrupt resume exit before writing results', async () => {
  const before = resultNames();
  const missing = await runEvalScript(['--url', 'http://127.0.0.1:9/api/ai/layout']);
  assert.equal(missing.status, 2, missing.stderr);
  assert.match(missing.stderr, /Nothing answers/);
  assert.deepEqual(resultNames(), before);

  const server = createServer((_request, response) => {
    response.writeHead(503, { 'Content-Type': 'application/json' });
    response.end('{"error":"unavailable"}');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address();
    const unavailable = await runEvalScript(['--url', `http://127.0.0.1:${port}/api/ai/layout`]);
    assert.equal(unavailable.status, 2, unavailable.stderr);
    assert.match(unavailable.stderr, /no DEEPSEEK_API_KEY/);
    assert.deepEqual(resultNames(), before);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }

  const dir = mkdtempSync(join(tmpdir(), 'desklab-eval-'));
  writeFileSync(join(dir, 'results.json'), '{');
  const corrupt = await runEvalScript(['--resume', dir]);
  assert.equal(corrupt.status, 2, corrupt.stderr);
  assert.match(corrupt.stderr, /not valid JSON/);
  assert.equal(existsSync(join(dir, 'summary.json')), false);
  assert.deepEqual(resultNames(), before);
});
