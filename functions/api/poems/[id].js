import { maintainUserTrash } from '../../_lib/trash-storage.js';
import {compressedAliases,compressedVersionConflict} from '../../_lib/poem-compression.js';
import { versionSyncMetadata } from '../../_lib/version-sync.js';
import { poemValidationError, samePoemContent } from '../../../poem-policy.js';
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
  await maintainUserTrash(env, userId);
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
  const title = body.title !== undefined ? (typeof body.title === 'string' ? body.title.trim().slice(0, 200) : '') : existing.title;
  const versionName =
    body.versionName !== undefined ? String(body.versionName).trim().slice(0, 60) : existing.version_name;
  const content = body.content !== undefined ? (typeof body.content === 'string' ? body.content : '') : existing.content;
  const validationError = poemValidationError(title, content);
  if (validationError) return errorResponse(validationError, 400);
  const settingsObject = body.settings !== undefined
    ? body.settings
    : JSON.parse(existing.settings_json || '{}');
  const fontFamily = normalizeFontFamily(body.fontFamily ?? settingsObject.poemFont ?? existing.font_family);
  settingsObject.poemFont = fontFamily;
  const settings = JSON.stringify(settingsObject);
  const colorIndex = body.colorIndex !== undefined ? body.colorIndex : existing.color_index;
  const sync = versionSyncMetadata(body, settingsObject);
  if(sync){
    const alias=(await compressedAliases(env.escandidor_db,user.id,Number(poemId),[{id:sync.id,cloudVersion:body.sync?.cloudVersion}])).get(sync.id);
    if(alias){const conflict=compressedVersionConflict(alias,content,settingsObject);if(conflict)return conflict;return jsonResponse({ok:true,poem:serializePoem(existing),syncedVersion:alias.replacement_version,compressed:true});}
  }

  await env.escandidor_db
    .prepare(
      `UPDATE poems SET name = ?, configurations = ?, font_family = ?, color_index = ?, updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`
    )
    .bind(title, settings, fontFamily, colorIndex, poemId, user.id)
    .run();

  if (sync) {
    await env.escandidor_db.prepare(`INSERT INTO poem_versions (poem_id,name,content,version,client_id,sync_json)
      SELECT ?,?,?,COALESCE(MAX(version),0)+1,?,? FROM (SELECT version FROM poem_versions WHERE poem_id=? UNION ALL SELECT version FROM compressed_poem_versions WHERE poem_id=?) WHERE true
      ON CONFLICT(poem_id,client_id) DO UPDATE SET name=excluded.name,content=excluded.content,sync_json=excluded.sync_json`)
      .bind(poemId,versionName,content,sync.id,JSON.stringify(sync),poemId,poemId).run();
  } else if ((body.versionName !== undefined || body.content !== undefined) && !samePoemContent(content, existing.content)) {
    await env.escandidor_db
      .prepare(
        `INSERT INTO poem_versions (poem_id, name, content, version,client_id,sync_json)
         SELECT ?, ?, ?, COALESCE(MAX(version),0)+1,'cloud-'||?||'-'||(COALESCE(MAX(version),0)+1),? FROM (SELECT version FROM poem_versions WHERE poem_id=? UNION ALL SELECT version FROM compressed_poem_versions WHERE poem_id=?) WHERE true`
      )
      .bind(poemId, versionName, content, poemId,JSON.stringify({settings:settingsObject}),poemId,poemId)
      .run();
  }

  if (!sync && body.versionName !== undefined && samePoemContent(content, existing.content)) {
    await env.escandidor_db.prepare('UPDATE poem_versions SET name = ? WHERE poem_id = ? AND version = ?')
      .bind(versionName, poemId, existing.version).run();
  }
  if (!sync && samePoemContent(content, existing.content)) {
    await env.escandidor_db.prepare("UPDATE poem_versions SET sync_json=json_set(sync_json,'$.settings',json(?)) WHERE poem_id=? AND version=?")
      .bind(settings,poemId,existing.version).run();
  }

  const row = await env.escandidor_db
    .prepare('SELECT * FROM current_poems WHERE id = ? AND user_id = ?')
    .bind(poemId, user.id)
    .first();

  const synced = sync ? await env.escandidor_db.prepare('SELECT version FROM poem_versions WHERE poem_id=? AND client_id=?').bind(poemId,sync.id).first() : null;
  return jsonResponse({ ok: true, poem: serializePoem(row), ...(synced ? { syncedVersion: synced.version } : {}) });
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
