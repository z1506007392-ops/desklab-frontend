import { AI_ERROR_MESSAGES, AI_LIMITS, AI_PROTOCOL_VERSION, sanitizeSuggestions } from '../../src/domain/ai-protocol.js';
import { clientAddress, isJsonContentType, layoutInputProblem, publicModelName } from './layout-input.js';
import { buildMessages } from './prompt.js';

// POST /api/ai/layout: scene summary + optional goal in, structurally clean
// layout suggestions out. The DeepSeek key lives only in the environment
// (Cloudflare secret or local env) and never appears in a response or log.
// See docs/AUTONOMOUS_ROADMAP.md §6.3 for the contract.
const DEFAULTS = Object.freeze({
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  timeoutMs: 40000,
  maxTokens: 2000,
});

function json(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  });
}

function fail(status, error, headers, message = AI_ERROR_MESSAGES[error], extra = {}) {
  return json(status, { error, message, ...extra }, headers);
}

// An optional follow-up: the suggestions the user saw last time (filtered
// like any answer, so the client cannot smuggle text into the assistant turn)
// and what the user said about them.
function readFollowUp(followUp) {
  if (!followUp || typeof followUp !== 'object' || Array.isArray(followUp)) return null;
  return {
    previousSuggestions: sanitizeSuggestions({ suggestions: followUp.previousSuggestions }),
    feedback: followUp.feedback,
  };
}

function readConfig(env = {}) {
  const timeout = Number(env.AI_TIMEOUT_MS);
  return {
    enabled: String(env.AI_ENABLED ?? 'true').toLowerCase() !== 'false',
    apiKey: typeof env.DEEPSEEK_API_KEY === 'string' ? env.DEEPSEEK_API_KEY.trim() : '',
    baseUrl: (env.DEEPSEEK_BASE_URL || DEFAULTS.baseUrl).replace(/\/+$/, ''),
    model: env.DEEPSEEK_MODEL || DEFAULTS.model,
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULTS.timeoutMs,
  };
}

async function readJsonBody(request) {
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > AI_LIMITS.maxRequestBytes) return { tooLarge: true };
  try {
    return { body: JSON.parse(text) };
  } catch {
    return { body: null };
  }
}

/**
 * @param {object} options
 * @param {typeof fetch} [options.fetchImpl] how to reach DeepSeek (tests pass a fake)
 * @param {{ take(key: string, env: object): Promise<{ allowed: boolean, mode: string }>, takeUser?: Function, readUser?: Function }} [options.rateLimiter]
 * @param {{ log(...args: unknown[]): void }} [options.logger]
 * @param {(request: Request, env: object) => Promise<{ email: string } | null>} [options.sessionOf]
 */
export function createLayoutHandler({
  fetchImpl = (...args) => fetch(...args),
  rateLimiter = null,
  logger = console,
  sessionOf = async () => null,
} = {}) {
  return async function handleLayoutRequest(context) {
    try {
      return await handleLayout(context);
    } catch (error) {
      // Name only. The message can quote a key, a stack, or the request.
      logger.log('ai/layout failed', error instanceof Error ? error.name : 'error');
      return fail(500, 'internal');
    }
  };

  async function handleLayout({ request, env }) {
    const config = readConfig(env);
    if (!config.enabled || !config.apiKey) return fail(503, 'ai_unavailable');

    const session = await sessionOf(request, env);
    if (typeof session?.email !== 'string' || session.email.length > 254 || !session.email.includes('@')) {
      return fail(401, 'auth_required');
    }

    if (!isJsonContentType(request.headers.get('content-type'))) return fail(400, 'bad_request');
    const { body, tooLarge } = await readJsonBody(request);
    if (tooLarge) return fail(413, 'too_large');
    if (!body || typeof body !== 'object' || Array.isArray(body) || layoutInputProblem(body)
      || body.version !== AI_PROTOCOL_VERSION
      || !body.summary || typeof body.summary !== 'object' || Array.isArray(body.summary)) {
      return fail(400, 'bad_request');
    }

    let limitHeaders = {};
    let remaining = null;
    if (rateLimiter) {
      const ip = clientAddress(request.headers.get('CF-Connecting-IP'));
      const limit = await rateLimiter.take(ip, env);
      limitHeaders = { 'X-AI-Limit-Mode': limit.mode };
      if (!limit.allowed) {
        if (rateLimiter.readUser) remaining = (await rateLimiter.readUser(session.email, env)).remaining;
        return fail(429, 'ai_rate_limited', limitHeaders, AI_ERROR_MESSAGES.ai_rate_limited_hour, { remaining });
      }
      if (rateLimiter.takeUser) {
        const userLimit = await rateLimiter.takeUser(session.email, env);
        remaining = userLimit.remaining;
        limitHeaders = { 'X-AI-Limit-Mode': userLimit.mode };
        if (!userLimit.allowed) {
          return fail(429, 'ai_rate_limited', limitHeaders, AI_ERROR_MESSAGES.ai_rate_limited, { remaining });
        }
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    const started = Date.now();
    let upstream;
    try {
      upstream = await fetchImpl(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({
          model: config.model,
          messages: buildMessages(body.summary, body.goal, readFollowUp(body.followUp)),
          response_format: { type: 'json_object' },
          temperature: 0.3,
          max_tokens: DEFAULTS.maxTokens,
          stream: false,
        }),
        signal: controller.signal,
      });
    } catch {
      clearTimeout(timer);
      const timedOut = controller.signal.aborted;
      logger.log('ai/layout upstream', timedOut ? 'timeout' : 'network error', `${Date.now() - started}ms`);
      // The daily allowance was already spent. Tell the browser, or the
      // "今日剩余" count stays a step behind until the next visit.
      return timedOut
        ? fail(504, 'ai_timeout', limitHeaders, undefined, { remaining })
        : fail(502, 'ai_upstream_error', limitHeaders, undefined, { remaining });
    }
    clearTimeout(timer);

    if (!upstream.ok) {
      logger.log('ai/layout upstream status', upstream.status, `${Date.now() - started}ms`);
      return fail(502, 'ai_upstream_error', limitHeaders, undefined, { remaining });
    }

    let completion;
    try {
      completion = await upstream.json();
    } catch {
      return fail(502, 'ai_bad_output', limitHeaders, undefined, { remaining });
    }
    const content = completion?.choices?.[0]?.message?.content;
    let parsed;
    try {
      parsed = typeof content === 'string' && content.trim() ? JSON.parse(content) : null;
    } catch {
      parsed = null;
    }
    if (!parsed || !Array.isArray(parsed.suggestions)) return fail(502, 'ai_bad_output', limitHeaders, undefined, { remaining });

    const usage = completion.usage || {};
    logger.log('ai/layout ok', `${Date.now() - started}ms`, 'tokens', usage.prompt_tokens, usage.completion_tokens);
    return json(200, {
      version: AI_PROTOCOL_VERSION,
      model: publicModelName(completion.model, config.model),
      suggestions: sanitizeSuggestions(parsed),
      usage: {
        promptTokens: Number.isFinite(usage.prompt_tokens) ? usage.prompt_tokens : null,
        completionTokens: Number.isFinite(usage.completion_tokens) ? usage.completion_tokens : null,
      },
      remaining,
    }, limitHeaders);
  };
}
