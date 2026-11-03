import { apiUrl } from './api-base.js';
import { AI_ERROR_MESSAGES, AI_PROTOCOL_VERSION, sanitizeSuggestions } from './ai-protocol.js';

export const AI_REQUEST_TIMEOUT_MS = 45000;

function aiError(code, message = AI_ERROR_MESSAGES[code]) {
  const error = new Error(message || 'AI 暂时不可用，请稍后再试');
  error.code = code;
  return error;
}

// Infinity, NaN, and a negative count are not a number of tries left.
function dailyRemaining(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * Ask /api/ai/layout for suggestions. Resolves to { suggestions, model };
 * rejects with an Error whose message is a Chinese sentence for the user and
 * whose code is the server's error code, 'network_error', 'ai_timeout', or
 * 'cancelled' (the caller's signal aborted; show nothing).
 * The suggestions are only structurally checked; the caller must still
 * validate them against the project before showing them.
 */
export async function requestLayoutSuggestions({
  summary,
  goal = '',
  followUp = null,
  signal,
  fetchImpl = (...args) => fetch(...args),
  timeoutMs = AI_REQUEST_TIMEOUT_MS,
} = {}) {
  if (signal?.aborted) throw aiError('cancelled', '已取消');
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  const onCallerAbort = () => controller.abort();
  signal?.addEventListener?.('abort', onCallerAbort);

  try {
    let response;
    try {
      response = await fetchImpl(apiUrl('/api/ai/layout'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(followUp
          ? { version: AI_PROTOCOL_VERSION, summary, goal, followUp }
          : { version: AI_PROTOCOL_VERSION, summary, goal }),
        signal: controller.signal,
      });
    } catch {
      if (timedOut) throw aiError('ai_timeout');
      if (controller.signal.aborted) throw aiError('cancelled', '已取消');
      throw aiError('network_error', '网络连接失败，请检查网络后再试');
    }

    let body = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    if (!response.ok) {
      const code = typeof body?.error === 'string' ? body.error : 'ai_upstream_error';
      const message = typeof body?.message === 'string' && body.message ? body.message : AI_ERROR_MESSAGES[code];
      const error = aiError(code, message);
      const remaining = dailyRemaining(body?.remaining);
      if (remaining !== null) error.remaining = remaining;
      throw error;
    }
    if (!body || !Array.isArray(body.suggestions)) throw aiError('ai_bad_output');
    return {
      suggestions: sanitizeSuggestions(body),
      model: typeof body.model === 'string' ? body.model : null,
      remaining: dailyRemaining(body.remaining),
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.('abort', onCallerAbort);
  }
}
