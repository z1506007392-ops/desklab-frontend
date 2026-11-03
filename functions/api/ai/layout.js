// Cloudflare Pages Function: POST /api/ai/layout. The logic lives in
// server/ai/ so it can be tested and run locally (tools/dev-api-server.mjs).
import { createAuthHandlers } from '../../../server/ai/auth.js';
import { createLayoutHandler } from '../../../server/ai/layout-handler.js';
import { createRateLimiter } from '../../../server/ai/rate-limit.js';

// Module scope: without AI_LIMITS this instance counts in memory. The KV
// binding shares sessions and counts; see server/ai/rate-limit.js.
const auth = createAuthHandlers();
const handleLayoutRequest = createLayoutHandler({
  rateLimiter: createRateLimiter(),
  sessionOf: (request, env) => auth.readSession(request, env),
});

export const onRequestPost = context => handleLayoutRequest(context);
