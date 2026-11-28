import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { analyzeLine, findAutomaticTriphthongBreaks } from '../analyzer.js';

const esc = (v) => String(v ?? '').replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const publishedDate = '2026-11-27';

const poems = JSON.parse(await readFile(resolve(process.cwd(), 'scripts/classic-poems-verified.json'), 'utf8'));

function parseSyneresisMap(pairs = []) {
  const map = {};
  for (const key of pairs) {
    const [w, b] = String(key).split(':').map(Number);
    if (!Number.isInteger(w) || !Number.isInteger(b)) continue;
    map[w] ??= [];
    map[w].push(b);
  }
  return map;
}

function buildVerifiedRows(poem) {
  const rawLines = poem.text.split('\n');
  const rows = [];
  const exactSinalefaOverrides = { ...(poem.sinalefaOverrides || {}) };
  let verseNum = 0;

  rawLines.forEach((raw, lineIndex) => {
    if (!raw.trim()) return;
    verseNum += 1;
    const synPairs = poem.syneresisOverrides?.[lineIndex] || [];
    const synMap = parseSyneresisMap(synPairs);
    const analysis = Object.keys(synMap).length ? analyzeLine(raw, { syneresis: synMap }) : analyzeLine(raw);

    const active = analysis.boundaries.map((b) => {
      const key = `${lineIndex}:${b.index}`;
      if (Object.hasOwn(poem.sinalefaOverrides || {}, key)) {
        return { ...b, active: Boolean(poem.sinalefaOverrides[key]) };
      }
      return { ...b, active: b.candidate && !b.blockedByHemistich };
    });
    for (const bIdx of findAutomaticTriphthongBreaks(analysis, active)) {
      const key = `${lineIndex}:${bIdx}`;
      if (!Object.hasOwn(poem.sinalefaOverrides || {}, key)) {
        active[bIdx].active = false;
      }
    }

    const activeSinalefas = active.filter((b) => b.active);
    for (const b of activeSinalefas) {
      exactSinalefaOverrides[`${lineIndex}:${b.index}`] = true;
    }
    const brokenSinalefas = active.filter((b) => {
      const key = `${lineIndex}:${b.index}`;
      return Object.hasOwn(poem.sinalefaOverrides || {}, key) && poem.sinalefaOverrides[key] === false;
    });
    const metricCount = analysis.poeticCount - activeSinalefas.length;

    const synWords = Object.keys(synMap)
      .map((wIdx) => analysis.analyses[Number(wIdx)]?.original)
      .filter(Boolean);

    rows.push({
      verseNum,
      raw,
      gram: analysis.rawCount,
      sinalefas: activeSinalefas.map((b) => `${b.between[0]}‿${b.between[1]}`),
      hiatos: brokenSinalefas.map((b) => `${b.between[0]} / ${b.between[1]}`),
      syneresis: synWords,
      accentType: analysis.accentType,
      metricCount,
    });
  });

  if (rows.length !== poem.verseCount) {
    throw new Error(`Conteo de versos inconsistente en ${poem.slug}: ${rows.length} vs ${poem.verseCount}`);
  }
  return { rows, exactSinalefaOverrides };
}

function formatAdjustment(accentType) {
  if (accentType === 'aguda' || accentType === 'monosílaba') return `${accentType} (+1)`;
  if (accentType === 'esdrújula' || accentType === 'sobresdrújula') return `${accentType} (-1)`;
  return `${accentType || 'llana'} (±0)`;
}

function renderPoemPage(poem, rows, exactSinalefaOverrides, allPoems) {
  const url = `https://poesia.mimesa.dev/metrica/${poem.slug}`;
  const pageTitle = `Métrica de «${poem.title}» (${poem.author}): sílabas, sinalefas y rima | Mesa de Poesía`;
  const description = `Análisis métrico verificado de «${poem.title}» de ${poem.author} (${poem.country}): ${poem.verseCount} versos en ${poem.meterLabel.toLowerCase()}, sinalefas y rima en el Escandidor interactivo.`;
  const payload = {
    title: poem.title,
    text: poem.text,
    sinalefa: true,
    rhymeMode: poem.rhymeMode || 'consonante',
    rhymeScheme: poem.rhymeScheme || '',
    syllablePattern: poem.syllablePattern || '',
    sinalefaOverrides: exactSinalefaOverrides,
    syneresisOverrides: poem.syneresisOverrides || {},
  };
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        url,
        name: pageTitle,
        description,
        inLanguage: 'es',
        datePublished: publishedDate,
        dateModified: publishedDate,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://poesia.mimesa.dev/' },
          { '@type': 'ListItem', position: 2, name: 'Poemas escandidos', item: 'https://poesia.mimesa.dev/metrica/' },
          { '@type': 'ListItem', position: 3, name: poem.title, item: url },
        ],
      },
    ],
  };

  const rowsHtml = rows.map((r) => {
    const marks = [
      ...r.sinalefas,
      ...r.hiatos.map((h) => `hiato: ${h}`),
      ...r.syneresis.map((s) => `sinéresis: ${s}`),
    ].join(' · ') || '—';
    return `<tr><td>${r.verseNum}</td><td>${esc(r.raw)}</td><td>${r.gram}</td><td>${esc(marks)}</td><td>${esc(formatAdjustment(r.accentType))}</td><td><strong>${r.metricCount}</strong></td></tr>`;
  }).join('\n            ');

  // Related poems: same author first, then same region, up to 6 links
  const related = [
    ...allPoems.filter((p) => p.slug !== poem.slug && p.author === poem.author),
    ...allPoems.filter((p) => p.slug !== poem.slug && p.author !== poem.author && p.region === poem.region),
    ...allPoems.filter((p) => p.slug !== poem.slug && p.region !== poem.region),
  ].slice(0, 6);

  const relatedHtml = related
    .map((p) => `<li><a href="/metrica/${p.slug}">${esc(p.title)}</a> — ${esc(p.author)} (${esc(p.country)} · ${esc(p.formName)})</li>`)
    .join('\n        ');

  const initialHeight = Math.min(960, Math.max(420, rows.length * 42 + 120));

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(pageTitle)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <link rel="canonical" href="${url}">
  <link rel="icon" href="/favicon.ico" sizes="64x64">
  <meta name="theme-color" content="#E6E4D9">
  <meta property="og:type" content="article">
  <meta property="og:locale" content="es_ES">
  <meta property="og:site_name" content="Mesa de Poesía">
  <meta property="og:title" content="${esc(pageTitle)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="https://poesia.mimesa.dev/assets/social-preview.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(pageTitle)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="https://poesia.mimesa.dev/assets/social-preview.png">
  <script src="/theme-init.js"></script>
  <link rel="stylesheet" href="/landing.css">
  <link rel="stylesheet" href="/identity.css">
  <link rel="stylesheet" href="/guides.css">
  <script src="/theme.js" defer></script>
  <script type="application/ld+json">${JSON.stringify(schema)}</script>
  <style>
    .poem-hero{padding-top:26px;padding-bottom:10px}
    .poem-hero h1{margin:8px 0 8px;font-family:var(--display-font);font-size:clamp(28px,3.6vw,42px);font-weight:400;line-height:1.12;letter-spacing:-.035em}
    .poem-meta-row{display:flex;flex-wrap:wrap;gap:10px;margin:12px 0 6px}
    .meta-badge{display:inline-flex;align-items:center;padding:5px 11px;border-radius:999px;border:1px solid var(--line);font-size:12px;color:var(--text);background:color-mix(in srgb,var(--line) 16%,transparent)}
    .meta-badge.is-ok{border-color:var(--accent);color:var(--accent);background:color-mix(in srgb,var(--accent) 10%,transparent);font-weight:600}
    .legend-bar{display:flex;flex-wrap:wrap;align-items:center;gap:14px;padding:8px 14px;margin:12px 0 10px;border:1px solid var(--line);border-radius:8px;font-size:12px;color:var(--muted);background:color-mix(in srgb,var(--line) 14%,transparent)}
    .legend-pill{display:inline-block;padding:0 7px;border-radius:999px;border:1px solid #5f8c3a;color:#7fb354;font-weight:600;font-size:11px;line-height:1.5}
    .legend-pill.is-off{border-color:#a0262d;color:#d65b63}
    .embed-stage{margin:8px 0 28px}
    .embed-frame{width:100%;height:${initialHeight}px;border:0;display:block;background:transparent}
    .handoff-bar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px;margin-top:14px;padding:16px 18px;border:1px solid var(--line);border-radius:10px;background:color-mix(in srgb,var(--line) 12%,transparent)}
    .handoff-bar.is-edited{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 9%,transparent)}
    .handoff-copy{margin:0;flex:1 1 320px;font-size:.95rem}
    .handoff-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
    .tool-btn{display:inline-flex;align-items:center;padding:10px 15px;border-radius:8px;border:1px solid var(--line);background:transparent;color:var(--text);font:500 13px/1.2 system-ui,sans-serif;cursor:pointer;text-decoration:none}
    .demo-table{width:100%;border-collapse:collapse;margin:16px 0;font-size:.92rem}
    .demo-table th,.demo-table td{padding:8px 7px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
  </style>
</head>
<body class="landing-page">
<a class="skip" href="#contenido">Saltar al contenido</a>
<header class="publication-header">
  <nav class="publication-nav" aria-label="Navegación principal">
    <a class="publication-brand" href="/">Mesa de Poesía<span aria-hidden="true">.</span></a>
    <div class="publication-links"><a href="/">Inicio</a><a href="/taller/">Abrir mi mesa</a><a href="/metrica/" aria-current="page">Poemas escandidos</a><a href="/separar-en-silabas-metricas">Sílabas métricas</a><a href="/separar-en-silabas">Sílabas gramaticales</a><button type="button" class="theme-toggle" data-theme-toggle aria-label="Cambiar a modo oscuro" aria-pressed="false">Modo oscuro</button></div>
  </nav>
  <div class="edition-line"><span>Poemas de dominio público verificados</span><span>${esc(poem.author)} (${esc(poem.country)}) · ${esc(poem.formName)}</span></div>
</header>
<main id="contenido">
  <section class="container poem-hero">
    <p class="label"><a href="/metrica/">Poemas clásicos escandidos</a> · ${esc(poem.country)} · ${esc(poem.era)}</p>
    <h1>${esc(poem.title)}</h1>
    <p class="copy">Escansión interactiva de <strong>${esc(poem.author)}</strong> en el Escandidor de Mesa de Poesía. Hacé clic en cualquier sinalefa, hiato o sinéresis para probar lecturas alternativas, o editá el texto para experimentar.</p>
    <div class="poem-meta-row">
      <span class="meta-badge is-ok">✓ ${rows.length}/${rows.length} versos verificados</span>
      <span class="meta-badge">${esc(poem.country)}</span>
      <span class="meta-badge">${esc(poem.formName)}</span>
      <span class="meta-badge">${esc(poem.meterLabel)}</span>
    </div>
  </section>

  <section class="container embed-stage" aria-label="Escansión interactiva del poema">
    <div class="legend-bar">
      <span><span class="legend-pill">sinalefa</span> unión activa</span>
      <span><span class="legend-pill is-off">hiato</span> sinalefa separada (clic para alternar)</span>
      <span><strong>Modo texto</strong> en el panel derecho para copiar y pegar</span>
    </div>

    <iframe id="poemEmbedFrame" class="embed-frame" scrolling="no" title="Escandidor con ${esc(poem.title)}" src="/escandidor.html?taller=1&demo=poema"></iframe>

    <div id="handoffBar" class="handoff-bar">
      <p id="handoffCopy" class="handoff-copy"><strong>¿Querés medir tu propio poema con esta misma precisión?</strong> Abrí el Taller completo gratis y sin cuenta.</p>
      <div class="handoff-actions">
        <button id="resetPoemBtn" type="button" class="tool-btn">Restaurar poema original</button>
        <a id="openWorkshopLink" class="cta" href="/taller/">Medir mi propio poema en el Taller ↗</a>
      </div>
    </div>
  </section>

  <section class="container guide">
    <article>
      <h2>Notas sobre la escansión</h2>
      <ul>
        ${(poem.notes || []).map((n) => `<li>${esc(n)}</li>`).join('\n        ')}
      </ul>

      <h2>Desglose verso a verso (verificado con Escandidor)</h2>
      <div style="overflow-x:auto">
        <table class="demo-table" aria-label="Análisis métrico verso a verso">
          <thead>
            <tr>
              <th>#</th>
              <th>Verso</th>
              <th>Gram.</th>
              <th>Sinalefas / licencias</th>
              <th>Final</th>
              <th>Métricas</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      <p class="hint">Fuente del texto (dominio público): <a href="${esc(poem.wikiUrl)}" target="_blank" rel="noopener noreferrer">Wikisource en español ↗</a>. Análisis silábico y métrico calculado de forma determinista con el motor de Mesa de Poesía, sin IA generativa.</p>

      <h2>Otros poemas verificados para explorar</h2>
      <ul>
        ${relatedHtml}
      </ul>
      <p><a class="secondary-link" href="/metrica/">← Ver los ${allPoems.length} poemas clásicos verificados</a></p>
    </article>
  </section>
</main>
<footer class="container footer"><a href="/">Mesa de Poesía</a><nav aria-label="Enlaces del pie"><a href="/taller/">Abrir mi mesa</a><a href="/metrica/">Poemas escandidos</a><a href="/separar-en-silabas-metricas">Sílabas métricas</a><a href="/separar-en-silabas">Sílabas gramaticales</a><a href="/apoyar">Donaciones</a><a href="/privacidad">Privacidad</a></nav></footer>
<script type="module">
  const PAYLOAD = ${JSON.stringify(payload)};
  const frame = document.getElementById('poemEmbedFrame');
  const handoffBar = document.getElementById('handoffBar');
  const handoffCopy = document.getElementById('handoffCopy');
  const openWorkshopLink = document.getElementById('openWorkshopLink');
  const resetPoemBtn = document.getElementById('resetPoemBtn');
  let demoState = { title: PAYLOAD.title, text: PAYLOAD.text, edited: false };

  function syncTheme() {
    const theme = document.documentElement.dataset.theme || 'light';
    frame.contentWindow?.postMessage({ type: 'workshop:appearance', theme }, location.origin);
  }
  function loadPoem() {
    frame.contentWindow?.postMessage({ type: 'demo:load', ...PAYLOAD }, location.origin);
  }
  new MutationObserver(syncTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  window.addEventListener('message', (event) => {
    if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
    if (event.data?.type === 'workshop:resize' && Number.isFinite(event.data.height) && event.data.height > 120) {
      frame.style.height = \`\${Math.ceil(event.data.height)}px\`;
    }
    if (event.data?.type === 'workshop:ready' || event.data?.type === 'demo:ready') {
      syncTheme();
      loadPoem();
    }
    if (event.data?.type === 'demo:state') {
      demoState = {
        title: String(event.data.title || ''),
        text: String(event.data.text || ''),
        edited: Boolean(event.data.edited),
      };
      if (demoState.edited && demoState.text.trim()) {
        handoffBar.classList.add('is-edited');
        handoffCopy.innerHTML = '<strong>¿Modificaste el poema o pegaste el tuyo?</strong> Llevate este borrador directo al Taller completo.';
        openWorkshopLink.textContent = 'Seguir esto en mi Taller ↗';
      } else {
        handoffBar.classList.remove('is-edited');
        handoffCopy.innerHTML = '<strong>¿Querés medir tu propio poema con esta misma precisión?</strong> Abrí el Taller completo gratis y sin cuenta.';
        openWorkshopLink.textContent = 'Medir mi propio poema en el Taller ↗';
      }
    }
  });

  resetPoemBtn.addEventListener('click', loadPoem);
  openWorkshopLink.addEventListener('click', () => {
    if (demoState.edited && demoState.text.trim()) {
      try {
        sessionStorage.setItem('mesa.pendingDemoDraft', JSON.stringify({
          title: demoState.title || 'Mi poema',
          text: demoState.text,
        }));
      } catch {}
    }
  });
</script>
</body>
</html>
`;
}

function renderIndexPage(built) {
  const url = 'https://poesia.mimesa.dev/metrica/';
  const total = built.length;
  const uyCount = built.filter((b) => b.poem.region === 'uruguay').length;
  const latamTotal = built.filter((b) => b.poem.region === 'uruguay' || b.poem.region === 'latam').length;
  const esCount = built.filter((b) => b.poem.region === 'espana').length;

  const cards = built.map(({ poem, rows }) => {
    const searchBlob = `${poem.title} ${poem.author} ${poem.country} ${poem.formName} ${poem.meterLabel}`.toLowerCase();
    return `      <article class="poem-card-item" data-region="${esc(poem.region)}" data-search="${esc(searchBlob)}">
        <p class="label">${esc(poem.author)} · ${esc(poem.country)}</p>
        <h2><a href="/metrica/${poem.slug}">${esc(poem.title)}</a></h2>
        <p>${esc(poem.formName)} · ${esc(poem.meterLabel)} · <strong>${rows.length}/${rows.length} versos verificados</strong></p>
        <a class="secondary-link" href="/metrica/${poem.slug}">Ver escansión en vivo ↗</a>
      </article>`;
  }).join('\n');

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${total} poemas clásicos escandidos y verificados | Mesa de Poesía</title>
  <meta name="description" content="Explora ${total} poemas clásicos en español de dominio público escandidos y verificados verso a verso con Escandidor: Canción del pirata, ${uyCount} poemas uruguayos, ${latamTotal} latinoamericanos y ${esCount} españoles.">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <link rel="canonical" href="${url}">
  <link rel="icon" href="/favicon.ico" sizes="64x64">
  <meta name="theme-color" content="#E6E4D9">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="es_ES">
  <meta property="og:site_name" content="Mesa de Poesía">
  <meta property="og:title" content="${total} poemas clásicos escandidos y verificados | Mesa de Poesía">
  <meta property="og:description" content="Canción del pirata y ${total - 1} poemas famosos de Uruguay, Latinoamérica y España verificados verso a verso en el Escandidor.">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="https://poesia.mimesa.dev/assets/social-preview.png">
  <script src="/theme-init.js"></script>
  <link rel="stylesheet" href="/landing.css">
  <link rel="stylesheet" href="/identity.css">
  <link rel="stylesheet" href="/guides.css">
  <script src="/theme.js" defer></script>
  <style>
    .stats-row{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0 18px}
    .stat-pill{padding:6px 12px;border-radius:999px;border:1px solid var(--line);font-size:12px;color:var(--text);background:color-mix(in srgb,var(--line) 14%,transparent)}
    .stat-pill.is-accent{border-color:var(--accent);color:var(--accent);background:color-mix(in srgb,var(--accent) 10%,transparent);font-weight:600}
    .filter-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;margin:18px 0 22px;padding:14px;border:1px solid var(--line);border-radius:10px;background:color-mix(in srgb,var(--line) 10%,transparent)}
    .filter-pills{display:flex;flex-wrap:wrap;gap:8px}
    .filter-btn{padding:7px 14px;border-radius:999px;border:1px solid var(--line);background:transparent;color:var(--text);font:500 13px/1.2 system-ui,sans-serif;cursor:pointer}
    .filter-btn:hover,.filter-btn.is-active{border-color:var(--accent);color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,transparent)}
    .filter-search{flex:1 1 240px;max-width:360px;padding:9px 13px;border:1px solid var(--line);border-radius:8px;background:var(--surface,transparent);color:var(--text);font:400 14px/1.3 system-ui,sans-serif}
    .catalog-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:16px;margin:12px 0 36px}
    .poem-card-item{padding:18px;border:1px solid var(--line);border-top:3px solid var(--action);border-radius:10px;background:color-mix(in srgb,var(--line) 10%,transparent)}
    .poem-card-item h2{margin:6px 0 8px;font:400 20px/1.22 var(--display-font)}
    .poem-card-item p{font-size:13px;color:var(--muted);margin:0 0 12px}
    .poem-card-item[hidden]{display:none}
    .catalog-status{font-size:13px;color:var(--muted);margin:0 0 12px}
  </style>
</head>
<body class="landing-page">
<a class="skip" href="#contenido">Saltar al contenido</a>
<header class="publication-header">
  <nav class="publication-nav" aria-label="Navegación principal">
    <a class="publication-brand" href="/">Mesa de Poesía<span aria-hidden="true">.</span></a>
    <div class="publication-links"><a href="/">Inicio</a><a href="/taller/">Abrir mi mesa</a><a href="/metrica/" aria-current="page">Poemas escandidos</a><a href="/separar-en-silabas-metricas">Sílabas métricas</a><a href="/separar-en-silabas">Sílabas gramaticales</a><button type="button" class="theme-toggle" data-theme-toggle aria-label="Cambiar a modo oscuro" aria-pressed="false">Modo oscuro</button></div>
  </nav>
  <div class="edition-line"><span>Un taller de poesía en español</span><span>${total} escansiones verificadas · Dominio público</span></div>
</header>
<main id="contenido" class="container" style="padding-top:28px;padding-bottom:40px">
  <p class="label">Biblioteca de dominio público · Verificados verso a verso</p>
  <h1 style="font:400 clamp(32px,4vw,46px)/1.1 var(--display-font);margin:8px 0 12px;letter-spacing:-.035em">Poemas clásicos escandidos</h1>
  <p class="copy" style="max-width:74ch">Cada poema de esta biblioteca fue verificado verso a verso con nuestro propio motor de escansión, sin IA generativa. Incluye <strong>Canción del pirata</strong> y clásicos estudiados en clase de <strong>Uruguay</strong>, <strong>Latinoamérica</strong> y <strong>España</strong>.</p>

  <div class="stats-row">
    <span class="stat-pill is-accent">✓ ${total} poemas verificados</span>
    <span class="stat-pill">Uruguay: ${uyCount}</span>
    <span class="stat-pill">Latinoamérica (total): ${latamTotal}</span>
    <span class="stat-pill">España: ${esCount}</span>
  </div>

  <div class="filter-bar" role="region" aria-label="Filtrar poemas escandidos">
    <div class="filter-pills" role="group" aria-label="Filtrar por región">
      <button type="button" class="filter-btn is-active" data-filter="all">Todos (${total})</button>
      <button type="button" class="filter-btn" data-filter="uruguay">Uruguay (${uyCount})</button>
      <button type="button" class="filter-btn" data-filter="latino">Latinoamérica (${latamTotal})</button>
      <button type="button" class="filter-btn" data-filter="espana">España (${esCount})</button>
    </div>
    <input id="catalogSearch" class="filter-search" type="search" placeholder="Buscar por título, autor o metro…" aria-label="Buscar poemas">
  </div>

  <p id="catalogStatus" class="catalog-status">Mostrando ${total} de ${total} poemas verificados.</p>

  <section class="catalog-grid" id="catalogGrid" aria-label="Listado de poemas escandidos">
${cards}
  </section>

  <p><a class="cta" href="/taller/">Escandir mi propio poema en el Taller ↗</a></p>
</main>
<footer class="container footer"><a href="/">Mesa de Poesía</a><nav aria-label="Enlaces del pie"><a href="/taller/">Abrir mi mesa</a><a href="/metrica/">Poemas escandidos</a><a href="/separar-en-silabas-metricas">Sílabas métricas</a><a href="/separar-en-silabas">Sílabas gramaticales</a><a href="/apoyar">Donaciones</a><a href="/privacidad">Privacidad</a></nav></footer>
<script type="module">
  const buttons = [...document.querySelectorAll('.filter-btn')];
  const search = document.getElementById('catalogSearch');
  const cards = [...document.querySelectorAll('.poem-card-item')];
  const status = document.getElementById('catalogStatus');
  let activeRegion = 'all';

  function applyFilters() {
    const q = search.value.trim().toLowerCase();
    let visible = 0;
    for (const card of cards) {
      const reg = card.dataset.region;
      const matchesRegion = activeRegion === 'all'
        || (activeRegion === 'latino' ? (reg === 'uruguay' || reg === 'latam') : reg === activeRegion);
      const matchesQuery = !q || (card.dataset.search || '').includes(q);
      const show = matchesRegion && matchesQuery;
      card.hidden = !show;
      if (show) visible += 1;
    }
    status.textContent = \`Mostrando \${visible} de \${cards.length} poemas verificados.\`;
  }

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      activeRegion = btn.dataset.filter || 'all';
      buttons.forEach((b) => b.classList.toggle('is-active', b === btn));
      applyFilters();
    });
  });
  search.addEventListener('input', applyFilters);
</script>
</body>
</html>
`;
}

const outDir = resolve(process.cwd(), 'metrica');
await mkdir(outDir, { recursive: true });
for (const existing of await readdir(outDir)) {
  if (existing.endsWith('.html')) await rm(resolve(outDir, existing));
}

const built = [];
for (const poem of poems) {
  const { rows, exactSinalefaOverrides } = buildVerifiedRows(poem);
  built.push({ poem, rows, exactSinalefaOverrides });
}

for (const { poem, rows, exactSinalefaOverrides } of built) {
  const html = renderPoemPage(poem, rows, exactSinalefaOverrides, poems);
  await writeFile(resolve(outDir, `${poem.slug}.html`), html, 'utf8');
}

await writeFile(resolve(outDir, 'index.html'), renderIndexPage(built), 'utf8');

// Export slugs for dynamic sitemap.xml.js and update static sitemap.xml
const slugs = poems.map((p) => p.slug);
await writeFile(
  resolve(process.cwd(), 'functions/_lib/classic-poem-slugs.js'),
  `export const CLASSIC_POEM_LASTMOD = '${publishedDate}';\nexport const CLASSIC_POEM_SLUGS = ${JSON.stringify(slugs, null, 2)};\n`,
  'utf8'
);

const staticUrls = [
  { loc: 'https://poesia.mimesa.dev/', lastmod: publishedDate },
  { loc: 'https://poesia.mimesa.dev/taller/', lastmod: publishedDate },
  { loc: 'https://poesia.mimesa.dev/separar-en-silabas-metricas', lastmod: publishedDate },
  { loc: 'https://poesia.mimesa.dev/separar-en-silabas', lastmod: publishedDate },
  { loc: 'https://poesia.mimesa.dev/metrica/', lastmod: publishedDate },
  ...slugs.map((s) => ({ loc: `https://poesia.mimesa.dev/metrica/${s}`, lastmod: publishedDate })),
  { loc: 'https://poesia.mimesa.dev/recursos', lastmod: '2026-11-22' },
  { loc: 'https://poesia.mimesa.dev/formas-poeticas', lastmod: '2026-11-22' },
  { loc: 'https://poesia.mimesa.dev/concursos-de-poesia', lastmod: '2026-11-22' },
  { loc: 'https://poesia.mimesa.dev/componer-versos', lastmod: '2026-11-22' },
  { loc: 'https://poesia.mimesa.dev/apoyar', lastmod: '2026-11-22' },
  { loc: 'https://poesia.mimesa.dev/agradecimientos', lastmod: '2026-11-22' },
  { loc: 'https://poesia.mimesa.dev/privacidad', lastmod: '2026-11-22' },
];
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${staticUrls
  .map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n  </url>`)
  .join('\n')}\n</urlset>\n`;
await writeFile(resolve(process.cwd(), 'sitemap.xml'), xml, 'utf8');

console.log(`Generadas ${built.length} páginas verificadas en metrica/ + metrica/index.html + sitemap.xml (${staticUrls.length} URLs).`);
