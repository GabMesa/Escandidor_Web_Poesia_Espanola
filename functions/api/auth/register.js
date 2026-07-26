import {
  jsonResponse,
  errorResponse,
  safeJson,
  hashPassword,
  createSession,
  setSessionCookie,
  isValidEmail,
  publicUser,
  isSecureRequest,
} from '../../_lib/helpers.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const secure = isSecureRequest(request);
  const body = await safeJson(request);

  const username = (body.username || '').trim();
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';

  if (username.length < 3 || username.length > 40) {
    return errorResponse('El usuario debe tener entre 3 y 40 caracteres.');
  }
  if (!isValidEmail(email)) {
    return errorResponse('Correo electronico invalido.');
  }
  if (password.length < 8) {
    return errorResponse('La contrasena debe tener al menos 8 caracteres.');
  }

  const existing = await env.escandidor_db
    .prepare('SELECT id FROM users WHERE username = ? OR email = ?')
    .bind(username, email)
    .first();
  if (existing) {
    return errorResponse('Ya existe una cuenta con ese usuario o correo.', 409);
  }

  const { hash, salt } = await hashPassword(password);

  // El primer usuario registrado en la base queda como admin automaticamente.
  const countRow = await env.escandidor_db.prepare('SELECT COUNT(*) as c FROM users').first();
  const role = countRow && countRow.c === 0 ? 'admin' : 'user';

  const inserted = await env.escandidor_db
    .prepare(
      `INSERT INTO users (username, email, password_hash, password_salt, role)
       VALUES (?, ?, ?, ?, ?) RETURNING *`
    )
    .bind(username, email, hash, salt, role)
    .first();

  const token = await createSession(env, inserted.id);
  const headers = new Headers();
  setSessionCookie(headers, token, secure);
  return jsonResponse({ ok: true, user: publicUser(inserted) }, { headers });
}
