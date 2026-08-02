import { errorResponse, jsonResponse, requireAdmin, safeJson } from '../../../_lib/helpers.js';

export async function onRequestPatch({ request, env, params }) {
  const { error } = await requireAdmin(request, env);
  if (error) return error;

  const supporter = await env.escandidor_db
    .prepare('SELECT * FROM supporters WHERE id = ?')
    .bind(params.id)
    .first();
  if (!supporter) return errorResponse('Supporter no encontrado.', 404);

  const body = await safeJson(request);
  const userId = body.userId === undefined
    ? supporter.user_id
    : body.userId === null || body.userId === '' ? null : Number(body.userId);
  if (userId !== null) {
    const user = await env.escandidor_db.prepare('SELECT id FROM users WHERE id = ?').bind(userId).first();
    if (!user) return errorResponse('Usuario no encontrado.', 404);
  }

  const supportType = ['one_time', 'membership'].includes(body.supportType)
    ? body.supportType : supporter.support_type;
  const status = ['supporter', 'active', 'inactive', 'cancelled'].includes(body.status)
    ? body.status : supporter.status;
  const message = String(body.personalizedMessage ?? supporter.personalized_message ?? '').trim().slice(0, 180) || null;

  await env.escandidor_db
    .prepare(
      `UPDATE supporters SET user_id = ?, support_type = ?, status = ?, personalized_message = ?,
       updated_at = datetime('now') WHERE id = ?`
    )
    .bind(userId, supportType, status, message, params.id)
    .run();

  return jsonResponse({ ok: true });
}