import { errorResponse, jsonResponse, requireAdmin, safeJson } from '../../../_lib/helpers.js';
import {
  ensureEditorialPages,
  normalizeSlug,
  serializeEditorialPage,
  validateEditorialPage,
} from '../../../_lib/editorial-pages.js';

export async function onRequestPatch({ request, env, params }) {
  const { error } = await requireAdmin(request, env);
  if (error) return error;

  await ensureEditorialPages(env.escandidor_db);
  const slug = normalizeSlug(params.slug);
  const existing = await env.escandidor_db
    .prepare('SELECT * FROM editorial_pages WHERE slug = ?')
    .bind(slug)
    .first();
  if (!existing) return errorResponse('Página no encontrada.', 404);

  const body = await safeJson(request);
  const action = String(body.action || 'save-draft').trim();

  if (action === 'discard-draft') {
    if (!existing.published) {
      return errorResponse('Esta página todavía no tiene una versión publicada para restaurar.', 400);
    }
    const restored = await env.escandidor_db
      .prepare(
        `UPDATE editorial_pages
         SET draft_md = published_md, updated_at = datetime('now')
         WHERE slug = ?
         RETURNING slug, title, heading, eyebrow, description, draft_md, published_md, published,
                   show_in_nav, nav_label, sort_order, created_at, updated_at, published_at`
      )
      .bind(slug)
      .first();
    return jsonResponse({ ok: true, page: serializeEditorialPage(restored) });
  }

  if (action === 'unpublish') {
    const unpublished = await env.escandidor_db
      .prepare(
        `UPDATE editorial_pages
         SET published = 0, updated_at = datetime('now')
         WHERE slug = ?
         RETURNING slug, title, heading, eyebrow, description, draft_md, published_md, published,
                   show_in_nav, nav_label, sort_order, created_at, updated_at, published_at`
      )
      .bind(slug)
      .first();
    return jsonResponse({ ok: true, page: serializeEditorialPage(unpublished) });
  }

  const validated = validateEditorialPage(body, existing);
  if (validated.error) return errorResponse(validated.error, 400);

  const { title, heading, eyebrow, description, draftMd, showInNav, navLabel, sortOrder } = validated.value;
  const publishing = action === 'publish';
  const nextPublishedMd = publishing ? draftMd : existing.published_md;
  const nextPublished = publishing ? 1 : existing.published;

  const updated = await env.escandidor_db
    .prepare(
      `UPDATE editorial_pages
       SET title = ?, heading = ?, eyebrow = ?, description = ?,
           draft_md = ?, published_md = ?, published = ?,
           show_in_nav = ?, nav_label = ?, sort_order = ?,
           updated_at = datetime('now'),
           published_at = ${publishing ? "datetime('now')" : 'published_at'}
       WHERE slug = ?
       RETURNING slug, title, heading, eyebrow, description, draft_md, published_md, published,
                 show_in_nav, nav_label, sort_order, created_at, updated_at, published_at`
    )
    .bind(
      title,
      heading,
      eyebrow,
      description,
      draftMd,
      nextPublishedMd,
      nextPublished,
      showInNav,
      navLabel,
      sortOrder,
      slug
    )
    .first();

  return jsonResponse({ ok: true, page: serializeEditorialPage(updated) });
}

export async function onRequestDelete({ request, env, params }) {
  const { error } = await requireAdmin(request, env);
  if (error) return error;

  await ensureEditorialPages(env.escandidor_db);
  const slug = normalizeSlug(params.slug);
  const existing = await env.escandidor_db
    .prepare('SELECT slug FROM editorial_pages WHERE slug = ?')
    .bind(slug)
    .first();
  if (!existing) return errorResponse('Página no encontrada.', 404);

  await env.escandidor_db.prepare('DELETE FROM editorial_pages WHERE slug = ?').bind(slug).run();
  return jsonResponse({ ok: true });
}
