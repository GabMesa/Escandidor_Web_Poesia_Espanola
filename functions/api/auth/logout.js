import {
  jsonResponse,
  parseCookies,
  clearSessionCookie,
  isSecureRequest,
  SESSION_COOKIE_NAME,
} from '../../_lib/helpers.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const secure = isSecureRequest(request);
  const cookies = parseCookies(request);
  const token = cookies[SESSION_COOKIE_NAME];

  if (token) {
    await env.escandidor_db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  }

  const headers = new Headers();
  clearSessionCookie(headers, secure);
  return jsonResponse({ ok: true }, { headers });
}
