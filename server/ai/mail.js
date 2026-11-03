// Login codes go out through Mailjet or Brevo. The keys stay in the environment.
// Mailjet wins when both of its keys are set; otherwise Brevo; otherwise the
// login route says it is not open yet.
import { postMailjet } from './mailjet.js';

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
const SUBJECT = 'DeskLab 登录验证码';

function trimmed(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function mailConfig(env = {}) {
  const mailjetKey = trimmed(env.MAILJET_API_KEY);
  const mailjetSecret = trimmed(env.MAILJET_API_SECRET);
  const brevoKey = trimmed(env.BREVO_API_KEY);
  const from = trimmed(env.MAIL_FROM);
  const fromName = trimmed(env.MAIL_FROM_NAME) || 'DeskLab';
  const mailjetPair = Boolean(mailjetKey && mailjetSecret);
  const mailjetPartial = Boolean(mailjetKey || mailjetSecret) && !mailjetPair;
  const provider = (mailjetPair || mailjetPartial) ? 'mailjet' : (brevoKey ? 'brevo' : null);
  return {
    provider,
    from,
    fromName,
    configured: Boolean(provider && from) && !mailjetPartial,
    apiKey: provider === 'mailjet' ? mailjetKey : brevoKey,
    apiSecret: provider === 'mailjet' ? mailjetSecret : '',
  };
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
  const text = loginCodeMessage(code);
  try {
    if (config.provider === 'mailjet') {
      return await postMailjet({
        fetchImpl,
        apiKey: config.apiKey,
        apiSecret: config.apiSecret,
        from: config.from,
        fromName: config.fromName,
        to,
        subject: SUBJECT,
        text,
      });
    }
    const response = await fetchImpl(BREVO_URL, {
      method: 'POST',
      headers: {
        'api-key': config.apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: config.fromName, email: config.from },
        to: [{ email: to }],
        subject: SUBJECT,
        textContent: text,
      }),
    });
    if (!response.ok) return { ok: false, reason: 'upstream' };
    return { ok: true };
  } catch {
    return { ok: false, reason: 'upstream' };
  }
}
