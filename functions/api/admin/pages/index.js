import { errorResponse, jsonResponse, requireAdmin, safeJson } from '../../../_lib/helpers.js';
import {
  ensureEditorialPages,
  listEditorialPages,
  serializeEditorialPage,
  validateEditorialPage,
} from '../../../_lib/editorial-pages.js';

export async function onRequestGet({ request, env }) {
  const { error } = await requireAdmin(request, env);
  if (error) return error;

  const search = (new URL(request.url).searchParams.get('q') || '').trim();
  const pages = await listEditorialPages(env.escandidor_db, { publishedOnly: false, search });
  return jsonResponse({ ok: true, pages });
}

export async function onRequestPost({ request, env }) {
  const { error } = await requireAdmin(request, env);
  if (error) return error;

  await ensureEditorialPages(env.escandidor_db);
  const body = await safeJson(request);
  const validated = validateEditorialPage(body);
  if (validated.error) return errorResponse(validated.error, 400);

  const { slug, title, heading, eyebrow, description, draftMd, showInNav, navLabel, sortOrder } = validated.value;
  const existing = await env.escandidor_db
    .prepare('SELECT slug FROM editorial_pages WHERE slug = ?')
    .bind(slug)
    .first();
  if (existing) return errorResponse(`Ya existe una página con la URL "/${slug}".`, 409);

  const publishNow = Boolean(body.publish);
  const publishedMd = publishNow ? draftMd : '';
  const inserted = await env.escandidor_db
    .prepare(
      `INSERT INTO editorial_pages
       (slug, title, heading, eyebrow, description, draft_md, published_md, published, show_in_nav, nav_label, sort_order, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${publishNow ? "datetime('now')" : 'NULL'})
       RETURNING slug, title, heading, eyebrow, description, draft_md, published_md, published,
                 show_in_nav, nav_label, sort_order, created_at, updated_at, published_at`
    )
    .bind(
      slug,
      title,
      heading,
      eyebrow,
      description,
      draftMd,
      publishedMd,
      publishNow ? 1 : 0,
      showInNav,
      navLabel,
      sortOrder
    )
    .first();

  return jsonResponse({ ok: true, page: serializeEditorialPage(inserted) }, { status: 201 });
}
