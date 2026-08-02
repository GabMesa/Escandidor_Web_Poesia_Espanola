import { jsonResponse, requireAdmin } from '../../_lib/helpers.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const { error } = await requireAdmin(request, env);
  if (error) return error;

  const [{ userCount }, { poemCount }, { adminCount }, { payingUserCount }, revenue] = await Promise.all([
    env.escandidor_db.prepare('SELECT COUNT(*) as userCount FROM users').first(),
    env.escandidor_db.prepare('SELECT COUNT(*) as poemCount FROM poems').first(),
    env.escandidor_db.prepare("SELECT COUNT(*) as adminCount FROM users WHERE role = 'admin'").first(),
    env.escandidor_db.prepare(
      "SELECT COUNT(DISTINCT user_id) AS payingUserCount FROM supporters WHERE user_id IS NOT NULL AND status IN ('supporter', 'active')"
    ).first(),
    env.escandidor_db.prepare(
      `SELECT currency,
        SUM(amount_minor) AS earned_minor,
        SUM(CASE WHEN is_subscription_payment = 1
          AND EXISTS (SELECT 1 FROM supporters s WHERE s.id = kofi_payments.supporter_id AND s.status = 'active')
          AND paid_at = (
          SELECT MAX(latest.paid_at) FROM kofi_payments latest
          WHERE latest.supporter_id = kofi_payments.supporter_id
            AND latest.is_subscription_payment = 1
        ) THEN amount_minor ELSE 0 END) AS next_month_minor
       FROM kofi_payments GROUP BY currency ORDER BY currency`
    ).all(),
  ]);

  return jsonResponse({
    ok: true,
    stats: {
      userCount,
      poemCount,
      adminCount,
      payingUserCount,
      revenue: revenue.results.map((row) => ({
        currency: row.currency,
        earnedMinor: Number(row.earned_minor) || 0,
        nextMonthMinor: Number(row.next_month_minor) || 0,
      })),
    },
  });
}
