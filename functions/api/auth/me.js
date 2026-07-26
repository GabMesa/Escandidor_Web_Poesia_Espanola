import {
  jsonResponse,
  getSessionUser,
  parseCookies,
  publicUser,
  countOtherSessions,
  SESSION_COOKIE_NAME,
} from '../../_lib/helpers.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const user = await getSessionUser(request, env);
  const token = parseCookies(request)[SESSION_COOKIE_NAME] || '';
  const otherSessions = user ? await countOtherSessions(env, user.id, token) : 0;
  return jsonResponse({ ok: true, user: publicUser(user), otherSessions });
}
