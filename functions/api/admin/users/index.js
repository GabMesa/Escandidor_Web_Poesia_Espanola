import { jsonResponse, requireAdmin, publicUser } from '../../../_lib/helpers.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const { error } = await requireAdmin(request, env);
  if (error) return error;

  const url = new URL(request.url);
  const search = (url.searchParams.get('q') || '').trim();

  let query = `SELECT u.*,
    CASE WHEN EXISTS (
      SELECT 1 FROM supporters s WHERE s.user_id = u.id AND s.status IN ('supporter', 'active')
    ) THEN 1 ELSE 0 END AS is_paying,
    (SELECT s.personalized_message FROM supporters s
      WHERE s.user_id = u.id AND s.status IN ('supporter', 'active')
      ORDER BY s.updated_at DESC LIMIT 1) AS supporter_message
    FROM users u`;
  const binds = [];
  if (search) {
    query += ' WHERE u.username LIKE ? OR u.email LIKE ?';
    binds.push(`%${search}%`, `%${search}%`);
  }
  query += ' ORDER BY u.created_at DESC';

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
    users: results.map((row) => ({
      ...publicUser(row),
      poemCount: countMap.get(row.id) || 0,
      discordConnected: Boolean(row.discord_id),
      paying: Boolean(row.is_paying),
      personalizedMessage: row.supporter_message || '',
    })),
  });
}
