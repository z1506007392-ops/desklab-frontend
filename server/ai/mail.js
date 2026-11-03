// Login codes go out through Brevo's HTTP API. Swap this module if the
// mail provider changes. The API key stays in the environment.
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

export function mailConfig(env = {}) {
  const apiKey = typeof env.BREVO_API_KEY === 'string' ? env.BREVO_API_KEY.trim() : '';
  const from = typeof env.MAIL_FROM === 'string' ? env.MAIL_FROM.trim() : '';
  const fromName = typeof env.MAIL_FROM_NAME === 'string' && env.MAIL_FROM_NAME.trim()
    ? env.MAIL_FROM_NAME.trim()
    : 'DeskLab';
  return { apiKey, from, fromName, configured: Boolean(apiKey && from) };
}

export function loginCodeMessage(code) {
  return `你的 DeskLab 登录验证码是 ${code}，10 分钟内有效。`;
}

/**
 * @returns {Promise<{ ok: true } | { ok: false, reason: 'unconfigured' | 'upstream' }>}
 */
export async function sendLoginCode({ fetchImpl = (...args) => fetch(...args), env, to, code }) {
  const config = mailConfig(env);
  if (!config.configured) return { ok: false, reason: 'unconfigured' };
  let response;
  try {
    response = await fetchImpl(BREVO_URL, {
      method: 'POST',
      headers: {
        'api-key': config.apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: config.fromName, email: config.from },
        to: [{ email: to }],
        subject: 'DeskLab 登录验证码',
        textContent: loginCodeMessage(code),
      }),
    });
  } catch {
    return { ok: false, reason: 'upstream' };
  }
  if (!response.ok) return { ok: false, reason: 'upstream' };
  return { ok: true };
}
