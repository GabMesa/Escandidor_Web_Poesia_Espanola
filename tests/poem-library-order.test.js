import test from 'node:test';
import assert from 'node:assert/strict';
import {sortPoemsByLastUpdate} from '../poem-library-order.js';

test('editing an older poem moves it above newer poems, including automatic saves', () => {
  const older = {id: 'older', versions: [{savedAt: '2026-10-01T12:00:00Z'}]};
  const newer = {id: 'newer', versions: [{savedAt: '2026-10-14 12:00:00'}]};
  const poems = [older, newer];
  assert.deepEqual(sortPoemsByLastUpdate(poems).map(p => p.id), ['newer', 'older']);
  older.versions.unshift({savedAt: '2026-10-14T09:01:00-03:00', kind: 'autosave'});
  assert.deepEqual(sortPoemsByLastUpdate(poems).map(p => p.id), ['older', 'newer']);
  assert.deepEqual(poems.map(p => p.id), ['older', 'newer']);
  assert.equal(older.versions[0].kind, 'autosave');
});

test('metadata updates count and missing dates stay last with stable ties', () => {
  const poems = [
    {id: 'missing', versions: [{savedAt: 'invalid'}]},
    {id: 'first', versions: [{savedAt: '2026-10-14T12:00:00Z'}]},
    {id: 'updated', updatedAt: '2026-10-14T13:00:00Z', versions: [{savedAt: '2026-10-01'}]},
    {id: 'second', versions: [{savedAt: '2026-10-14 12:00:00'}]},
    {id: 'empty'}
  ];
  assert.deepEqual(sortPoemsByLastUpdate(poems).map(p => p.id), ['updated', 'first', 'second', 'missing', 'empty']);
});
