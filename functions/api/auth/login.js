import {
  jsonResponse,
  errorResponse,
  safeJson,
  verifyPassword,
  createSession,
  setSessionCookie,
  publicUser,
  isSecureRequest,
} from '../../_lib/helpers.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const secure = isSecureRequest(request);
  const body = await safeJson(request);

  const identifier = (body.email || body.username || '').trim().toLowerCase();
  const password = body.password || '';

  if (!identifier || !password) {
    return errorResponse('Usuario/correo y contrasena son obligatorios.');
  }

  const user = await env.escandidor_db
    .prepare('SELECT * FROM users WHERE email = ? OR username = ?')
    .bind(identifier, identifier)
    .first();

  if (!user) return errorResponse('Credenciales invalidas.', 401);
  if (user.status === 'disabled') return errorResponse('Esta cuenta esta deshabilitada.', 403);
  if (!user.password_hash || !user.password_salt) {
    return errorResponse('Esta cuenta usa Discord. Inicia sesion con Discord.', 401);
  }

  const valid = await verifyPassword(password, user.password_salt, user.password_hash);
  if (!valid) return errorResponse('Credenciales invalidas.', 401);

  const token = await createSession(env, user.id);
  const headers = new Headers();
  setSessionCookie(headers, token, secure);
  return jsonResponse({ ok: true, user: publicUser(user) }, { headers });
}
