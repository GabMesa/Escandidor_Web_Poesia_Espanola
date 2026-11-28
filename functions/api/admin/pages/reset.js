import { jsonResponse, requireAdmin } from '../../../_lib/helpers.js';
import { resetDefaultEditorialPages } from '../../../_lib/editorial-pages.js';

export async function onRequestPost({ request, env }) {
  const { error } = await requireAdmin(request, env);
  if (error) return error;

  const restored = await resetDefaultEditorialPages(env.escandidor_db);
  return jsonResponse({ ok: true, restored });
}
