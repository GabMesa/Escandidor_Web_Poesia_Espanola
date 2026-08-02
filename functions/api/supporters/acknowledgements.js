import { errorResponse, jsonResponse } from '../../_lib/helpers.js';

export async function onRequestGet({ env }) {
  if (!env.escandidor_db) {
    return errorResponse('Los agradecimientos no están disponibles.', 503);
  }

  const { results } = await env.escandidor_db
    .prepare(
      `SELECT display_name
       FROM supporters
       WHERE provider = 'kofi'
       ORDER BY created_at ASC, id ASC`
    )
    .all();

  return jsonResponse({
    ok: true,
    donors: results.map((row) => ({
      name: row.display_name || 'Poeta anónimo',
      anonymous: !row.display_name,
    })),
  }, { headers: { 'Cache-Control': 'public, max-age=300' } });
}