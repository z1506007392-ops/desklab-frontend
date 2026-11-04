// Resend Email API. Pages Functions post over HTTPS; the key stays in the environment.
// https://resend.com/docs/api-reference/emails/send-email
export const RESEND_URL = 'https://api.resend.com/emails';

export function resendFrom(from, fromName) {
  const name = typeof fromName === 'string' ? fromName.trim() : '';
  return name ? `${name} <${from}>` : from;
}

/**
 * @returns {Promise<{ ok: true } | { ok: false, reason: 'upstream' }>}
 */
export async function postResend({ fetchImpl, apiKey, from, fromName, to, subject, text }) {
  const response = await fetchImpl(RESEND_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      from: resendFrom(from, fromName),
      to: [to],
      subject,
      text,
    }),
  });
  if (!response.ok) return { ok: false, reason: 'upstream' };
  return { ok: true };
}
