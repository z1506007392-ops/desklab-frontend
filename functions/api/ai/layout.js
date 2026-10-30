// Cloudflare Pages Function: POST /api/ai/layout. The logic lives in
// server/ai/ so it can be tested and run locally (tools/dev-api-server.mjs).
import { createLayoutHandler } from '../../../server/ai/layout-handler.js';
import { createRateLimiter } from '../../../server/ai/rate-limit.js';

// Module scope: the in-memory limiter keeps its counts for the life of the
// server instance; a KV binding named AI_LIMITS makes them shared.
const handleLayoutRequest = createLayoutHandler({ rateLimiter: createRateLimiter() });

export const onRequestPost = context => handleLayoutRequest(context);
