import { errorResponse, hashIdentity, jsonResponse } from '../../_lib/helpers.js';

export async function onRequestPost({ request, env }) {
  if (!env.KOFI_VERIFICATION_TOKEN || !env.escandidor_db) {
    return errorResponse('Webhook no configurado.', 503);
  }

  const form = await request.formData();
  const rawData = form.get('data');
  if (typeof rawData !== 'string') return errorResponse('Evento inválido.');

  let event;
  try {
    event = JSON.parse(rawData);
  } catch {
    return errorResponse('Evento inválido.');
  }

  if (event.verification_token !== env.KOFI_VERIFICATION_TOKEN) {
    return errorResponse('Firma inválida.', 401);
  }

  const transactionId = String(event.kofi_transaction_id || event.transaction_id || '').trim();
  const email = String(event.email || '').trim().toLowerCase();
  if (!transactionId || !email) return errorResponse('Evento incompleto.');

  const supporterHash = await hashIdentity(email);
  const matchingUser = await env.escandidor_db
    .prepare('SELECT id FROM users WHERE lower(email) = ?')
    .bind(email)
    .first();
  const isPublic = event.is_public !== false;
  const displayName = isPublic ? String(event.from_name || '').trim().slice(0, 80) || null : null;
  const isMembership = event.is_subscription_payment || event.type === 'Subscription';
  const amount = Number(event.amount);
  const amountMinor = Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : 0;
  const currency = /^[A-Z]{3}$/.test(String(event.currency || '').toUpperCase())
    ? String(event.currency).toUpperCase()
    : 'EUR';
  const paidAt = Number.isNaN(Date.parse(event.timestamp))
    ? new Date().toISOString()
    : new Date(event.timestamp).toISOString();
  await env.escandidor_db
    .prepare(
      `INSERT INTO supporters (user_id, provider, provider_supporter_id, support_type, status, display_name)
       VALUES (?, 'kofi', ?, ?, ?, ?)
       ON CONFLICT(provider, provider_supporter_id) DO UPDATE SET
         user_id = COALESCE(supporters.user_id, excluded.user_id),
         display_name = COALESCE(excluded.display_name, supporters.display_name),
         support_type = CASE
           WHEN excluded.support_type = 'membership' THEN 'membership'
           ELSE supporters.support_type
         END,
         status = CASE
           WHEN excluded.support_type = 'membership' THEN 'active'
           ELSE supporters.status
         END,
         updated_at = datetime('now')`
    )
    .bind(
      matchingUser?.id || null,
      supporterHash,
      isMembership ? 'membership' : 'one_time',
      isMembership ? 'active' : 'supporter',
      displayName
    )
    .run();

  await env.escandidor_db
    .prepare(
      `INSERT OR IGNORE INTO kofi_payments
        (transaction_id, supporter_id, payment_type, is_subscription_payment, amount_minor, currency, paid_at)
       SELECT ?, id, ?, ?, ?, ?, ? FROM supporters
       WHERE provider = 'kofi' AND provider_supporter_id = ?`
    )
    .bind(
      transactionId,
      String(event.type || 'Donation'),
      event.is_subscription_payment ? 1 : 0,
      amountMinor,
      currency,
      paidAt,
      supporterHash
    )
    .run();

  return jsonResponse({ ok: true });
}