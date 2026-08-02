import {
  jsonResponse,
  errorResponse,
  safeJson,
  requireAdmin,
  publicUser,
} from '../../../_lib/helpers.js';

export async function onRequestPatch(context) {
  const { request, env, params } = context;
  const { user: adminUser, error } = await requireAdmin(request, env);
  if (error) return error;
  const targetId = params.id;

  const body = await safeJson(request);
  const target = await env.escandidor_db.prepare('SELECT * FROM users WHERE id = ?').bind(targetId).first();
  if (!target) return errorResponse('Usuario no encontrado.', 404);

  if (target.id === adminUser.id && body.role && body.role !== 'admin') {
    return errorResponse('No puedes quitarte a ti mismo el rol de administrador.', 400);
  }

  const role = body.role === 'admin' || body.role === 'user' ? body.role : target.role;
  const status = body.status === 'active' || body.status === 'disabled' ? body.status : target.status;

  const row = await env.escandidor_db
    .prepare(
      `UPDATE users SET role = ?, status = ?, updated_at = datetime('now') WHERE id = ? RETURNING *`
    )
    .bind(role, status, targetId)
    .first();

  if (status === 'disabled') {
    await env.escandidor_db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(targetId).run();
  }

  if (typeof body.paying === 'boolean') {
    if (body.paying) {
      await env.escandidor_db
        .prepare(
          `INSERT INTO supporters
            (user_id, provider, provider_supporter_id, support_type, status, personalized_message)
           VALUES (?, 'admin', ?, 'membership', 'active', ?)
           ON CONFLICT(provider, provider_supporter_id) DO UPDATE SET
             user_id = excluded.user_id, status = 'active',
             personalized_message = COALESCE(excluded.personalized_message, supporters.personalized_message),
             updated_at = datetime('now')`
        )
        .bind(target.id, `user:${target.id}`, String(body.personalizedMessage || '').trim().slice(0, 180) || null)
        .run();
    } else {
      await env.escandidor_db
        .prepare("UPDATE supporters SET status = 'inactive', updated_at = datetime('now') WHERE user_id = ?")
        .bind(target.id)
        .run();
    }
  }

  return jsonResponse({ ok: true, user: publicUser(row) });
}

export async function onRequestDelete(context) {
  const { request, env, params } = context;
  const { user: adminUser, error } = await requireAdmin(request, env);
  if (error) return error;
  const targetId = params.id;

  if (Number(targetId) === adminUser.id) {
    return errorResponse('No puedes borrar tu propia cuenta desde aqui.', 400);
  }

  const result = await env.escandidor_db.prepare('DELETE FROM users WHERE id = ?').bind(targetId).run();
  if (!result.meta || result.meta.changes === 0) {
    return errorResponse('Usuario no encontrado.', 404);
  }
  return jsonResponse({ ok: true });
}
