// Mailjet Send API v3.1. The API key and secret stay in the environment.
// https://dev.mailjet.com/docs/email-api/send-api-v31/send-basic-email
export const MAILJET_URL = 'https://api.mailjet.com/v3.1/send';

export function mailjetAuthorization(apiKey, apiSecret) {
  return `Basic ${btoa(`${apiKey}:${apiSecret}`)}`;
}

/**
 * @returns {Promise<{ ok: true } | { ok: false, reason: 'upstream' }>}
 */
export async function postMailjet({ fetchImpl, apiKey, apiSecret, from, fromName, to, subject, text }) {
  const response = await fetchImpl(MAILJET_URL, {
    method: 'POST',
    headers: {
      authorization: mailjetAuthorization(apiKey, apiSecret),
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      Messages: [{
        From: { Email: from, Name: fromName },
        To: [{ Email: to }],
        Subject: subject,
        TextPart: text,
      }],
    }),
  });
  if (!response.ok) return { ok: false, reason: 'upstream' };
  let parsed;
  try {
    parsed = await response.json();
  } catch {
    return { ok: false, reason: 'upstream' };
  }
  // A 2xx only means the request was accepted. One message can still fail.
  if (parsed?.Messages?.[0]?.Status !== 'success') return { ok: false, reason: 'upstream' };
  return { ok: true };
}
