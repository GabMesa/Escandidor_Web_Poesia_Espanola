import { jsonResponse, requireUser, serializePoem } from '../../_lib/helpers.js';

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

export async function onRequestGet({ request, env }) {
  const { user, error } = await requireUser(request, env);
  if (error) return error;

  const [{ results: poemRows }, { results: trashRows }, { results: deletionRows }] = await Promise.all([
    env.escandidor_db.prepare(
      `SELECT p.id, p.name AS title, p.configurations AS settings_json, p.color_index,
              p.created_at, p.updated_at, pv.name AS version_name, pv.content,
              pv.version, pv.created_at AS version_created_at
       FROM poems p JOIN poem_versions pv ON pv.poem_id = p.id
       WHERE p.user_id = ?
         AND NOT EXISTS (
           SELECT 1 FROM deleted_poems dp
           WHERE dp.user_id = p.user_id AND dp.poem_id = p.id
         )
       ORDER BY p.updated_at DESC, pv.version ASC`
    ).bind(user.id).all(),
    env.escandidor_db.prepare(
      `SELECT id, poem_id, title, versions_json, deleted_at FROM deleted_poems
       WHERE user_id = ? AND versions_json <> '[]'
       ORDER BY deleted_at DESC, id DESC LIMIT 10`
    ).bind(user.id).all(),
    env.escandidor_db.prepare(
      'SELECT poem_id FROM deleted_poems WHERE user_id = ? AND poem_id IS NOT NULL'
    ).bind(user.id).all(),
  ]);

  const poemsById = new Map();
  for (const row of poemRows) {
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
  }

  return jsonResponse({
    ok: true,
    state: {
      schemaVersion: 1,
      poems: [...poemsById.values()],
      trash: trashRows.map(serializeTrashEntry),
      deletedPoemIds: deletionRows.map((row) => row.poem_id),
    },
  });
}