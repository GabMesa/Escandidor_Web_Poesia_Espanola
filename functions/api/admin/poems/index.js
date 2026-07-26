import { jsonResponse, requireAdmin, serializePoem } from '../../../_lib/helpers.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const { error } = await requireAdmin(request, env);
  if (error) return error;

  const url = new URL(request.url);
  const search = (url.searchParams.get('q') || '').trim();
  const userId = url.searchParams.get('userId');

  let query = `SELECT current_poems.*, users.username, users.email
               FROM current_poems JOIN users ON users.id = current_poems.user_id`;
  const conditions = [];
  const binds = [];
  if (search) {
    conditions.push('(current_poems.title LIKE ? OR users.username LIKE ?)');
    binds.push(`%${search}%`, `%${search}%`);
  }
  if (userId) {
    conditions.push('current_poems.user_id = ?');
    binds.push(userId);
  }
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY current_poems.updated_at DESC LIMIT 200';

  const { results } = await env.escandidor_db
    .prepare(query)
    .bind(...binds)
    .all();

  return jsonResponse({
    ok: true,
    poems: results.map((row) => ({
      ...serializePoem(row),
      owner: { username: row.username, email: row.email, userId: row.user_id },
    })),
  });
}
