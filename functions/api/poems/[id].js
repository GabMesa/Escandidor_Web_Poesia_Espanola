import {
  jsonResponse,
  errorResponse,
  safeJson,
  requireUser,
  serializePoem,
  normalizeFontFamily,
} from '../../_lib/helpers.js';

async function archiveDeletedVersions(env, userId, poem, versions, poemId = null) {
  await env.escandidor_db
    .prepare(
      `INSERT INTO deleted_poems (user_id, poem_id, title, versions_json, deleted_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id, poem_id) WHERE poem_id IS NOT NULL DO UPDATE SET
         title = excluded.title,
         versions_json = excluded.versions_json,
         deleted_at = excluded.deleted_at`
    )
    .bind(userId, poemId, poem.name, JSON.stringify(versions.map((row) => ({
      sourcePoemId: Number(poem.id),
      version: row.version,
      versionName: row.name,
      content: row.content,
      createdAt: row.created_at,
      settings: JSON.parse(poem.configurations || '{}'),
      colorIndex: poem.color_index,
    }))))
    .run();
  await env.escandidor_db
    .prepare(
      `UPDATE deleted_poems SET versions_json = '[]'
       WHERE user_id = ? AND poem_id IS NOT NULL AND id NOT IN (
         SELECT id FROM deleted_poems
         WHERE user_id = ? AND versions_json <> '[]'
         ORDER BY deleted_at DESC, id DESC LIMIT 10
       )`
    )
    .bind(userId, userId)
    .run();
  await env.escandidor_db
    .prepare(
      `DELETE FROM deleted_poems
       WHERE user_id = ? AND poem_id IS NULL AND id NOT IN (
         SELECT id FROM deleted_poems
         WHERE user_id = ? AND versions_json <> '[]'
         ORDER BY deleted_at DESC, id DESC LIMIT 10
       )`
    )
    .bind(userId, userId)
    .run();
}

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
  const settingsObject = body.settings !== undefined
    ? body.settings
    : JSON.parse(existing.settings_json || '{}');
  const fontFamily = normalizeFontFamily(body.fontFamily ?? settingsObject.poemFont ?? existing.font_family);
  settingsObject.poemFont = fontFamily;
  const settings = JSON.stringify(settingsObject);
  const colorIndex = body.colorIndex !== undefined ? body.colorIndex : existing.color_index;

  await env.escandidor_db
    .prepare(
      `UPDATE poems SET name = ?, configurations = ?, font_family = ?, color_index = ?, updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`
    )
    .bind(title, settings, fontFamily, colorIndex, poemId, user.id)
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

  let version = Number(new URL(request.url).searchParams.get('version'));
  if (!Number.isInteger(version) || version <= 0) {
    const body = await safeJson(request);
    const versionName = String(body.versionName ?? '').trim();
    const content = String(body.content ?? '');
    if (versionName) {
      const matched = await env.escandidor_db
        .prepare(
          `SELECT pv.version FROM poem_versions pv
           JOIN poems p ON p.id = pv.poem_id
           WHERE pv.poem_id = ? AND p.user_id = ? AND pv.name = ? AND pv.content = ?
           ORDER BY pv.version DESC LIMIT 1`
        )
        .bind(poemId, user.id, versionName, content)
        .first();
      version = Number(matched?.version);
    }
  }
  if (Number.isInteger(version) && version > 0) {
    const ownedPoem = await env.escandidor_db
      .prepare('SELECT * FROM poems WHERE id = ? AND user_id = ?')
      .bind(poemId, user.id)
      .first();
    if (!ownedPoem) return errorResponse('Poema no encontrado.', 404);

    const deletedVersion = await env.escandidor_db
      .prepare('SELECT * FROM poem_versions WHERE poem_id = ? AND version = ?')
      .bind(poemId, version)
      .first();
    if (!deletedVersion) return errorResponse('Versión no encontrada.', 404);
    const versionCount = await env.escandidor_db
      .prepare('SELECT COUNT(*) AS count FROM poem_versions WHERE poem_id = ?')
      .bind(poemId)
      .first();
    const deletesWholePoem = Number(versionCount?.count) === 1;
    await archiveDeletedVersions(
      env,
      user.id,
      ownedPoem,
      [deletedVersion],
      deletesWholePoem ? Number(poemId) : null,
    );

    const result = await env.escandidor_db
      .prepare('DELETE FROM poem_versions WHERE poem_id = ? AND version = ?')
      .bind(poemId, version)
      .run();
    if (!result.meta || result.meta.changes === 0) {
      return errorResponse('Versión no encontrada.', 404);
    }

    const latest = await env.escandidor_db
      .prepare('SELECT * FROM current_poems WHERE id = ? AND user_id = ?')
      .bind(poemId, user.id)
      .first();
    if (!latest) {
      await env.escandidor_db.prepare('DELETE FROM poems WHERE id = ? AND user_id = ?')
        .bind(poemId, user.id).run();
    }
    return jsonResponse({ ok: true, poem: serializePoem(latest) });
  }

  const poem = await env.escandidor_db
    .prepare('SELECT * FROM poems WHERE id = ? AND user_id = ?')
    .bind(poemId, user.id)
    .first();
  if (!poem) return errorResponse('Poema no encontrado.', 404);
  const { results: versions } = await env.escandidor_db
    .prepare('SELECT * FROM poem_versions WHERE poem_id = ? ORDER BY version ASC')
    .bind(poemId)
    .all();
  await archiveDeletedVersions(env, user.id, poem, versions, Number(poemId));

  const result = await env.escandidor_db
    .prepare('DELETE FROM poems WHERE id = ? AND user_id = ?')
    .bind(poemId, user.id)
    .run();
  if (!result.meta || result.meta.changes === 0) {
    return errorResponse('Poema no encontrado.', 404);
  }
  return jsonResponse({ ok: true });
}
