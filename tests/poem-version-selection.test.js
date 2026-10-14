import test from 'node:test';
import assert from 'node:assert/strict';
import { groupVersionsForSelection, renderVersionSelectOptions } from '../poem-version-selection.js';
import { sortPoemVersions } from '../poem-exports.js';

const versions = [
  { id: 'auto-new', kind: 'autosave', savedAt: '2026-10-14T12:00:00Z', versionNumber: 4 },
  { id: 'manual-old', kind: 'manual', savedAt: '2026-10-12T12:00:00Z', versionNumber: 1 },
  { id: 'auto-old', kind: 'autosave', savedAt: '2026-10-13T13:00:00Z', versionNumber: 3 },
  { id: 'manual-new', kind: 'manual', savedAt: '2026-10-13T12:00:00Z', versionNumber: 2 }
];

test('manual saves are easier to find while each group remains newest first', () => {
  const before = structuredClone(versions);
  const groups = groupVersionsForSelection(versions);
  assert.deepEqual(groups.map(group => [group.label, group.versions.map(version => version.id)]), [
    ['Guardadas manualmente', ['manual-new', 'manual-old']],
    ['Autoguardados', ['auto-new', 'auto-old']]
  ]);
  assert.deepEqual(versions, before);
  assert.equal(sortPoemVersions(versions).at(-1).id, 'auto-new');
});

test('keeps legacy saves discoverable and omits empty groups', () => {
  const legacy = { id: 'legacy', savedAt: '2026-10-14 12:00:00', versionNumber: 7 };
  assert.deepEqual(groupVersionsForSelection([legacy]), [{ label: 'Guardadas manualmente', versions: [legacy] }]);
  assert.deepEqual(groupVersionsForSelection([versions[0]]).map(group => group.label), ['Autoguardados']);
  assert.deepEqual(groupVersionsForSelection([]), []);
});

test('keeps a selected autosave and safely renders renamed versions', () => {
  const html = renderVersionSelectOptions(versions, 'auto-new', version => version.id === 'manual-old' ? 'Mi versión <final>' : version.id);
  assert.match(html, /value="auto-new" selected/);
  assert.equal((html.match(/ selected/g) || []).length, 1);
  assert.ok(html.indexOf('manual-new') < html.indexOf('auto-new'));
  assert.match(html, /Mi versión &lt;final&gt;/);
});
