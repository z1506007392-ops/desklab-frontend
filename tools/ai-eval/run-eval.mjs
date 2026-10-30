// Run the AI evaluation against a running /api/ai/layout and record results.
//   DEEPSEEK_API_KEY=sk-... npm run dev:api     (in another terminal)
//   node tools/ai-eval/run-eval.mjs [--url http://localhost:3001/api/ai/layout]
// Raw answers and metrics go to tools/ai-eval/results/<timestamp>/. The run
// fails (exit code 1) when a threshold in lib.mjs is missed. Never commit a
// results folder that contains anything secret; answers hold no key.
import { mkdirSync, writeFileSync } from 'node:fs';
import process from 'node:process';

import { THRESHOLDS, runEval, summarize } from './lib.mjs';

const urlFlag = process.argv.indexOf('--url');
const url = urlFlag > 0 ? process.argv[urlFlag + 1] : 'http://localhost:3001/api/ai/layout';

const probe = await fetch(url, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: 1, summary: {} }),
}).catch(() => null);
if (!probe) {
  console.error(`Nothing answers at ${url}. Start it with: DEEPSEEK_API_KEY=sk-... npm run dev:api`);
  process.exit(2);
}
if (probe.status === 503) {
  console.error('The endpoint says AI is not available: no DEEPSEEK_API_KEY (roadmap H1). Nothing to evaluate yet.');
  process.exit(2);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = new URL(`./results/${stamp}/`, import.meta.url);
mkdirSync(outDir, { recursive: true });

const results = await runEval({
  post: async body => {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, json: await response.json().catch(() => null) };
  },
  onResult: result => {
    console.log(`${result.status} ${result.scene} goal=${JSON.stringify(result.goal)} accepted=${result.acceptedCount}/${result.rawCount} ${result.ms}ms`);
    if (result.status === 429) {
      console.error('Rate limited: run the dev server without AI_LOCAL_RATE_LIMIT, or raise AI_PER_IP_HOURLY.');
      process.exit(2);
    }
  },
});

const summary = summarize(results);
writeFileSync(new URL('results.json', outDir), JSON.stringify(results, null, 2));
writeFileSync(new URL('summary.json', outDir), JSON.stringify({ ...summary, thresholds: THRESHOLDS }, null, 2));
console.log(JSON.stringify(summary, null, 2));
console.log(`Saved to ${outDir.pathname}`);
process.exit(summary.passed ? 0 : 1);
