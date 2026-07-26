import { jsonResponse, safeJson, requireUser } from '../../_lib/helpers.js';

function serializeTrashEntry(row) {
  let versions = [];
  try {
    versions = JSON.parse(row.versions_json || '[]');
  } catch {}
  return {
    id: row.id,
    title: row.title,
    versions,
    deletedAt: row.deleted_at,
  };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const { user, error } = await requireUser(request, env);
  if (error) return error;

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

  return jsonResponse({
    ok: true,
    trash: results.map(serializeTrashEntry),
    deletedPoemIds: deletions.map((row) => row.poem_id),
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const { user, error } = await requireUser(request, env);
  if (error) return error;

  const body = await safeJson(request);
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
