import { sortPoemVersions } from './poem-exports.js';

// Selection order is independent of chronological history, exports and “latest”.
export function groupVersionsForSelection(versions) {
  const newestFirst = sortPoemVersions(versions).reverse();
  return [
    { label: 'Guardadas manualmente', versions: newestFirst.filter(version => version.kind !== 'autosave') },
    { label: 'Autoguardados', versions: newestFirst.filter(version => version.kind === 'autosave') }
  ].filter(group => group.versions.length);
}

const escape = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

export function renderVersionSelectOptions(versions, selectedId, label) {
  return groupVersionsForSelection(versions).map(group =>
    `<optgroup label="${group.label}">${group.versions.map(version =>
      `<option value="${escape(version.id)}"${String(selectedId) === String(version.id) ? ' selected' : ''}>${escape(label(version))}</option>`
    ).join('')}</optgroup>`
  ).join('');
}
