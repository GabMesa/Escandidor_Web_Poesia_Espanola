import { POETIC_FORM_PRESETS } from './poetic-forms.js';

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function slugifyHeading(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'seccion';
}

const FORM_GROUPS = {
  cortas: ['pareado', 'terceto', 'tercetillo', 'cuarteto', 'serventesio', 'redondilla', 'cuarteta', 'copla', 'seguidilla', 'cuadernaVia'],
  medianas: ['quinteto', 'quintilla', 'lira', 'pieQuebrado', 'octavaReal', 'octavilla', 'decima'],
  poemas: ['soneto', 'romance', 'silva', 'silvaArromanzada', 'sextina'],
};

const FORM_NOTES = {
  pareado: 'Dos versos que riman entre sí; útil para remates o epigramas.',
  terceto: 'Tres versos de arte mayor (clásico en cadenas encadenadas).',
  tercetillo: 'Tres versos de arte menor con rima consonante.',
  cuarteto: 'Cuatro versos de arte mayor con rima abrazada (ABBA).',
  serventesio: 'Cuatro versos de arte mayor con rima alterna (ABAB).',
  redondilla: 'Cuatro octosílabos con rima consonante abrazada (abba).',
  cuarteta: 'Cuatro octosílabos con rima consonante alterna (abab).',
  copla: 'Cuatro octosílabos con rima asonante en los pares.',
  seguidilla: 'Alterna heptasílabos y pentasílabos; muy ligada al canto popular.',
  cuadernaVia: 'Cuatro alejandrinos (7+7) con una sola rima consonante.',
  quinteto: 'Cinco versos de arte mayor con rima consonante.',
  quintilla: 'Cinco octosílabos de rima consonante.',
  lira: 'Combina heptasílabos y endecasílabos (7-11-7-7-11).',
  pieQuebrado: 'Octosílabos quebrados por tetrasílabos (copla manriqueña).',
  octavaReal: 'Ocho endecasílabos cerrados por un pareado final.',
  octavilla: 'Ocho octosílabos de rima consonante.',
  decima: 'Diez octosílabos con estructura abbaaccddc (espinela).',
  soneto: 'Catorce endecasílabos en dos cuartetos y dos tercetos.',
  romance: 'Serie indefinida de octosílabos con rima asonante en pares.',
  silva: 'Serie libre de heptasílabos y endecasílabos en rima consonante.',
  silvaArromanzada: 'Heptasílabos y endecasílabos con rima asonante en pares.',
  sextina: 'Seis estrofas de seis endecasílabos y remate de tres repitiendo seis palabras finales.',
};

const RHYME_LABELS = {
  consonante: 'Consonante',
  asonante: 'Asonante',
  'palabra-final': 'Palabra final',
};

function sanitizeHref(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  if (value.startsWith('/') || value.startsWith('#')) return value;
  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.href;
  } catch {}
  return '';
}

function renderFormsTable(groupKey) {
  const keys = groupKey === 'todas'
    ? [...FORM_GROUPS.cortas, ...FORM_GROUPS.medianas, ...FORM_GROUPS.poemas]
    : (FORM_GROUPS[groupKey] || []);
  if (!keys.length) return '';
  const rows = keys.map((key) => {
    const preset = POETIC_FORM_PRESETS[key];
    if (!preset) return '';
    const verses = preset.verseCount ? `${preset.verseCount}` : 'Serie abierta';
    const syllables = preset.syllablePattern
      ? `${preset.syllablePattern}${preset.hemistichSplit ? ` (${preset.hemistichSplit}+${preset.hemistichSplit})` : ''}`
      : 'Libre / según metro';
    const rhyme = preset.rhymeScheme
      ? `<code>${escapeHtml(preset.rhymeScheme)}</code> · ${escapeHtml(RHYME_LABELS[preset.rhymeMode] || preset.rhymeMode)}`
      : escapeHtml(RHYME_LABELS[preset.rhymeMode] || 'Flexible');
    return `<tr><td class="form-name">${escapeHtml(preset.label)}</td><td>${escapeHtml(verses)}</td><td>${escapeHtml(syllables)}</td><td>${rhyme}</td><td>${escapeHtml(FORM_NOTES[key] || '')}</td></tr>`;
  }).join('');
  return `<div class="table-wrap"><table class="forms-table"><thead><tr><th>Forma</th><th>Versos</th><th>Sílabas</th><th>Rima</th><th>Referencia rápida</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderInline(raw) {
  const tokens = [];
  const stash = (html) => {
    const idx = tokens.length;
    tokens.push(html);
    return `\u0000T${idx}\u0000`;
  };

  let text = String(raw ?? '');

  // Inline code first so Markdown syntax inside code stays literal
  text = text.replace(/`([^`]+)`/g, (_, code) => stash(`<code>${escapeHtml(code)}</code>`));

  // Links [label](url)
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
    const safeUrl = sanitizeHref(url);
    const labelHtml = renderEmphasis(escapeHtml(label));
    if (!safeUrl) return labelHtml;
    const isExternal = /^https?:\/\//i.test(safeUrl);
    const arrow = isExternal && !label.includes('↗') ? ' ↗' : '';
    const attrs = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
    return stash(`<a href="${escapeHtml(safeUrl)}"${attrs}>${labelHtml}${arrow}</a>`);
  });

  text = renderEmphasis(escapeHtml(text));
  return text.replace(/\u0000T(\d+)\u0000/g, (_, idx) => tokens[Number(idx)] || '');
}

function renderEmphasis(escaped) {
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>');
}

function renderEmbed(line) {
  const trimmed = line.trim();
  const formsMatch = trimmed.match(/^\{\{formas:(cortas|medianas|poemas|todas)\}\}$/i);
  if (formsMatch) return renderFormsTable(formsMatch[1].toLowerCase());

  const ctaMatch = trimmed.match(/^\{\{cta:([^|}]+)\|([^}]+)\}\}$/i);
  if (ctaMatch) {
    const href = sanitizeHref(ctaMatch[1]);
    if (!href) return '';
    const isExternal = /^https?:\/\//i.test(href);
    const attrs = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
    const label = ctaMatch[2].trim();
    const arrow = label.includes('↗') ? '' : ' ↗';
    return `<p><a class="cta" href="${escapeHtml(href)}"${attrs}>${escapeHtml(label)}${arrow}</a></p>`;
  }

  const calloutMatch = trimmed.match(/^\{\{aviso:([^|}]+)\|([^|}]+)\|([^}]+)\}\}$/i);
  if (calloutMatch) {
    const href = sanitizeHref(calloutMatch[1]);
    const buttonLabel = calloutMatch[2].trim();
    const bodyText = calloutMatch[3].trim();
    const isExternal = /^https?:\/\//i.test(href);
    const attrs = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
    const arrow = buttonLabel.includes('↗') ? '' : ' ↗';
    return `<div class="workshop-callout"><p>${renderInline(bodyText)}</p>${href ? `<a class="cta" href="${escapeHtml(href)}"${attrs}>${escapeHtml(buttonLabel)}${arrow}</a>` : ''}</div>`;
  }

  return null;
}

function isTableSeparator(line) {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
}

function splitTableRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}

export function renderEditorialMarkdown(markdown) {
  const lines = String(markdown ?? '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  const usedIds = new Set();
  let i = 0;

  const uniqueId = (base) => {
    let candidate = slugifyHeading(base);
    let n = 2;
    while (usedIds.has(candidate)) {
      candidate = `${slugifyHeading(base)}-${n}`;
      n += 1;
    }
    usedIds.add(candidate);
    return candidate;
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // Custom embeds {{formas:...}}, {{cta:...}}, {{aviso:...}}
    const embed = renderEmbed(trimmed);
    if (embed !== null) {
      if (embed) out.push(embed);
      i += 1;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      out.push('<hr>');
      i += 1;
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const rawText = headingMatch[2].trim();
      const idAttr = level === 2 ? ` id="${escapeHtml(uniqueId(rawText))}"` : '';
      out.push(`<h${level}${idAttr}>${renderInline(rawText)}</h${level}>`);
      i += 1;
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      const quoteLines = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i += 1;
      }
      out.push(`<blockquote class="verse-example">${quoteLines.map((q) => renderInline(q)).join('<br>')}</blockquote>`);
      continue;
    }

    // Markdown table
    if (trimmed.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = splitTableRow(trimmed);
      i += 2;
      const bodyRows = [];
      while (i < lines.length && lines[i].trim().includes('|') && lines[i].trim() !== '') {
        bodyRows.push(splitTableRow(lines[i]));
        i += 1;
      }
      out.push(
        `<div class="table-wrap"><table class="forms-table"><thead><tr>${headers.map((h) => `<th>${renderInline(h)}</th>`).join('')}</tr></thead><tbody>${bodyRows.map((row) => `<tr>${row.map((cell) => `<td>${renderInline(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
      );
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(`<li>${renderInline(lines[i].trim().replace(/^[-*]\s+/, ''))}</li>`);
        i += 1;
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(`<li>${renderInline(lines[i].trim().replace(/^\d+\.\s+/, ''))}</li>`);
        i += 1;
      }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    // Paragraph (coalesce contiguous plain text lines)
    const paraLines = [];
    while (i < lines.length) {
      const current = lines[i].trim();
      if (
        !current ||
        /^#{1,4}\s+/.test(current) ||
        /^[-*]\s+/.test(current) ||
        /^\d+\.\s+/.test(current) ||
        current.startsWith('>') ||
        /^(-{3,}|\*{3,}|_{3,})$/.test(current) ||
        renderEmbed(current) !== null ||
        (current.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1]))
      ) {
        break;
      }
      paraLines.push(current);
      i += 1;
    }
    out.push(`<p>${paraLines.map((p) => renderInline(p)).join('<br>')}</p>`);
  }

  return out.join('\n');
}
