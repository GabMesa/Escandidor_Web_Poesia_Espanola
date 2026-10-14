export function poemTimestamp(value){const date=String(value??'');return Date.parse(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(date)?date.replace(' ','T')+'Z':date);}
﻿export function sortPoemVersions(versions) {
  return [...versions].sort((a, b) => {
    const left = poemTimestamp(a.savedAt);
    const right = poemTimestamp(b.savedAt);
    if (Number.isFinite(left) && Number.isFinite(right) && left !== right) return left - right;
    return (Number(a.versionNumber) || 0) - (Number(b.versionNumber) || 0);
  });
}

export function selectMarkdownEntries(entries, scope = 'all') {
  if (scope !== 'latest') return [...entries];
  const poems = new Map();
  for (const entry of entries) {
    const key = entry.poemKey ?? entry.title;
    const group = poems.get(key) ?? [];
    group.push(entry);
    poems.set(key, group);
  }
  return [...poems.values()].map(group => {
    const ranked = sortPoemVersions(group.map(entry => entry.version));
    return group.find(entry => entry.version === ranked.at(-1));
  });
}

export function buildHistoryMarkdown(entries) {
  const counts = new Map();
  for (const entry of entries) {
    const key = entry.poemKey ?? entry.title;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return entries.map(({ poemKey, title, version }) => {
    const history = counts.get(poemKey ?? title) > 1;
    const label = String(version.label || (version.isDraft ? 'Borrador actual' : `Versión ${Number(version.versionNumber) || 1}`));
    // Comments preserve the existing Markdown importer (# title followed by poem text).
    const metadata = history ? `<!-- ${label.replace(/--/g, '—')} -->\n\n` : '';
    return `# ${String(title || 'Poema').replace(/[\r\n]+/g, ' ')}\n\n${metadata}${String(version.poemText ?? '').replace(/\r\n?/g, '\n').trimEnd()}\n`;
  }).join('\n\n');
}

export function buildVideoTimeline(versions) {
  const timeline = [];
  for (const version of sortPoemVersions(versions)) {
    const text = String(version.poemText ?? '').replace(/\r\n?/g, '\n');
    if (timeline.at(-1)?.text === text) continue;
    timeline.push({ text, label: version.isDraft ? 'Borrador actual' : String(version.label || `Versión ${Number(version.versionNumber) || timeline.length + 1}`) });
  }
  return timeline;
}

export function interpolatePoemEdit(previous, next, progress) {
  if (progress >= 1) return next;
  if (progress <= 0) return previous;
  const before = Array.from(previous);
  const after = Array.from(next);
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix++;
  let suffix = 0;
  while (suffix < before.length - prefix && suffix < after.length - prefix && before[before.length - suffix - 1] === after[after.length - suffix - 1]) suffix++;
  const deleted = before.length - prefix - suffix;
  const inserted = after.length - prefix - suffix;
  const operations = deleted + inserted;
  const step = Math.min(operations, Math.floor(progress * operations));
  const start = after.slice(0, prefix).join('');
  const end = suffix ? before.slice(-suffix).join('') : '';
  const middle = step < deleted
    ? before.slice(prefix, before.length - suffix - step).join('')
    : after.slice(prefix, prefix + step - deleted).join('');
  return start + middle + end;
}
