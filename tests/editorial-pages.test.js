import test from 'node:test';
import assert from 'node:assert/strict';
import { renderEditorialMarkdown } from '../editorial-markdown.js';
import {
  DEFAULT_EDITORIAL_PAGES,
  renderEditorialPageHtml,
  validateEditorialPage,
  validateSlug,
} from '../functions/_lib/editorial-pages.js';

test('validates slugs and blocks reserved application paths', () => {
  assert.equal(validateSlug('guia-del-soneto').slug, 'guia-del-soneto');
  assert.ok(validateSlug('taller').error);
  assert.ok(validateSlug('admin').error);
  assert.ok(validateSlug('api').error);
  assert.ok(validateSlug('con espacios').error);
  assert.ok(validateSlug('a').error);

  assert.equal(validateEditorialPage({
    slug: 'poetas-de-referencia',
    heading: 'Poetas de referencia',
    draftMd: '## Lecturas\n- [Las nueve musas](https://www.lasnuevemusas.com/artes/)',
  }).error, undefined);
});

test('renders Markdown safely, expands poetic forms tables and strips XSS', () => {
  const html = renderEditorialMarkdown(`
## Sección <script>alert(1)</script>

Un enlace [externo](https://example.com/a) y uno [malicioso](javascript:alert(1)).

{{formas:poemas}}

{{aviso:/taller/|Abrir taller|**Probá** tus versos ahora.}}
`);

  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.doesNotMatch(html, /javascript:alert/);
  assert.match(html, /href="https:\/\/example\.com\/a" target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /Soneto/);
  assert.match(html, /Sextina/);
  assert.match(html, /workshop-callout/);
  assert.match(html, /<strong>Probá<\/strong>/);
});

test('renders default editorial pages with canonical and all key references', () => {
  const serialized = DEFAULT_EDITORIAL_PAGES.map((p) => ({
    ...p,
    draftMd: p.markdown,
    publishedMd: p.markdown,
    published: true,
    showInNav: Boolean(p.showInNav),
    createdAt: '2026-11-22 00:00:00',
    updatedAt: '2026-11-22 00:00:00',
    publishedAt: '2026-11-22 00:00:00',
  }));

  const recursosHtml = renderEditorialPageHtml(serialized[0], serialized);
  assert.match(recursosHtml, /El Busto de Pallas/);
  assert.match(recursosHtml, /Vamos a hablar de métrica/);
  assert.match(recursosHtml, /Lufloro Panadero/);
  assert.match(recursosHtml, /rel="canonical" href="https:\/\/poesia\.mimesa\.dev\/recursos"/);

  const formasHtml = renderEditorialPageHtml(serialized[1], serialized);
  assert.match(formasHtml, /Décima o espinela/);
  assert.match(formasHtml, /Cuaderna vía/);
  assert.match(formasHtml, /rel="canonical" href="https:\/\/poesia\.mimesa\.dev\/formas-poeticas"/);
});
