// Browser calls for the email-code login. The desk itself never goes through here.

async function readBody(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function failure(body, fallback) {
  const error = new Error(typeof body?.message === 'string' && body.message ? body.message : fallback);
  error.code = typeof body?.error === 'string' ? body.error : 'network_error';
  return error;
}

export async function fetchCurrentSession(fetchImpl = (...args) => fetch(...args)) {
  try {
    const response = await fetchImpl('/api/auth/me', {
      credentials: 'include',
      headers: { accept: 'application/json' },
    });
    const body = await readBody(response);
    if (!response.ok || typeof body?.email !== 'string' || !body.email) return { email: null, remaining: null };
    return { email: body.email, remaining: typeof body.remaining === 'number' ? body.remaining : null };
  } catch {
    return { email: null, remaining: null, offline: true };
  }
}

async function postJson(path, payload, fetchImpl, fallback = '登录没有完成，请稍后再试') {
  let response;
  try {
    response = await fetchImpl(path, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw failure(null, '网络连接失败，请检查网络后再试');
  }
  const body = await readBody(response);
  if (!response.ok || !body || typeof body !== 'object' || Array.isArray(body)) throw failure(body, fallback);
  return body;
}

export function requestLoginCode({ email, fetchImpl = (...args) => fetch(...args) }) {
  return postJson('/api/auth/request-code', { email }, fetchImpl);
}

export async function verifyLoginCode({ email, code, fetchImpl = (...args) => fetch(...args) }) {
  const body = await postJson('/api/auth/verify', { email, code }, fetchImpl);
  return {
    email: typeof body?.email === 'string' ? body.email : email,
    remaining: typeof body?.remaining === 'number' ? body.remaining : null,
  };
}

export function logoutSession(fetchImpl = (...args) => fetch(...args)) {
  return postJson('/api/auth/logout', {}, fetchImpl, '退出没有完成，请再试一次');
}
