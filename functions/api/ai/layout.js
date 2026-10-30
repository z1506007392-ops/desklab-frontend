// Cloudflare Pages Function: POST /api/ai/layout. The logic lives in
// server/ai/ so it can be tested and run locally (tools/dev-api-server.mjs).
import { createLayoutHandler } from '../../../server/ai/layout-handler.js';

const handleLayoutRequest = createLayoutHandler();

export const onRequestPost = context => handleLayoutRequest(context);
