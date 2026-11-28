import { listEditorialPages } from './_lib/editorial-pages.js';
import { CLASSIC_POEM_LASTMOD, CLASSIC_POEM_SLUGS } from './_lib/classic-poem-slugs.js';

const STATIC_ENTRIES = [
  { loc: 'https://poesia.mimesa.dev/', lastmod: CLASSIC_POEM_LASTMOD },
  { loc: 'https://poesia.mimesa.dev/taller/', lastmod: CLASSIC_POEM_LASTMOD },
  { loc: 'https://poesia.mimesa.dev/separar-en-silabas-metricas', lastmod: CLASSIC_POEM_LASTMOD },
  { loc: 'https://poesia.mimesa.dev/separar-en-silabas', lastmod: CLASSIC_POEM_LASTMOD },
  { loc: 'https://poesia.mimesa.dev/metrica/', lastmod: CLASSIC_POEM_LASTMOD },
  ...CLASSIC_POEM_SLUGS.map((slug) => ({
    loc: `https://poesia.mimesa.dev/metrica/${slug}`,
    lastmod: CLASSIC_POEM_LASTMOD,
  })),
  { loc: 'https://poesia.mimesa.dev/componer-versos', lastmod: '2026-11-22' },
  { loc: 'https://poesia.mimesa.dev/apoyar', lastmod: '2026-11-22' },
  { loc: 'https://poesia.mimesa.dev/agradecimientos', lastmod: '2026-11-22' },
  { loc: 'https://poesia.mimesa.dev/privacidad', lastmod: '2026-11-22' },
];

function xmlEscape(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export async function onRequestGet({ env }) {
  const publishedPages = await listEditorialPages(env?.escandidor_db, { publishedOnly: true });
  const seen = new Set();
  const entries = [];

  for (const entry of STATIC_ENTRIES) {
    seen.add(entry.loc);
    entries.push(entry);
  }
  for (const page of publishedPages) {
    const loc = `https://poesia.mimesa.dev/${page.slug}`;
    if (seen.has(loc)) continue;
    seen.add(loc);
    const rawDate = String(page.publishedAt || page.updatedAt || '2026-11-22').slice(0, 10);
    const lastmod = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : '2026-11-22';
    entries.push({ loc, lastmod });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries
    .map((e) => `  <url>\n    <loc>${xmlEscape(e.loc)}</loc>\n    <lastmod>${xmlEscape(e.lastmod)}</lastmod>\n  </url>`)
    .join('\n')}\n</urlset>\n`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
