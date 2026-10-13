import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidPoemTitle, hasPoemContent, samePoemContent, cleanEmptyPoemVersions } from '../poem-policy.js';

test('requires a title and rejects the Spanish untitled placeholder', () => {
  for (const title of ['', ' \t', 'Sin título', 'SIN TITULO', ' sin   título ', 'Sin ti\u0301tulo']) {
    assert.equal(isValidPoemTitle(title), false, title);
  }
  assert.equal(isValidPoemTitle('La noche'), true);
});

test('whitespace-only poems are empty, including Unicode whitespace', () => {
  for (const text of ['', ' \t\r\n', '\u00a0\u2003\u202f\ufeff', null]) assert.equal(hasPoemContent(text), false);
  assert.equal(hasPoemContent('Un verso'), true);
});

test('consecutive duplicate comparison normalizes line endings and trailing whitespace', () => {
  assert.equal(samePoemContent('Uno\r\nDos\n', 'Uno\nDos'), true);
  assert.equal(samePoemContent('Uno', 'Dos'), false);
  assert.equal(samePoemContent('  Uno', 'Uno'), false);
});

test('cleans empty histories and trash without deleting untitled poems with content', () => {
  const memory = {
    poems: {
      empty: [{ poemText: ' \n' }],
      mixed: [{ id: 'blank', poemText: '' }, { id: 'keep', poemText: 'Un verso', poemTitle: 'Sin título' }],
    },
    trash: { Poema: [{ id: 'trash', versions: [{ content: '\t' }, { content: 'Otro verso' }] }] },
  };
  const cleaned = cleanEmptyPoemVersions(memory);
  assert.equal(cleaned.removed, 3);
  assert.deepEqual(Object.keys(cleaned.memory.poems), ['mixed']);
  assert.equal(cleaned.memory.poems.mixed[0].id, 'keep');
  assert.equal(cleaned.memory.trash.Poema[0].versions[0].content, 'Otro verso');
  assert.equal(memory.poems.mixed.length, 2);
});
