import {
  jsonResponse,
  errorResponse,
  safeJson,
  requireUser,
  serializePoem,
} from '../../_lib/helpers.js';

export async function onRequestPut(context) {
  const { request, env, params } = context;
  const { user, error } = await requireUser(request, env);
  if (error) return error;
  const poemId = params.id;

  const existing = await env.escandidor_db
    .prepare('SELECT * FROM current_poems WHERE id = ? AND user_id = ?')
    .bind(poemId, user.id)
    .first();
  if (!existing) return errorResponse('Poema no encontrado.', 404);

  const body = await safeJson(request);
  const title = body.title !== undefined ? String(body.title).trim().slice(0, 200) : existing.title;
  const versionName =
    body.versionName !== undefined ? String(body.versionName).trim().slice(0, 60) : existing.version_name;
  const content = body.content !== undefined ? String(body.content) : existing.content;
  const settings =
    body.settings !== undefined ? JSON.stringify(body.settings) : existing.settings_json;
  const colorIndex = body.colorIndex !== undefined ? body.colorIndex : existing.color_index;

  await env.escandidor_db
    .prepare(
      `UPDATE poems SET name = ?, configurations = ?, color_index = ?, updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`
    )
    .bind(title, settings, colorIndex, poemId, user.id)
    .run();

  if (body.versionName !== undefined || body.content !== undefined) {
    await env.escandidor_db
      .prepare(
        `INSERT INTO poem_versions (poem_id, name, content, version)
         VALUES (?, ?, ?, ?)`
      )
      .bind(poemId, versionName, content, existing.version + 1)
      .run();
  }

  const row = await env.escandidor_db
    .prepare('SELECT * FROM current_poems WHERE id = ? AND user_id = ?')
    .bind(poemId, user.id)
    .first();

  return jsonResponse({ ok: true, poem: serializePoem(row) });
}

export async function onRequestDelete(context) {
  const { request, env, params } = context;
  const { user, error } = await requireUser(request, env);
  if (error) return error;
  const poemId = params.id;

  const result = await env.escandidor_db
    .prepare('DELETE FROM poems WHERE id = ? AND user_id = ?')
    .bind(poemId, user.id)
    .run();
  if (!result.meta || result.meta.changes === 0) {
    return errorResponse('Poema no encontrado.', 404);
  }
  return jsonResponse({ ok: true });
}
