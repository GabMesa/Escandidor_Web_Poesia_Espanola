import { maintainUserTrash } from '../../_lib/trash-storage.js';
import { hasPoemContent, isValidPoemTitle, samePoemContent } from '../../../poem-policy.js';
import { jsonResponse, safeJson, requireUser } from '../../_lib/helpers.js';
import {existingPoemTitle} from '../../_lib/poem-identity.js';
import {poemTitleKey} from '../../../poem-policy.js';

function serializeTrashEntry(row) {
  let versions = [];
  try {
    versions = JSON.parse(row.versions_json || '[]');
  } catch {}
  return {
    id: row.id,
    poemId: row.poem_id,
    title: row.title,
    versions,
    deletedAt: row.deleted_at,
  };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const { user, error } = await requireUser(request, env);
  if (error) return error;
  const policy = await maintainUserTrash(env, user.id);

  const { results } = await env.escandidor_db
    .prepare(
      `SELECT id, poem_id, title, versions_json, deleted_at FROM deleted_poems
       WHERE user_id = ? AND versions_json <> '[]'
       ORDER BY deleted_at DESC, id DESC LIMIT 10`
    )
    .bind(user.id)
    .all();

  const { results: deletions } = await env.escandidor_db
    .prepare('SELECT poem_id FROM deleted_poems WHERE user_id = ? AND poem_id IS NOT NULL')
    .bind(user.id)
    .all();

  const {results:compressedVersions}=await env.escandidor_db.prepare('SELECT poem_id AS poemId,version,client_id AS clientId,replacement_version AS replacementVersion FROM compressed_poem_versions WHERE user_id=?').bind(user.id).all();
  const {results:mergedPoems}=await env.escandidor_db.prepare('SELECT source_id AS sourceId,target_id AS targetId FROM merged_poems WHERE user_id=?').bind(user.id).all();
  return jsonResponse({
    ok: true,
    policy,
    trash: results.map(serializeTrashEntry),
    deletedPoemIds: deletions.map((row) => row.poem_id),
    compressedVersions,
    mergedPoems,
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const { user, error } = await requireUser(request, env);
  if (error) return error;

  await maintainUserTrash(env, user.id);
  const body = await safeJson(request);
  const trashId = Number(body.trashId);
  if (Number.isInteger(trashId) && trashId > 0) {
    const entry = await env.escandidor_db
      .prepare('SELECT * FROM deleted_poems WHERE id = ? AND user_id = ?')
      .bind(trashId, user.id)
      .first();
    if (!entry) return jsonResponse({ error: 'Elemento de papelera no encontrado.' }, { status: 404 });

    let versions = [];
    try { versions = JSON.parse(entry.versions_json || '[]'); } catch {}
    versions = Array.isArray(versions) ? versions.filter(version => hasPoemContent(version?.content)) : [];
    if (!isValidPoemTitle(entry.title)) return jsonResponse({ error: 'La copia necesita un título válido antes de restaurarse.' }, { status: 400 });
    if (!versions.length) {
      return jsonResponse({ error: 'Esta copia ya no se puede restaurar.' }, { status: 409 });
    }

    let poemId = Number(entry.poem_id) || Number(versions[0]?.sourcePoemId);
    const existing = Number.isInteger(poemId)
      ? await env.escandidor_db
        .prepare('SELECT id FROM poems WHERE id = ? AND user_id = ?')
        .bind(poemId, user.id)
        .first()
      : null;

    const sameTitleId=!existing?await existingPoemTitle(env.escandidor_db,user.id,entry.title):null;
    if(sameTitleId)poemId=sameTitleId;
    if (!existing && !sameTitleId) {
      const first = versions[0] || {};
      const settings = first.settings && typeof first.settings === 'object' ? first.settings : {};
      const poem = await env.escandidor_db
        .prepare(
          `INSERT INTO poems (user_id, name, configurations, font_family, color_index,title_key)
           VALUES (?, ?, ?, ?, ?,?) RETURNING id`
        )
        .bind(user.id, entry.title, JSON.stringify(settings), settings.poemFont || 'atkinson', first.colorIndex ?? null,poemTitleKey(entry.title))
        .first();
      poemId = poem.id;
    }

    const latest = await env.escandidor_db
      .prepare('SELECT version, content FROM poem_versions WHERE poem_id = ? ORDER BY version DESC LIMIT 1')
      .bind(poemId)
      .first();
    const high=await env.escandidor_db.prepare('SELECT MAX(version) AS version FROM (SELECT version FROM poem_versions WHERE poem_id=? UNION ALL SELECT version FROM compressed_poem_versions WHERE poem_id=?)').bind(poemId,poemId).first();
    let nextVersion = Math.max(Number(latest?.version)||0,Number(high?.version)||0);
    let previousContent = latest?.content;
    for (const version of versions) {
      if (previousContent !== undefined && samePoemContent(previousContent, version.content)) continue;
      previousContent = version.content;
      nextVersion += 1;
      await env.escandidor_db
        .prepare(
          `INSERT INTO poem_versions (poem_id, name, content, version, created_at)
           VALUES (?, ?, ?, ?, COALESCE(?, datetime('now')))`
        )
        .bind(poemId, version.versionName || `v${nextVersion}`, version.content || '', nextVersion, version.createdAt || null)
        .run();
    }

    await env.escandidor_db
      .prepare('DELETE FROM deleted_poems WHERE id = ? AND user_id = ?')
      .bind(trashId, user.id)
      .run();
    return jsonResponse({ ok: true, poemId });
  }

  const poemId = Number(body.poemId);
  const title = String(body.title || '').trim().slice(0, 200);
  if (!Number.isInteger(poemId) || poemId <= 0 || !title) return jsonResponse({ ok: true });

  await env.escandidor_db
    .prepare(
      `INSERT INTO deleted_poems (user_id, poem_id, title, versions_json, deleted_at)
       VALUES (?, ?, ?, '[]', datetime('now'))
       ON CONFLICT(user_id, poem_id) WHERE poem_id IS NOT NULL DO UPDATE SET
         title = excluded.title, deleted_at = excluded.deleted_at`
    )
    .bind(user.id, poemId, title)
    .run();

  return jsonResponse({ ok: true });
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const { user, error } = await requireUser(request, env);
  if (error) return error;

  await env.escandidor_db.batch([
    env.escandidor_db
      .prepare("UPDATE deleted_poems SET versions_json = '[]' WHERE user_id = ? AND poem_id IS NOT NULL")
      .bind(user.id),
    env.escandidor_db
      .prepare('DELETE FROM deleted_poems WHERE user_id = ? AND poem_id IS NULL')
      .bind(user.id),
  ]);

  return jsonResponse({ ok: true });
}

export async function onRequestPatch(context) {
  const { request, env } = context;
  const { user, error } = await requireUser(request, env);
  if (error) return error;
  const body = await safeJson(request);
  if (typeof body.autoCleanup !== 'boolean') return jsonResponse({ error: 'Indica si quieres activar la limpieza automática.' }, { status: 400 });
  await env.escandidor_db.prepare('INSERT INTO user_trash_settings (user_id, auto_cleanup) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET auto_cleanup = excluded.auto_cleanup')
    .bind(user.id, body.autoCleanup ? 1 : 0).run();
  return jsonResponse({ ok: true, policy: await maintainUserTrash(env, user.id) });
}
