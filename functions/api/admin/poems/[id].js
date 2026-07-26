import { jsonResponse, errorResponse, requireAdmin } from '../../../_lib/helpers.js';

export async function onRequestDelete(context) {
  const { request, env, params } = context;
  const { error } = await requireAdmin(request, env);
  if (error) return error;
  const poemId = params.id;

  const result = await env.escandidor_db.prepare('DELETE FROM poems WHERE id = ?').bind(poemId).run();
  if (!result.meta || result.meta.changes === 0) {
    return errorResponse('Poema no encontrado.', 404);
  }
  return jsonResponse({ ok: true });
}
