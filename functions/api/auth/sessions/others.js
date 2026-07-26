import {
  jsonResponse,
  parseCookies,
  requireUser,
  SESSION_COOKIE_NAME,
} from '../../../_lib/helpers.js';

export async function onRequestDelete({ request, env }) {
  const { user, error } = await requireUser(request, env);
  if (error) return error;

  const token = parseCookies(request)[SESSION_COOKIE_NAME] || '';
  const result = await env.escandidor_db
    .prepare('DELETE FROM sessions WHERE user_id = ? AND token <> ?')
    .bind(user.id, token)
    .run();

  return jsonResponse({ ok: true, revoked: Number(result.meta?.changes) || 0 });
}
