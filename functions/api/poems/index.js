import { jsonResponse, safeJson, requireUser, serializePoem } from '../../_lib/helpers.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const { user, error } = await requireUser(request, env);
  if (error) return error;

  const { results } = await env.escandidor_db
    .prepare('SELECT * FROM current_poems WHERE user_id = ? ORDER BY updated_at DESC')
    .bind(user.id)
    .all();

  return jsonResponse({ ok: true, poems: results.map(serializePoem) });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const { user, error } = await requireUser(request, env);
  if (error) return error;

  const body = await safeJson(request);
  const title = (body.title || 'Sin titulo').trim().slice(0, 200);
  const versionName = (body.versionName || 'v1').trim().slice(0, 60);
  const content = typeof body.content === 'string' ? body.content : '';
  const settings = body.settings && typeof body.settings === 'object' ? body.settings : {};
  const colorIndex = Number.isInteger(body.colorIndex) ? body.colorIndex : null;

  const poem = await env.escandidor_db
    .prepare(
      `INSERT INTO poems (user_id, name, configurations, color_index)
       VALUES (?, ?, ?, ?) RETURNING id`
    )
    .bind(user.id, title, JSON.stringify(settings), colorIndex)
    .first();

  await env.escandidor_db
    .prepare(
      `INSERT INTO poem_versions (poem_id, name, content, version)
       VALUES (?, ?, ?, 1)`
    )
    .bind(poem.id, versionName, content)
    .run();

  const row = await env.escandidor_db
    .prepare('SELECT * FROM current_poems WHERE id = ?')
    .bind(poem.id)
    .first();

  return jsonResponse({ ok: true, poem: serializePoem(row) }, { status: 201 });
}
