import { jsonResponse, requireAdmin, publicUser } from '../../../_lib/helpers.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const { error } = await requireAdmin(request, env);
  if (error) return error;

  const url = new URL(request.url);
  const search = (url.searchParams.get('q') || '').trim();

  let query = 'SELECT * FROM users';
  const binds = [];
  if (search) {
    query += ' WHERE username LIKE ? OR email LIKE ?';
    binds.push(`%${search}%`, `%${search}%`);
  }
  query += ' ORDER BY created_at DESC';

  const { results } = await env.escandidor_db
    .prepare(query)
    .bind(...binds)
    .all();

  const { results: counts } = await env.escandidor_db
    .prepare('SELECT user_id, COUNT(*) as poem_count FROM poems GROUP BY user_id')
    .all();
  const countMap = new Map(counts.map((c) => [c.user_id, c.poem_count]));

  return jsonResponse({
    ok: true,
    users: results.map((row) => ({ ...publicUser(row), poemCount: countMap.get(row.id) || 0 })),
  });
}
