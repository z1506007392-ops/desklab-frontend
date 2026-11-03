// Local stand-in for Cloudflare Pages Functions, so `npm run dev` (which
// proxies /api to port 3001) can use the AI endpoint.
//   DEEPSEEK_API_KEY=sk-... npm run dev:api   real DeepSeek
//   AI_MOCK=1 npm run dev:api                 offline mock answers
// Other settings (DEEPSEEK_MODEL, AI_TIMEOUT_MS, ...) come from the
// environment, as on Cloudflare. A .env file is not read automatically.
// Rate limits only protect the public site; set AI_LOCAL_RATE_LIMIT=1 to
// try them locally (evaluation runs would otherwise hit them).
import { createServer } from 'node:http';

import { createAuthHandlers } from '../server/ai/auth.js';
import { guardApiRequest } from '../server/ai/desktop-cors.js';
import { createLayoutHandler } from '../server/ai/layout-handler.js';
import { createMockFetch } from '../server/ai/mock-model.js';
import { createRateLimiter } from '../server/ai/rate-limit.js';

const port = Number(process.env.PORT) || 3001;
const mock = process.env.AI_MOCK === '1';
const env = mock ? { ...process.env, DEEPSEEK_API_KEY: 'mock' } : process.env;
const limiter = createRateLimiter();
const auth = createAuthHandlers({ rateLimiter: limiter });
const handleLayoutRequest = createLayoutHandler({
  fetchImpl: mock ? createMockFetch() : undefined,
  rateLimiter: process.env.AI_LOCAL_RATE_LIMIT === '1' ? limiter : null,
  // The mock server has no mail provider. Treat a missing cookie as a local
  // developer so `AI_MOCK=1` still answers. Production Pages does not do this.
  sessionOf: async (request, requestEnv) => {
    const session = await auth.readSession(request, requestEnv);
    if (session) return session;
    return mock ? { email: 'dev@localhost' } : null;
  },
});

async function localMe(context) {
  if (!mock) return auth.me(context);
  const session = await auth.readSession(context.request, context.env);
  if (session) return auth.me(context);
  return new Response(JSON.stringify({ email: 'dev@localhost', remaining: null }), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

const routes = new Map([
  ['POST /api/ai/layout', (context) => handleLayoutRequest(context)],
  ['POST /api/auth/request-code', (context) => auth.requestCode(context)],
  ['POST /api/auth/verify', (context) => auth.verify(context)],
  ['GET /api/auth/me', (context) => localMe(context)],
  ['POST /api/auth/logout', (context) => auth.logout(context)],
]);

function writeResponse(res, response) {
  const headers = {};
  response.headers.forEach((value, key) => {
    if (key === 'set-cookie') return;
    headers[key] = value;
  });
  const cookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
  if (cookies.length === 1) headers['set-cookie'] = cookies[0];
  else if (cookies.length > 1) headers['set-cookie'] = cookies;
  res.writeHead(response.status, headers);
  return response.arrayBuffer().then(body => res.end(Buffer.from(body)));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const headers = { 'CF-Connecting-IP': req.socket.remoteAddress || 'local' };
  if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];
  if (req.headers.cookie) headers.cookie = req.headers.cookie;
  if (req.headers.origin) headers.Origin = req.headers.origin;
  if (req.headers.accept) headers.Accept = req.headers.accept;
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS';
  const request = new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? Buffer.concat(chunks) : undefined,
  });
  // Loopback is the Vite proxy (127.0.0.1:5173 calling this port). Production
  // Pages does not allow that; see functions/api/_middleware.js.
  const response = await guardApiRequest(request, () => {
    const handler = routes.get(`${req.method} ${url.pathname}`);
    if (!handler) {
      return new Response(JSON.stringify({ error: 'not_found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    }
    return handler({ request, env });
  }, { allowLoopback: true });
  await writeResponse(res, response);
});

server.listen(port, () => {
  const mode = mock ? 'mock answers' : env.DEEPSEEK_API_KEY ? 'DeepSeek' : 'no key: AI answers 503';
  console.log(`DeskLab AI dev server on http://localhost:${port}/api/ai/layout (${mode})`);
});
