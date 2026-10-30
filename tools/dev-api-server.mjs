// Local stand-in for Cloudflare Pages Functions, so `npm run dev` (which
// proxies /api to port 3001) can use the AI endpoint.
//   DEEPSEEK_API_KEY=sk-... npm run dev:api   real DeepSeek
//   AI_MOCK=1 npm run dev:api                 offline mock answers
// Other settings (DEEPSEEK_MODEL, AI_TIMEOUT_MS, ...) come from the
// environment, as on Cloudflare. A .env file is not read automatically.
import { createServer } from 'node:http';

import { createLayoutHandler } from '../server/ai/layout-handler.js';
import { createMockFetch } from '../server/ai/mock-model.js';
import { createRateLimiter } from '../server/ai/rate-limit.js';

const port = Number(process.env.PORT) || 3001;
const mock = process.env.AI_MOCK === '1';
const env = mock ? { ...process.env, DEEPSEEK_API_KEY: 'mock' } : process.env;
const handleLayoutRequest = createLayoutHandler({
  fetchImpl: mock ? createMockFetch() : undefined,
  rateLimiter: createRateLimiter(),
});

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname !== '/api/ai/layout' || req.method !== 'POST') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
    return;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const request = new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': req.socket.remoteAddress || 'local' },
    body: Buffer.concat(chunks),
  });
  const response = await handleLayoutRequest({ request, env });
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(await response.text());
});

server.listen(port, () => {
  const mode = mock ? 'mock answers' : env.DEEPSEEK_API_KEY ? 'DeepSeek' : 'no key: AI answers 503';
  console.log(`DeskLab AI dev server on http://localhost:${port}/api/ai/layout (${mode})`);
});
