import { jsonResponse, getSessionUser, publicUser } from '../../_lib/helpers.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const user = await getSessionUser(request, env);
  return jsonResponse({ ok: true, user: publicUser(user) });
}
