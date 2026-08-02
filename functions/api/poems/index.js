import {
  jsonResponse, errorResponse, safeJson, requireUser, serializePoem, normalizeFontFamily,
} from '../../_lib/helpers.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const { user, error } = await requireUser(request, env);
  if (error) return error;

  const { results } = await env.escandidor_db
    .prepare(
      `SELECT p.id, p.name AS title, p.configurations AS settings_json, p.font_family, p.color_index,
              p.created_at, p.updated_at, pv.name AS version_name, pv.content,
              pv.version, pv.created_at AS version_created_at
       FROM poems p JOIN poem_versions pv ON pv.poem_id = p.id
       WHERE p.user_id = ?
         AND NOT EXISTS (
           SELECT 1 FROM deleted_poems dp
           WHERE dp.user_id = p.user_id AND dp.poem_id = p.id
         )
       ORDER BY p.updated_at DESC, pv.version ASC`
    )
    .bind(user.id)
    .all();

  const poemsById = new Map();
  for (const row of results) {
    let poem = poemsById.get(row.id);
    if (!poem) {
      poem = { ...serializePoem(row), versions: [] };
      poemsById.set(row.id, poem);
    }
    poem.versions.push({
      version: row.version,
      versionName: row.version_name,
      content: row.content,
      createdAt: row.version_created_at,
    });
    poem.version = row.version;
    poem.versionName = row.version_name;
    poem.content = row.content;
  }

  return jsonResponse({ ok: true, poems: [...poemsById.values()] });
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
  const fontFamily = normalizeFontFamily(body.fontFamily ?? settings.poemFont);
  settings.poemFont = fontFamily;
  const colorIndex = Number.isInteger(body.colorIndex) ? body.colorIndex : null;

  const sourcePoemId = Number(body.sourcePoemId);
  const deletion = Number.isInteger(sourcePoemId) && sourcePoemId > 0
    ? await env.escandidor_db
      .prepare('SELECT deleted_at FROM deleted_poems WHERE user_id = ? AND poem_id = ?')
      .bind(user.id, sourcePoemId)
      .first()
    : null;
  if (deletion && body.restoreDeleted !== true) {
    return errorResponse('Este poema fue eliminado. Restáuralo explícitamente para volver a subirlo.', 409, {
      code: 'poem_deleted',
      deletedAt: deletion.deleted_at,
    });
  }
  if (deletion) {
    await env.escandidor_db
      .prepare('DELETE FROM deleted_poems WHERE user_id = ? AND poem_id = ?')
      .bind(user.id, sourcePoemId)
      .run();
  }

  const poem = await env.escandidor_db
    .prepare(
      `INSERT INTO poems (user_id, name, configurations, font_family, color_index)
       VALUES (?, ?, ?, ?, ?) RETURNING id`
    )
     .bind(user.id, title, JSON.stringify(settings), fontFamily, colorIndex)
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
