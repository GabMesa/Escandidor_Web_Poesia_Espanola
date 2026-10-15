import { normalizeValidationWord } from './analyzer.js';
import { matchesRhymeSchemeArt } from './poetic-forms.js';

// Commas choose alternatives within a stanza; spaces or | separate stanzas.
export function parseRhymeSchemes(value) {
  const raw = String(value ?? '').trim().replace(/[´`’‘]/g, "'")
    .replace(/\s*,\s*/g, ',').replace(/\s*\|\s*/g, '|');
  if (!raw) return [];
  return raw.split(/[\s|]+/).map(stanza => stanza.split(',').map(pattern => {
    const tokens = pattern.match(/[A-Za-z]'?|-/g) ?? [];
    if (!tokens.length || tokens.join('') !== pattern) {
      throw new Error(`Esquema no válido: ${pattern || '(vacío)'}. Usa letras, primas y guiones.`);
    }
    return tokens;
  }));
}

function stanzasOf(runtimes) {
  const stanzas = [];
  for (const runtime of runtimes) {
    if (!runtime.lineAnalysis.text.trim()) continue;
    if (!stanzas.length || runtime.lineIndex > stanzas.at(-1).at(-1).lineIndex + 1) stanzas.push([]);
    stanzas.at(-1).push(runtime);
  }
  return stanzas;
}

function checkPattern(verses, tokens, { repeat, exact, shared, verseOffset }) {
  const families = new Map(shared);
  const keys = new Map([...families].map(([letter, key]) => [key, letter]));
  const statuses = new Map();
  const count = repeat || exact ? verses.length : Math.min(verses.length, tokens.length);
  for (let index = 0; index < count; index++) {
    const runtime = verses[index];
    const token = tokens[repeat ? index % tokens.length : index];
    const status = { valid: true, reasons: [], expectedLetter: token ?? '-', verseNumber: verseOffset + index + 1 };
    statuses.set(runtime.lineIndex, status);
    const fail = reason => { status.valid = false; status.reasons.push(reason); };
    if (!token) { fail('Este verso no tiene una posición en el esquema de la estrofa.'); continue; }
    if (token === '-') continue;
    const letter = token[0], family = letter.toUpperCase();
    if (token.endsWith("'") && !['aguda', 'monosílaba'].includes(runtime.lineAnalysis.accentType)) {
      fail(`La letra ${token} exige final aguda.`);
    }
    if (!matchesRhymeSchemeArt(letter, runtime.metricVerseCount)) {
      fail(`La letra ${letter} exige arte ${letter === family ? 'mayor (más de 8 sílabas)' : 'menor (8 sílabas o menos)'}; el verso tiene ${runtime.metricVerseCount}.`);
    }
    const key = normalizeValidationWord(runtime.rhyme?.activeKey ?? '');
    if (!key) { fail('No hay rima definida para este verso.'); continue; }
    if (families.has(family)) {
      if (families.get(family) !== key) fail(`Debe rimar como ${family}.`);
    } else if (keys.has(key) && keys.get(key) !== family) {
      fail(`La rima ya se usa en la letra ${keys.get(key)}.`);
    } else {
      families.set(family, key); keys.set(key, family);
    }
  }
  if (exact && verses.length < tokens.length && verses.length) {
    const status = statuses.get(verses.at(-1).lineIndex);
    status.valid = false;
    status.reasons.push(`La estrofa tiene ${verses.length} versos; este esquema necesita ${tokens.length}.`);
  }
  const failures = [...statuses.values()].filter(s => !s.valid).length;
  return { statuses, families, failures };
}

export function validateStanzaRhymeSchemes(runtimes, value, { repeat = false, sharedRhymes = false, wholePoem = false } = {}) {
  let blocks;
  try { blocks = parseRhymeSchemes(value); }
  catch (error) { return { valid: false, summary: error.message, scheme: String(value), lineStatus: new Map(), failingVerses: [] }; }
  const scheme = blocks.map(options => options.map(tokens => tokens.join('')).join(', ')).join(' | ');
  if (!blocks.length) return { valid: true, summary: 'Esquema libre', scheme, lineStatus: new Map(), failingVerses: [] };
  const allVerses = runtimes.filter(r => r.lineAnalysis.text.trim());
  const stanzas = stanzasOf(runtimes);
  // A single uninterrupted poem retains the traditional complete-poem notation.
  const flat = !repeat && (blocks.length === 1 || (wholePoem && stanzas.length <= 1 && blocks.every(b => b.length === 1)));
  const groups = flat ? [allVerses] : stanzas;
  const patterns = flat && blocks.length > 1 ? [[blocks.flatMap(b => b[0])]] : blocks;
  const offsets = groups.map((_, i) => groups.slice(0, i).reduce((n, group) => n + group.length, 0));
  const memo = new Map();
  // Try whole alternatives, retaining rhyme assignments when estrofas share them.
  const choose = (index, shared) => {
    if (index >= groups.length) return { statuses: new Map(), failures: 0 };
    const memoKey = `${index}:${JSON.stringify([...shared].sort())}`;
    if (memo.has(memoKey)) return memo.get(memoKey);
    const options = patterns[repeat ? index % patterns.length : index];
    if (!options) {
      const statuses = new Map(groups.slice(index).flat().map((r, i) => [r.lineIndex, {
        valid: false, reasons: ['Falta el esquema de esta estrofa.'], expectedLetter: '-', verseNumber: offsets[index] + i + 1
      }]));
      return { statuses, failures: statuses.size };
    }
    let best;
    for (const tokens of options) {
      const current = checkPattern(groups[index], tokens, {
        repeat, exact: !flat && !repeat, shared, verseOffset: offsets[index]
      });
      const next = choose(index + 1, sharedRhymes ? current.families : new Map());
      const candidate = { statuses: new Map([...current.statuses, ...next.statuses]), failures: current.failures + next.failures };
      if (!best || candidate.failures < best.failures) best = candidate;
      if (!best.failures) break;
    }
    memo.set(memoKey, best);
    return best;
  };
  const result = choose(0, new Map());
  const failingVerses = [...result.statuses.values()].filter(s => !s.valid).map(s => s.verseNumber);
  const missing = !flat && !repeat && blocks.length > stanzas.length;
  const valid = !failingVerses.length && !missing;
  const summary = missing ? `${scheme}: faltan estrofas en el poema` : failingVerses.length ? `${scheme}: falla v. ${failingVerses.join(', ')}` : scheme;
  return { valid, summary, scheme, lineStatus: result.statuses, failingVerses };
}
