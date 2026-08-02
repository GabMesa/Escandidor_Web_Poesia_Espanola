import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/supporters/acknowledgements.js';

test('publishes donor names and protects anonymous supporters', async () => {
  const database = {
    prepare() {
      return {
        async all() {
          return { results: [{ display_name: 'Luna' }, { display_name: null }] };
        },
      };
    },
  };

  const response = await onRequestGet({ env: { escandidor_db: database } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    donors: [
      { name: 'Luna', anonymous: false },
      { name: 'Poeta anónimo', anonymous: true },
    ],
  });
});