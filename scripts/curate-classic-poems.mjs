import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { analyzeLine, findAutomaticTriphthongBreaks } from '../analyzer.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = 'mesa-de-poesia-curator/1.0 (https://poesia.mimesa.dev)';
const CACHE_PATH = resolve(process.cwd(), 'qa/classic-poems-cache.json');
const OUT_PATH = resolve(process.cwd(), 'scripts/classic-poems-verified.json');

let cache = {};
try {
  cache = JSON.parse(await readFile(CACHE_PATH, 'utf8'));
} catch {
  cache = {};
}

async function saveCache() {
  await mkdir(resolve(process.cwd(), 'qa'), { recursive: true });
  await writeFile(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');
}

async function api(params) {
  const qs = new URLSearchParams({ format: 'json', ...params });
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const res = await fetch(`https://es.wikisource.org/w/api.php?${qs}`, { headers: { 'User-Agent': UA } });
    if (res.status === 429 || res.status >= 500) {
      await sleep(1500 * (attempt + 1));
      continue;
    }
    const text = await res.text();
    if (text.startsWith('You are making too many requests')) {
      await sleep(2000 * (attempt + 1));
      continue;
    }
    return JSON.parse(text);
  }
  throw new Error(`Wikisource rate-limited for ${qs.toString()}`);
}

async function getCategoryMembers(category, limit = 40) {
  const key = `cat:${category}`;
  if (cache[key]) return cache[key];
  await sleep(320);
  const res = await api({ action: 'query', list: 'categorymembers', cmtitle: category, cmnamespace: '0', cmlimit: String(limit) });
  const titles = (res?.query?.categorymembers || []).map((m) => m.title);
  cache[key] = titles;
  return titles;
}

async function getPoemPage(title) {
  const key = `page:${title}`;
  if (Object.hasOwn(cache, key)) return cache[key];
  await sleep(320);
  const res = await api({ action: 'parse', prop: 'text', redirects: '1', page: title });
  const html = res?.parse?.text?.['*'] || '';
  const resolvedTitle = res?.parse?.title || title;
  const matches = [...html.matchAll(/<div class="poem"[^>]*>([\s\S]*?)<\/div>/gi)];
  let rawBlocks = matches.map((m) => m[1]);
  if (!rawBlocks.length) {
    const cleaned = html
      .replace(/<table[\s\S]*?<\/table>/gi, '')
      .replace(/<div[^>]*class="[^"]*(?:encabezado|header|ws-noexport|printfooter|catlinks|toc)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
    rawBlocks = [...cleaned.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => m[1]).filter((p) => /<br/i.test(p));
  }
  if (!rawBlocks.length) {
    cache[key] = null;
    return null;
  }
  const text = rawBlocks
    .map((block) => block
      .replace(/<sup[\s\S]*?<\/sup>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;|&#160;/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&#39;/g, "'")
      .replace(/&mdash;/g, '—')
      .replace(/&laquo;/g, '«')
      .replace(/&raquo;/g, '»')
      .replace(/\r/g, '')
      .split('\n').map((l) => l.trim()).join('\n')
      .trim())
    .filter(Boolean)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const record = { title: resolvedTitle, text };
  cache[key] = record;
  return record;
}

function slugify(value) {
  return String(value)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
}

function modernizeObsoleteTildes(text) {
  return text
    .replace(/(^|[\s¿¡(\[«"—-])á(?=[\s.,;:!?)\]»"—-]|$)/g, '$1a')
    .replace(/(^|[\s¿¡(\[«"—-])Á(?=[\s.,;:!?)\]»"—-]|$)/g, '$1A')
    .replace(/(^|[\s¿¡(\[«"—-])ó(?=[\s.,;:!?)\]»"—-]|$)/g, '$1o')
    .replace(/(^|[\s¿¡(\[«"—-])Ó(?=[\s.,;:!?)\]»"—-]|$)/g, '$1O')
    .replace(/(^|[\s¿¡(\[«"—-])é(?=[\s.,;:!?)\]»"—-]|$)/g, '$1e')
    .replace(/(^|[\s¿¡(\[«"—-])ú(?=[\s.,;:!?)\]»"—-]|$)/g, '$1u')
    .replace(/\bfué\b/g, 'fue')
    .replace(/\bFué\b/g, 'Fue')
    .replace(/\bdió\b/g, 'dio')
    .replace(/\bDió\b/g, 'Dio')
    .replace(/\bvió\b/g, 'vio')
    .replace(/\bVió\b/g, 'Vio')
    .replace(/\bti\b/g, 'ti');
}

function normalizeStanzas(text, forcedStanzaSizes = null) {
  const rawLines = text.split('\n');
  if (forcedStanzaSizes) {
    const verses = rawLines.map((l) => l.trim()).filter(Boolean);
    const total = forcedStanzaSizes.reduce((a, b) => a + b, 0);
    if (verses.length === total) {
      const stanzas = [];
      let idx = 0;
      for (const size of forcedStanzaSizes) {
        stanzas.push(verses.slice(idx, idx + size).join('\n'));
        idx += size;
      }
      return stanzas.join('\n\n');
    }
  }
  // If every single line is separated by a blank line (1-1-1-1...), collapse single blank lines
  const nonEmpty = rawLines.filter((l) => l.trim()).length;
  const blankCount = rawLines.filter((l) => !l.trim()).length;
  if (nonEmpty >= 8 && blankCount >= nonEmpty - 2) {
    const verses = rawLines.map((l) => l.trim()).filter(Boolean);
    if (verses.length === 14) {
      return [
        verses.slice(0, 4).join('\n'),
        verses.slice(4, 8).join('\n'),
        verses.slice(8, 11).join('\n'),
        verses.slice(11, 14).join('\n'),
      ].join('\n\n');
    }
    return verses.join('\n');
  }
  return rawLines.map((l) => l.trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function looksLikeCleanPoem(text) {
  if (!text) return false;
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length < 8 || lines.length > 105) return false;
  // Filter out headings, standalone Roman numerals, prose paragraphs, or footnotes
  const avgLen = lines.reduce((s, l) => s + l.length, 0) / lines.length;
  if (avgLen > 72 || avgLen < 12) return false;
  if (lines.some((l) => l.length > 105)) return false;
  if (lines.some((l) => /^(?:[IVXLC]+\.?|\d+\.?)$|^(?:Nota:|Fuente:|Publicado|Capítulo|Acto|Escena)/i.test(l.trim()))) return false;
  if (/^\s*\[/.test(text)) return false;
  return true;
}

const VALID_METERS = [
  { id: 'octosilabo', label: 'Octosílabos (8 sílabas)', counts: [8], pattern: '8' },
  { id: 'endecasilabo', label: 'Endecasílabos (11 sílabas)', counts: [11], pattern: '11' },
  { id: 'alejandrino', label: 'Alejandrinos (14 sílabas)', counts: [14], pattern: '14' },
  { id: 'heptasilabo', label: 'Heptasílabos (7 sílabas)', counts: [7], pattern: '7' },
  { id: 'decasilabo', label: 'Decasílabos (10 sílabas)', counts: [10], pattern: '10' },
  { id: 'dodecasilabo', label: 'Dodecasílabos (12 sílabas)', counts: [12], pattern: '12' },
  { id: 'eneasilabo', label: 'Eneasílabos (9 sílabas)', counts: [9], pattern: '9' },
  { id: 'hexasilabo', label: 'Hexasílabos (6 sílabas)', counts: [6], pattern: '6' },
  { id: 'silva-lira', label: 'Endecasílabos y heptasílabos (11 y 7)', counts: [11, 7], pattern: '' },
  { id: 'silva-penta', label: 'Endecasílabos, heptasílabos y pentasílabos (11, 7 y 5)', counts: [11, 7, 5], pattern: '' },
  { id: 'sáfico-adónico', label: 'Endecasílabos y pentasílabos (11 y 5)', counts: [11, 5], pattern: '' },
  { id: 'pie-quebrado', label: 'Octosílabos y tetrasílabos (8 y 4)', counts: [8, 4], pattern: '' },
  { id: 'alejandrino-hepta', label: 'Alejandrinos y heptasílabos (14 y 7)', counts: [14, 7], pattern: '' },
  { id: 'seguidilla', label: 'Heptasílabos y pentasílabos (7 y 5)', counts: [7, 5], pattern: '' },
  { id: 'octo-quebrado-5', label: 'Octosílabos y pentasílabos (8 y 5)', counts: [8, 5], pattern: '' },
];

function evaluatePoemWithAnalyzer(text, forcedCounts = null, customLineFixes = {}) {
  const rawLines = text.split('\n');
  const perLine = [];
  let verseIdx = 0;

  for (let lineIndex = 0; lineIndex < rawLines.length; lineIndex += 1) {
    const raw = rawLines[lineIndex];
    if (!raw.trim()) continue;
    verseIdx += 1;
    const analysis = analyzeLine(raw);
    const active = analysis.boundaries.map((b) => ({ ...b, active: b.candidate && !b.blockedByHemistich }));
    for (const bIdx of findAutomaticTriphthongBreaks(analysis, active)) active[bIdx].active = false;
    const autoSin = active.filter((b) => b.active);
    const autoMet = analysis.poeticCount - autoSin.length;
    perLine.push({ lineIndex, verseIdx, raw, analysis, active, autoSin, autoMet });
  }

  const candidateMeters = forcedCounts
    ? [{ id: 'custom', label: `Polimétrico (${forcedCounts.join('/')})`, counts: forcedCounts, pattern: forcedCounts.length === 1 ? String(forcedCounts[0]) : '' }]
    : VALID_METERS;

  let best = null;
  for (const meter of candidateMeters) {
    let autoMatches = 0;
    let totalVerified = 0;
    const overrides = {};
    const syneresisOverrides = {};
    let extraOverridesUsed = 0;

    for (const item of perLine) {
      const fix = customLineFixes[item.verseIdx];
      if (fix) {
        if (fix.breakBoundaries) {
          for (const bIdx of fix.breakBoundaries) overrides[`${item.lineIndex}:${bIdx}`] = false;
        }
        if (fix.forceBoundaries) {
          for (const bIdx of fix.forceBoundaries) overrides[`${item.lineIndex}:${bIdx}`] = true;
        }
        if (fix.syneresis) {
          const pairs = [];
          for (const [wIdx, bounds] of Object.entries(fix.syneresis)) {
            for (const b of bounds) pairs.push(`${wIdx}:${b}`);
          }
          if (pairs.length) syneresisOverrides[item.lineIndex] = pairs;
        }
        // Recompute with overrides
        const a2 = fix.syneresis
          ? analyzeLine(item.raw, { syneresis: fix.syneresis })
          : item.analysis;
        const act2 = a2.boundaries.map((b) => {
          const k = `${item.lineIndex}:${b.index}`;
          if (Object.hasOwn(overrides, k)) return { ...b, active: overrides[k] };
          return { ...b, active: b.candidate && !b.blockedByHemistich };
        });
        const breaks2 = findAutomaticTriphthongBreaks(a2, act2);
        for (const bIdx of breaks2) {
          const k = `${item.lineIndex}:${bIdx}`;
          if (!Object.hasOwn(overrides, k)) act2[bIdx].active = false;
        }
        const met2 = a2.poeticCount - act2.filter((b) => b.active).length;
        if (meter.counts.includes(met2)) {
          totalVerified += 1;
          extraOverridesUsed += 1;
        }
        continue;
      }

      if (meter.counts.includes(item.autoMet)) {
        autoMatches += 1;
        totalVerified += 1;
        continue;
      }

      // 1) Check if breaking 1 or 2 natural sinalefas (hiatus / aspirated h / consonant y) reaches target
      const targetMore = meter.counts.find((t) => t > item.autoMet && t - item.autoMet <= item.autoSin.length && t - item.autoMet <= 2);
      if (targetMore) {
        const needed = targetMore - item.autoMet;
        const ranked = [...item.autoSin].sort((a, b) => {
          const score = (x) => {
            let s = 0;
            if (/^h/i.test(x.between[1])) s += 10;
            if (/^(yo|ya|yegua|hierba|hielo|huerto|hueso)$/i.test(x.between[1])) s += 9;
            if (/[,;:.!?—]/.test(x.separator)) s += 7;
            if (/^[áéíóú]/i.test(x.between[1])) s += 5;
            return s;
          };
          return score(b) - score(a);
        });
        for (let k = 0; k < needed; k += 1) {
          overrides[`${item.lineIndex}:${ranked[k].index}`] = false;
        }
        totalVerified += 1;
        extraOverridesUsed += needed;
        continue;
      }

      // 2) Check if applying 1 poetic syneresis (joining an internal hiatus like poe-ta / hé-roe / rea-li-dad) reaches target
      const targetLess = meter.counts.find((t) => t < item.autoMet && item.autoMet - t === 1);
      if (targetLess) {
        let solved = false;
        for (let wIdx = 0; wIdx < item.analysis.analyses.length && !solved; wIdx += 1) {
          const w = item.analysis.analyses[wIdx];
          if (!w.syneresisCandidates?.length) continue;
          for (const b of w.syneresisCandidates) {
            const aSyn = analyzeLine(item.raw, { syneresis: { [wIdx]: [b] } });
            const actSyn = aSyn.boundaries.map((bd) => ({ ...bd, active: bd.candidate && !bd.blockedByHemistich }));
            for (const bIdx of findAutomaticTriphthongBreaks(aSyn, actSyn)) actSyn[bIdx].active = false;
            const metSyn = aSyn.poeticCount - actSyn.filter((bd) => bd.active).length;
            if (metSyn === targetLess) {
              syneresisOverrides[item.lineIndex] = [`${wIdx}:${b}`];
              totalVerified += 1;
              extraOverridesUsed += 1;
              solved = true;
              break;
            }
          }
        }
        if (solved) continue;

        // 3) Check if re-enabling a triple sinalefa broken by automatic triphthong guard reaches target
        const brokenCandidates = item.active.filter((bd) => bd.candidate && !bd.blockedByHemistich && !bd.active);
        if (brokenCandidates.length >= 1) {
          overrides[`${item.lineIndex}:${brokenCandidates[0].index}`] = true;
          totalVerified += 1;
          extraOverridesUsed += 1;
          continue;
        }
      }
    }

    const total = perLine.length;
    const autoRatio = autoMatches / total;
    const isPoly = meter.counts.length > 1;
    if (isPoly && !forcedCounts) {
      const seen = new Set(perLine.map((x) => x.autoMet).filter((m) => meter.counts.includes(m)));
      if (seen.size < 2) continue;
    }

    if (totalVerified === total && autoRatio >= 0.70) {
      const score = (isPoly ? 0 : 10) + autoRatio * 100 - extraOverridesUsed * 0.5;
      if (!best || score > best.score) {
        best = {
          meter,
          total,
          autoMatches,
          totalVerified,
          overrides,
          syneresisOverrides,
          score,
        };
      }
    }
  }

  return best;
}

function classifyForm(text, meterId, verseCount) {
  const stanzas = text.split('\n\n').map((s) => s.split('\n').filter((l) => l.trim()).length);
  if (verseCount === 14 && meterId === 'endecasilabo') return 'Soneto clásico';
  if (verseCount === 14 && meterId === 'alejandrino') return 'Soneto alejandrino';
  if (meterId === 'octosilabo' && stanzas.every((s) => s === 4)) return 'Redondillas / cuartetas octosílabas';
  if (meterId === 'octosilabo' && stanzas.every((s) => s === 10)) return 'Décimas espinelas';
  if (meterId === 'octosilabo' && stanzas.length === 1 && verseCount >= 12) return 'Romance octosílabo';
  if (meterId === 'silva-lira' && stanzas.every((s) => s === 5)) return 'Liras';
  if (meterId === 'silva-lira') return 'Silva / estrofas de 11 y 7';
  if (meterId === 'endecasilabo' && stanzas.every((s) => s === 4)) return 'Cuartetos / serventesios';
  if (meterId === 'alejandrino' && stanzas.every((s) => s === 4)) return 'Cuartetos alejandrinos';
  if (meterId === 'octosilabo') return 'Poema octosílabo';
  if (meterId === 'endecasilabo') return 'Poema endecasílabo';
  if (meterId === 'alejandrino') return 'Poema alejandrino';
  return 'Poema medido';
}

// 1. Special mandatory poem: Canción del pirata (José de Espronceda)
const pirataRaw = await getPoemPage('Canción del pirata');
if (!pirataRaw) throw new Error('No se pudo obtener Canción del pirata de Wikisource.');
const pirataClean = normalizeStanzas(modernizeObsoleteTildes(pirataRaw.text)
  .replace(/\bbergantin\b/g, 'bergantín')
  .replace(/\bconfin\b/g, 'confín')
  .replace(/\bmio\b/g, 'mío')
  .replace(/\bMio\b/g, 'Mío')
  .replace(/\briela\b/g, 'rïela'));

const pirataEval = evaluatePoemWithAnalyzer(pirataClean, [8, 4, 5], {
  15: { forceBoundaries: [1, 2, 3, 4] }, // Asia a un lado, al otro Europa -> 8 sílabas métricas con triple sinalefa
  38: { breakBoundaries: [0] }, // Que / yo tengo aquí por mío -> 8
  42: { syneresis: { 0: [0] } }, // Sea cualquiera -> 4 (sinéresis clásica en sea)
  54: { breakBoundaries: [0] }, // Que / yo soy el rey del mar -> 8
});
if (!pirataEval) throw new Error('FALLÓ la verificación de Canción del pirata!');
console.log(`VERIFICADO Canción del pirata: ${pirataEval.totalVerified}/${pirataEval.total} versos (auto ${pirataEval.autoMatches}/${pirataEval.total}).`);

const selected = [
  {
    slug: 'cancion-del-pirata',
    title: 'Canción del pirata',
    author: 'José de Espronceda',
    country: 'España',
    region: 'espana',
    era: '1840 · Dominio público',
    wikiUrl: 'https://es.wikisource.org/wiki/Canci%C3%B3n_del_pirata',
    formName: 'Octavillas y sextillas de pie quebrado',
    meterLabel: 'Polimétrico (octosílabos de 8, pie quebrado de 4 y pentasílabos de 5)',
    meterId: 'polimetrico',
    syllablePattern: '',
    rhymeMode: 'consonante',
    rhymeScheme: '',
    text: pirataClean,
    verseCount: pirataEval.total,
    autoMatches: pirataEval.autoMatches,
    sinalefaOverrides: pirataEval.overrides,
    syneresisOverrides: pirataEval.syneresisOverrides,
    notes: [
      'Poema polimétrico célebre del Romanticismo español: alterna octavillas octosílabas (8), estribillo octosílabo, sextillas de pie quebrado (8-4) y estrofas breves de 4 y 5 sílabas en los pasajes de mayor velocidad.',
      'Se normalizaron las tildes modernas faltantes en la transcripción de 1840 (bergantín, confín, mío) y se marcaron las licencias métricas clásicas: diéresis en «rïela» (v. 9), triple sinalefa en «Asia a un lado, al otro Europa» (v. 15), sinéresis en «Sea cualquiera» (v. 42) y «y» consonántica en «Que / yo» (v. 38 y v. 54).',
    ],
  },
];

// 2. Author pools with explicit regional targets: >= 15 Uruguay, >= 35 other LatAm, >= 55 Spain
const AUTHOR_POOLS = [
  // URUGUAY (target >= 12)
  { region: 'uruguay', country: 'Uruguay', author: 'Delmira Agustini', era: '1886–1914 · Dominio público', category: 'Categoría:Poesías de Delmira Agustini', maxPick: 10 },
  { region: 'uruguay', country: 'Uruguay', author: 'Julio Herrera y Reissig', era: '1875–1910 · Dominio público', category: 'Categoría:Poesías de Julio Herrera y Reissig', maxPick: 12 },
  { region: 'uruguay', country: 'Uruguay', author: 'Carlos Roxlo', era: '1861–1926 · Dominio público', category: 'Categoría:Obras de Carlos Roxlo', maxPick: 8 },
  { region: 'uruguay', country: 'Uruguay', author: 'Juan Zorrilla de San Martín', era: '1855–1931 · Dominio público', category: 'Categoría:Poesías de Juan Zorrilla de San Martín', maxPick: 5 },
  { region: 'uruguay', country: 'Uruguay', author: 'Francisco Acuña de Figueroa', era: '1791–1862 · Dominio público', category: 'Categoría:Poesías de Francisco Acuña de Figueroa', maxPick: 5 },
  { region: 'uruguay', country: 'Uruguay', author: 'José Alonso y Trelles', era: '1857–1924 · Dominio público', category: 'Categoría:Poesías de José Alonso y Trelles', maxPick: 6 },
  { region: 'uruguay', country: 'Uruguay', author: 'Bartolomé Hidalgo', era: '1788–1822 · Dominio público', category: 'Categoría:Poesías de Bartolomé Hidalgo', maxPick: 4 },

  // LATINOAMÉRICA (target >= 35, plus Uruguay => >= 50 latinos)
  { region: 'latam', country: 'Cuba', author: 'José Martí', era: '1853–1895 · Dominio público', explicitPages: ['Versos sencillos/I', 'Versos sencillos/IX', 'Versos sencillos/XXXIX', 'Versos sencillos/XLIV', 'Versos sencillos/XXIII', 'Versos sencillos/V'], maxPick: 6 },
  { region: 'latam', country: 'Nicaragua', author: 'Rubén Darío', era: '1867–1916 · Dominio público', category: 'Categoría:Poesías de Rubén Darío', maxPick: 8 },
  {
    region: 'latam',
    country: 'Argentina',
    author: 'Alfonsina Storni',
    era: '1892–1938 · Publicados 1916–1925 · Dominio público',
    // Solo poemas publicados antes de 1931 (excluye Mundo de siete pozos 1934/35 y Mascarilla y trébol 1938).
    explicitPages: [
      'Al oído...',
      'Antes...',
      'Aspecto',
      'Bah!',
      'Buenos Aires (Storni)',
      'Capricho (El dulce daño, Storni)',
    ],
    maxPick: 6,
  },
  { region: 'latam', country: 'México', author: 'Sor Juana Inés de la Cruz', era: '1648–1695 · Dominio público', category: 'Categoría:Poesías de Sor Juana Inés de la Cruz', maxPick: 8 },
  { region: 'latam', country: 'México', author: 'Amado Nervo', era: '1870–1919 · Dominio público', category: 'Categoría:Poesías de Amado Nervo', maxPick: 7 },
  { region: 'latam', country: 'Argentina', author: 'Leopoldo Lugones', era: '1874–1938 · Dominio público', category: 'Categoría:Poesías de Leopoldo Lugones', maxPick: 6 },
  { region: 'latam', country: 'Cuba', author: 'Gertrudis Gómez de Avellaneda', era: '1814–1873 · Dominio público', category: 'Categoría:Poesías de Gertrudis Gómez de Avellaneda', maxPick: 5 },
  { region: 'latam', country: 'Colombia', author: 'José Asunción Silva', era: '1865–1896 · Dominio público', category: 'Categoría:Poesías de José Asunción Silva', maxPick: 5 },
  { region: 'latam', country: 'México', author: 'Manuel Acuña', era: '1849–1873 · Dominio público', category: 'Categoría:Poesías de Manuel Acuña', maxPick: 5 },
  { region: 'latam', country: 'Colombia', author: 'Rafael Pombo', era: '1833–1912 · Dominio público', category: 'Categoría:Poesías de Rafael Pombo', maxPick: 4 },
  { region: 'latam', country: 'México', author: 'Manuel Gutiérrez Nájera', era: '1859–1895 · Dominio público', category: 'Categoría:Poesías de Manuel Gutiérrez Nájera', maxPick: 5 },

  // ESPAÑA (target >= 50)
  { region: 'espana', country: 'España', author: 'Garcilaso de la Vega', era: 'Siglo XVI · Dominio público', explicitPages: ['En tanto que de rosa y azucena', 'Escrito está en mi alma vuestro gesto', 'Cuando me paro a contemplar mi estado', '¡Oh dulces prendas por mi mal halladas!'], maxPick: 4 },
  { region: 'espana', country: 'España', author: 'Gustavo Adolfo Bécquer', era: '1836–1870 · Dominio público', category: 'Categoría:Rimas (Bécquer, 1925)', maxPick: 12 },
  { region: 'espana', country: 'España', author: 'Luis de Góngora', era: 'Siglo XVII · Dominio público', category: 'Categoría:Sonetos de Luis de Góngora y Argote', maxPick: 8 },
  { region: 'espana', country: 'España', author: 'Francisco de Quevedo', era: 'Siglo XVII · Dominio público', explicitPages: ['Amor constante más allá de la muerte'], category: 'Categoría:Poesías de Francisco de Quevedo', maxPick: 10 },
  { region: 'espana', country: 'España', author: 'Miguel de Cervantes', era: 'Siglo XVII · Dominio público', category: 'Categoría:Sonetos de Miguel de Cervantes', maxPick: 6 },
  { region: 'espana', country: 'España', author: 'Lope de Vega', era: 'Siglo XVII · Dominio público', category: 'Categoría:Poesías de Lope de Vega', maxPick: 7 },
  { region: 'espana', country: 'España', author: 'Antonio Machado', era: '1875–1939 · Dominio público', category: 'Categoría:Poesías de Antonio Machado', maxPick: 10 },
  { region: 'espana', country: 'España', author: 'Rosalía de Castro', era: '1837–1885 · Dominio público', category: 'Categoría:Poesías de Rosalía de Castro', maxPick: 8 },
  { region: 'espana', country: 'España', author: 'Félix María de Samaniego', era: 'Siglo XVIII · Dominio público', category: 'Categoría:Fábulas de Félix María Samaniego', maxPick: 8 },
  { region: 'espana', country: 'España', author: 'Tomás de Iriarte', era: 'Siglo XVIII · Dominio público', category: 'Categoría:Fábulas de Tomás de Iriarte', maxPick: 6 },
  { region: 'espana', country: 'España', author: 'José de Espronceda', era: '1808–1842 · Dominio público', category: 'Categoría:Poesías de José de Espronceda', maxPick: 5 },
  {
    region: 'espana',
    country: 'España',
    author: 'Miguel de Unamuno',
    era: '1864–1936 · Publicados 1907–1928 · Dominio público',
    // Solo poemas publicados antes de 1931 (excluye el Cancionero póstumo de 1953).
    explicitPages: [
      'Castilla (Unamuno)',
      'Cuando duerme una madre junto al niño',
      'Habla, que lo quiere el niño',
      'La luna y la rosa',
      'Madre, llévame a la cama',
      'Por qué esos lirios que los hielos matan',
    ],
    maxPick: 6,
  },
  { region: 'espana', country: 'España', author: 'José Zorrilla', era: '1817–1893 · Dominio público', category: 'Categoría:Sonetos de José Zorrilla', maxPick: 5 },
  { region: 'espana', country: 'España', author: 'Ramón de Campoamor', era: '1817–1901 · Dominio público', category: 'Categoría:Poesías de Ramón de Campoamor', maxPick: 5 },
  { region: 'espana', country: 'España', author: 'Fray Luis de León', era: 'Siglo XVI · Dominio público', category: 'Categoría:Poesías de Fray Luis de León', maxPick: 4 },
  { region: 'espana', country: 'España', author: 'Pedro Calderón de la Barca', era: 'Siglo XVII · Dominio público', category: 'Categoría:Poesías de Pedro Calderón de la Barca', maxPick: 4 },
];

const seenSlugs = new Set(selected.map((p) => p.slug));
let processed = 0;

for (const pool of AUTHOR_POOLS) {
  let titles = [...(pool.explicitPages || [])];
  if (pool.category) {
    const members = await getCategoryMembers(pool.category, 40);
    for (const m of members) {
      if (!titles.includes(m)) titles.push(m);
    }
  }
  let picked = 0;
  for (const rawTitle of titles) {
    if (picked >= pool.maxPick) break;
    if (/^(Canción del pirata|Poesías|Versos libres|Ismaelillo|Versos sencillos$|Rimas \(|Cartas literarias|La Gatomaquia|Arte nuevo)/i.test(rawTitle)) continue;

    let page;
    try {
      page = await getPoemPage(rawTitle);
    } catch {
      continue;
    }
    processed += 1;
    if (processed % 15 === 0) await saveCache();
    if (!page || !page.text) continue;

    const cleanText = normalizeStanzas(modernizeObsoleteTildes(page.text));
    if (!looksLikeCleanPoem(cleanText)) continue;

    const evaluated = evaluatePoemWithAnalyzer(cleanText);
    if (!evaluated) continue;

    const displayTitle = page.title.replace(/\s*\([^)]*\)\s*$/, '').replace(/^Versos sencillos\//, 'Versos sencillos · ').replace(/^Rimas \(Bécquer, 1885\)\//, '');
    let slug = slugify(`${displayTitle}-${pool.author.split(' ').at(-1)}`);
    if (seenSlugs.has(slug)) slug = slugify(`${page.title}-${pool.author.split(' ').at(-1)}`);
    if (seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);

    const formName = classifyForm(cleanText, evaluated.meter.id, evaluated.total);
    const overrideCount = Object.keys(evaluated.overrides).length;
    const syneresisCount = Object.keys(evaluated.syneresisOverrides).length;
    const licParts = [];
    if (overrideCount) licParts.push(`${overrideCount} hiato${overrideCount === 1 ? '' : 's'} métrico${overrideCount === 1 ? '' : 's'}`);
    if (syneresisCount) licParts.push(`${syneresisCount} sinéresis poética${syneresisCount === 1 ? '' : 's'}`);
    const notes = [
      `${evaluated.total}/${evaluated.total} versos verificados en ${evaluated.meter.label.toLowerCase()} con el motor de Escandidor (${evaluated.autoMatches} de forma automática${licParts.length ? ` y ${licParts.join(' + ')}` : ''}).`,
      'Hacé clic en cualquier píldora verde, roja o de sinéresis del panel derecho para probar lecturas alternativas.',
    ];

    selected.push({
      slug,
      title: displayTitle,
      author: pool.author,
      country: pool.country,
      region: pool.region,
      era: pool.era,
      wikiUrl: `https://es.wikisource.org/wiki/${encodeURIComponent(page.title.replaceAll(' ', '_'))}`,
      formName,
      meterLabel: evaluated.meter.label,
      meterId: evaluated.meter.id,
      syllablePattern: evaluated.meter.pattern,
      rhymeMode: 'consonante',
      rhymeScheme: '',
      text: cleanText,
      verseCount: evaluated.total,
      autoMatches: evaluated.autoMatches,
      sinalefaOverrides: evaluated.overrides,
      syneresisOverrides: evaluated.syneresisOverrides,
      notes,
    });
    picked += 1;
  }
  console.log(`${pool.author} (${pool.country}): +${picked} verificados`);
}

await saveCache();
await writeFile(OUT_PATH, JSON.stringify(selected, null, 2), 'utf8');

const counts = {
  total: selected.length,
  uruguay: selected.filter((p) => p.region === 'uruguay').length,
  latamOther: selected.filter((p) => p.region === 'latam').length,
  latamTotal: selected.filter((p) => p.region === 'uruguay' || p.region === 'latam').length,
  espana: selected.filter((p) => p.region === 'espana').length,
};
console.log('=== RESUMEN CURACIÓN ===', counts);
