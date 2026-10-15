export function isValidPoemTitle(value) {
  const title = String(value ?? '').trim().normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ');
  return Boolean(title) && title !== 'sin titulo';
}

export function hasPoemContent(value) {
  return typeof value === 'string' && Boolean(value.trim());
}

export function samePoemContent(left, right) {
  const normalize = value => String(value ?? '').replace(/\r\n?/g, '\n').trimEnd();
  return normalize(left) === normalize(right);
}

export function poemValidationError(title, content) {
  if (!isValidPoemTitle(title)) return 'Escribe un título para guardar el poema. «Sin título» no es un título válido.';
  if (!hasPoemContent(content)) return 'Escribe al menos un verso para guardar el poema.';
  return '';
}

// Keep old untitled poems with content: they can still be opened, exported and renamed.
export function cleanEmptyPoemVersions(memory) {
  const poems = {};
  const trash = {};
  let removed = 0;
  for (const [key, entries] of Object.entries(memory?.poems || {})) {
    if (!Array.isArray(entries)) continue;
    const versions = entries.filter(entry => hasPoemContent(entry?.poemText));
    removed += entries.length - versions.length;
    if (versions.length) poems[key] = versions;
  }
  for (const [key, groups] of Object.entries(memory?.trash || {})) {
    if (!Array.isArray(groups)) continue;
    const cleanedGroups = [];
    for (const group of groups) {
      const entries = Array.isArray(group?.versions) ? group.versions : [];
      const versions = entries.filter(entry => hasPoemContent(entry?.poemText ?? entry?.content));
      removed += entries.length - versions.length;
      if (versions.length) cleanedGroups.push({ ...group, versions });
    }
    if (cleanedGroups.length) trash[key] = cleanedGroups;
  }
  return { memory: { ...memory, poems, trash }, removed };
}
export const poemTitleKey = value => String(value ?? '').normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
