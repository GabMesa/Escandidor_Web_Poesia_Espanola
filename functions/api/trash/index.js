import { jsonResponse, requireUser } from '../../_lib/helpers.js';

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
      `SELECT id, title, versions_json, deleted_at FROM deleted_poems
       WHERE user_id = ? ORDER BY deleted_at DESC, id DESC LIMIT 10`
    )
    .bind(user.id)
    .all();

  return jsonResponse({ ok: true, trash: results.map(serializeTrashEntry) });
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const { user, error } = await requireUser(request, env);
  if (error) return error;

  await env.escandidor_db
    .prepare('DELETE FROM deleted_poems WHERE user_id = ?')
    .bind(user.id)
    .run();

  return jsonResponse({ ok: true });
}
