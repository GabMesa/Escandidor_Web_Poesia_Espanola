import {
  jsonResponse,
  requireUser,
  clearSessionCookie,
  isSecureRequest,
} from '../../_lib/helpers.js';

export async function onRequestDelete({ request, env }) {
  const { user, error } = await requireUser(request, env);
  if (error) return error;

  await env.escandidor_db.prepare('DELETE FROM users WHERE id = ?').bind(user.id).run();

  const headers = new Headers();
  clearSessionCookie(headers, isSecureRequest(request));
  return jsonResponse({ ok: true }, { headers });
}