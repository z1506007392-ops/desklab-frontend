// Run the AI evaluation against a running /api/ai/layout and record results.
//   DEEPSEEK_API_KEY=sk-... npm run dev:api     (in another terminal)
//   node tools/ai-eval/run-eval.mjs [--url http://localhost:3001/api/ai/layout]
//   node tools/ai-eval/run-eval.mjs --url ... --resume tools/ai-eval/results/<run>
// Raw answers and metrics go to tools/ai-eval/results/<timestamp>/ (or the
// --resume folder). On a rate limit (429) the run stops, saves what it has,
// and exits 2; run again later with --resume to finish. Exit 1 means a
// threshold in lib.mjs was missed. Behind an HTTP proxy, start Node with
// NODE_USE_ENV_PROXY=1 so fetch uses HTTPS_PROXY.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { THRESHOLDS, buildEvalScenes, runEval, summarize } from './lib.mjs';

const flag = name => {
  const index = process.argv.indexOf(name);
  return index > 0 ? process.argv[index + 1] : null;
};
const url = flag('--url') || 'http://localhost:3001/api/ai/layout';
const resume = flag('--resume');

const post = async body => {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: response.status, json: await response.json().catch(() => null) };
};

const outDir = resume
  ? pathToFileURL(`${resume.replace(/\/+$/, '')}/`)
  : new URL(`./results/${new Date().toISOString().replace(/[:.]/g, '-')}/`, import.meta.url);
mkdirSync(outDir, { recursive: true });
const resultsFile = new URL('results.json', outDir);
const previous = resume && existsSync(resultsFile)
  ? JSON.parse(readFileSync(resultsFile, 'utf8')).filter(result => result.status === 200)
  : [];
const done = new Set(previous.map(result => JSON.stringify([result.scene, result.goal])));

if (!resume) {
  const probe = await post({ version: 1, summary: {} }).catch(() => null);
  if (!probe) {
    console.error(`Nothing answers at ${url}. Start it with: DEEPSEEK_API_KEY=sk-... npm run dev:api`);
    process.exit(2);
  }
  if (probe.status === 503) {
    console.error('The endpoint says AI is not available: no DEEPSEEK_API_KEY (roadmap H1). Nothing to evaluate yet.');
    process.exit(2);
  }
}

let rateLimited = false;
const fresh = await runEval({
  post,
  skip: (scene, goal) => done.has(JSON.stringify([scene, goal])),
  onResult: result => {
    console.log(`${result.status} ${result.scene} goal=${JSON.stringify(result.goal)} accepted=${result.acceptedCount}/${result.rawCount} ${result.ms}ms`);
    if (result.status === 429) {
      rateLimited = true;
      return 'stop';
    }
    return undefined;
  },
});

const results = [...previous, ...fresh.filter(result => result.status !== 429)];
writeFileSync(resultsFile, JSON.stringify(results, null, 2));
const expected = buildEvalScenes().reduce((sum, scene) => sum + scene.goals.length, 0);
console.log(`Saved ${results.length}/${expected} results to ${outDir.pathname}`);
if (rateLimited) {
  console.error(`Rate limited. Finish later with: --resume ${outDir.pathname}`);
  process.exit(2);
}

const summary = summarize(results);
writeFileSync(new URL('summary.json', outDir), JSON.stringify({ ...summary, thresholds: THRESHOLDS }, null, 2));
console.log(JSON.stringify(summary, null, 2));
process.exit(summary.passed ? 0 : 1);
