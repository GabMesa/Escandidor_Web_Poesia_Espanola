import { jsonResponse, requireAdmin } from '../../_lib/helpers.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const { error } = await requireAdmin(request, env);
  if (error) return error;

  const [{ userCount }, { poemCount }, { adminCount }] = await Promise.all([
    env.escandidor_db.prepare('SELECT COUNT(*) as userCount FROM users').first(),
    env.escandidor_db.prepare('SELECT COUNT(*) as poemCount FROM poems').first(),
    env.escandidor_db.prepare("SELECT COUNT(*) as adminCount FROM users WHERE role = 'admin'").first(),
  ]);

  return jsonResponse({ ok: true, stats: { userCount, poemCount, adminCount } });
}
