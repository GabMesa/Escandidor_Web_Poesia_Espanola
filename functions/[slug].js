import {
  RESERVED_SLUGS,
  getPublishedEditorialPage,
  listEditorialPages,
  normalizeSlug,
  renderEditorialPageHtml,
} from './_lib/editorial-pages.js';

export async function onRequestGet(context) {
  const rawSlug = String(context.params.slug || '');
  if (!rawSlug || rawSlug.includes('.')) return context.next();

  const slug = normalizeSlug(rawSlug);
  if (RESERVED_SLUGS.has(slug)) return context.next();

  const page = await getPublishedEditorialPage(context.env?.escandidor_db, slug);
  if (!page) return context.next();

  const navPages = await listEditorialPages(context.env?.escandidor_db, { publishedOnly: true });
  const html = renderEditorialPageHtml(page, navPages);
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=600',
    },
  });
}
