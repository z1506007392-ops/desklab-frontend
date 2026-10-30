// The shape of AI layout suggestions, shared by the Cloudflare function that
// talks to DeepSeek (server/ai/) and the browser that checks and applies the
// suggestions. This is only a structural filter: the browser still validates
// every action against the rule engine before showing anything.
export const AI_PROTOCOL_VERSION = 1;

export const AI_LIMITS = Object.freeze({
  maxRequestBytes: 64 * 1024,
  maxGoalChars: 200,
  maxSuggestions: 5,
  maxActionsPerSuggestion: 6,
  maxTitleChars: 40,
  maxReasonChars: 200,
  maxIdChars: 100,
});

export const SUGGESTION_CATEGORIES = Object.freeze(['ergonomics', 'tidiness', 'safety', 'space', 'cabling']);

// Allowed action types and their fields: 'string' ids or finite 'number's.
// Fields marked optional may be left out (move without z drops onto support).
export const ACTION_FIELDS = Object.freeze({
  move: { objectId: 'string', x: 'number', y: 'number', z: 'number?' },
  rotate: { objectId: 'string', rotationZ: 'number' },
  swap: { objectIdA: 'string', objectIdB: 'string' },
  connect: { fromObjectId: 'string', fromPortId: 'string', toObjectId: 'string', toPortId: 'string' },
  disconnect: { connectionId: 'string' },
  set_cable_length: { connectionId: 'string', length: 'number' },
});

function cleanText(value, maxChars) {
  if (typeof value !== 'string') return '';
  // Drop control characters, collapse whitespace, cap the length.
  const printable = Array.from(value, char => {
    const code = char.charCodeAt(0);
    return code < 32 || code === 127 ? ' ' : char;
  }).join('');
  return printable.replace(/\s+/g, ' ').trim().slice(0, maxChars);
}

export function sanitizeAction(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const fields = ACTION_FIELDS[raw.type];
  if (!fields) return null;
  const action = { type: raw.type };
  for (const [name, kind] of Object.entries(fields)) {
    const value = raw[name];
    const optional = kind.endsWith('?');
    if (value === undefined || value === null) {
      if (optional) continue;
      return null;
    }
    if (kind.startsWith('string')) {
      if (typeof value !== 'string' || value.length === 0 || value.length > AI_LIMITS.maxIdChars) return null;
    } else if (typeof value !== 'number' || !Number.isFinite(value)) {
      return null;
    }
    action[name] = value;
  }
  return action;
}

/**
 * Keep only well-formed suggestions: known action types with typed fields,
 * plain text capped in length, at most maxSuggestions with at least one
 * action each. Anything else is dropped silently.
 */
export function sanitizeSuggestions(raw) {
  const list = Array.isArray(raw?.suggestions) ? raw.suggestions : [];
  const suggestions = [];
  for (const item of list) {
    if (suggestions.length >= AI_LIMITS.maxSuggestions) break;
    if (!item || typeof item !== 'object') continue;
    const title = cleanText(item.title, AI_LIMITS.maxTitleChars);
    const reason = cleanText(item.reason, AI_LIMITS.maxReasonChars);
    if (!title || !reason) continue;
    const actions = (Array.isArray(item.actions) ? item.actions : [])
      .slice(0, AI_LIMITS.maxActionsPerSuggestion)
      .map(sanitizeAction);
    // One malformed action spoils the suggestion: partial changes could
    // leave the layout half-moved.
    if (actions.length === 0 || actions.some(action => action === null)) continue;
    suggestions.push({
      id: cleanText(item.id, 40) || `s${suggestions.length + 1}`,
      title,
      reason,
      category: SUGGESTION_CATEGORIES.includes(item.category) ? item.category : 'space',
      actions,
    });
  }
  return suggestions;
}
