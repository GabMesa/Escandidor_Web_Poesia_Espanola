import { jsonResponse, requireAdmin } from '../../../_lib/helpers.js';

export async function onRequestGet({ request, env }) {
  const { error } = await requireAdmin(request, env);
  if (error) return error;

  const url = new URL(request.url);
  const search = (url.searchParams.get('q') || '').trim();
  const pattern = `%${search}%`;
  const { results } = await env.escandidor_db
    .prepare(
      `SELECT s.id, s.provider, s.display_name, s.support_type, s.status, s.personalized_message,
        s.current_period_end, s.created_at, s.updated_at,
        u.id AS user_id, u.username, u.email, u.discord_id,
        (SELECT json_group_array(json_object('currency', totals.currency, 'earnedMinor', totals.earned_minor))
         FROM (SELECT currency, SUM(amount_minor) AS earned_minor FROM kofi_payments
           WHERE supporter_id = s.id GROUP BY currency ORDER BY currency) totals) AS revenue_json,
        MAX(p.paid_at) AS last_paid_at
       FROM supporters s
       LEFT JOIN users u ON u.id = s.user_id
       LEFT JOIN kofi_payments p ON p.supporter_id = s.id
      WHERE (? = '' OR u.username LIKE ? OR u.email LIKE ? OR s.provider LIKE ? OR s.display_name LIKE ?)
       GROUP BY s.id
       ORDER BY s.updated_at DESC`
    )
    .bind(search, pattern, pattern, pattern, pattern)
    .all();

  return jsonResponse({
    ok: true,
    supporters: results.map((row) => ({
      id: row.id,
      provider: row.provider,
      displayName: row.display_name || null,
      supportType: row.support_type,
      status: row.status,
      personalizedMessage: row.personalized_message || '',
      currentPeriodEnd: row.current_period_end,
      revenue: JSON.parse(row.revenue_json || '[]'),
      lastPaidAt: row.last_paid_at,
      user: row.user_id ? {
        id: row.user_id,
        username: row.username,
        email: row.email,
        discordConnected: Boolean(row.discord_id),
      } : null,
    })),
  });
}