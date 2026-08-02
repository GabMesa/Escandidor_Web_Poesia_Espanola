import { errorResponse, getSessionUser, jsonResponse } from '../_lib/helpers.js';

export async function onRequestGet({ request, env }) {
  if (!env.escandidor_db) {
    return errorResponse('El recuento de apoyos no está disponible.', 503);
  }

  const row = await env.escandidor_db
    .prepare("SELECT COUNT(*) AS count FROM supporters WHERE provider = 'kofi'")
    .first();
  const supporterCount = Number(row?.count || 0);
  const historicalCount = Number(env.KOFI_HISTORICAL_SUPPORTER_COUNT || 0);
  const count = supporterCount + (
    Number.isSafeInteger(historicalCount) && historicalCount >= 0 ? historicalCount : 0
  );

  const user = request ? await getSessionUser(request, env) : null;
  const supporter = user ? await env.escandidor_db
    .prepare(
      `SELECT support_type, status, personalized_message
       FROM supporters WHERE user_id = ?
       ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'supporter' THEN 1 ELSE 2 END, updated_at DESC
       LIMIT 1`
    )
    .bind(user.id)
    .first() : null;

  return jsonResponse({
    ok: true,
    count,
    supporter: supporter ? {
      supportType: supporter.support_type,
      status: supporter.status,
      message: supporter.personalized_message || null,
    } : null,
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}