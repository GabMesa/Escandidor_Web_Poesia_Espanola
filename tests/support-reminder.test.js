import test from 'node:test';
import assert from 'node:assert/strict';
import { formatSupporterMessage } from '../support-reminder.js';
import { onRequestGet } from '../functions/api/supporters.js';
import { onRequestPost } from '../functions/api/webhooks/kofi.js';

function createKofiDatabase() {
  const supporters = new Map();
  const payments = new Set();
  const usersByEmail = new Map([['cuervo@example.com', { id: 42 }]]);

  return {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async first() {
              if (sql.includes('FROM users WHERE lower(email)')) return usersByEmail.get(values[0]) || null;
              return null;
            },
            async run() {
              if (sql.includes('INSERT INTO supporters')) {
                const [userId, supporterHash, supportType, status, displayName] = values;
                const current = supporters.get(supporterHash);
                supporters.set(supporterHash, {
                  id: current?.id || supporters.size + 1,
                  userId: current?.userId || userId,
                  displayName: displayName || current?.displayName || null,
                  supportType: supportType === 'membership' ? 'membership' : current?.supportType || supportType,
                  status: supportType === 'membership' ? 'active' : current?.status || status,
                });
              } else if (sql.includes('INSERT OR IGNORE INTO kofi_payments')) {
                payments.add(values[0]);
              }
            },
          };
        },
        async first() {
          return { count: supporters.size };
        },
      };
    },
    supporters,
    payments,
  };
}

function kofiRequest(data) {
  const form = new FormData();
  form.set('data', JSON.stringify(data));
  return new Request('https://example.test/api/webhooks/kofi', { method: 'POST', body: form });
}

test('formats the supporter count for zero, singular and plural', () => {
  assert.equal(
    formatSupporterMessage(0),
    'Todavía no hay donaciones. Puedes ser la primera persona en apoyar el proyecto.'
  );
  assert.equal(
    formatSupporterMessage(1),
    'Este proyecto vuela gracias a 1 cuervo y a la ilusión de su desarrollador.'
  );
  assert.equal(
    formatSupporterMessage(4),
    'Este proyecto vuela gracias a 4 cuervos y a la ilusión de su desarrollador.'
  );
  assert.equal(
    formatSupporterMessage(4, { message: 'Gracias por darle alas a cada verso.' }),
    'Gracias por darle alas a cada verso.'
  );
});

test('exposes only a validated supporter count', async () => {
  const database = createKofiDatabase();
  const event = {
    verification_token: 'secret',
    transaction_id: 'payment-1',
    email: 'Cuervo@example.com',
    from_name: 'Cuervo Público',
    is_public: true,
    type: 'Donation',
  };

  await onRequestPost({
    request: kofiRequest(event),
    env: { KOFI_VERIFICATION_TOKEN: 'secret', escandidor_db: database },
  });
  await onRequestPost({
    request: kofiRequest({
      ...event,
      transaction_id: 'payment-2',
      type: 'Subscription',
      is_subscription_payment: true,
    }),
    env: { KOFI_VERIFICATION_TOKEN: 'secret', escandidor_db: database },
  });
  await onRequestPost({
    request: kofiRequest(event),
    env: { KOFI_VERIFICATION_TOKEN: 'secret', escandidor_db: database },
  });

  const response = await onRequestGet({
    env: { KOFI_HISTORICAL_SUPPORTER_COUNT: '6', escandidor_db: database },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, count: 7, supporter: null });
  assert.equal(database.supporters.size, 1);
  assert.equal([...database.supporters.values()][0].userId, 42);
  assert.equal([...database.supporters.values()][0].displayName, 'Cuervo Público');
  assert.equal([...database.supporters.values()][0].supportType, 'membership');
  assert.equal(database.payments.size, 2);

  const unavailableResponse = await onRequestGet({ env: {} });
  assert.equal(unavailableResponse.status, 503);
});

test('rejects a Ko-fi webhook with the wrong verification token', async () => {
  const response = await onRequestPost({
    request: kofiRequest({
      verification_token: 'wrong',
      transaction_id: 'payment-1',
      email: 'cuervo@example.com',
    }),
    env: { KOFI_VERIFICATION_TOKEN: 'secret', escandidor_db: createKofiDatabase() },
  });

  assert.equal(response.status, 401);
});