import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { analyzeLine } from '../analyzer.js';

const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const start = appSource.indexOf('function hasAgudaRhymeEnding(');
const end = appSource.indexOf('function parseRhymeSchemeToken(', start);
const { hasAgudaRhymeEnding, formatRhymeChipLabel } = runInNewContext(
  `${appSource.slice(start, end)}\n({ hasAgudaRhymeEnding, formatRhymeChipLabel });`
);

test('marks monosyllabic and aguda rhyme endings with the acute marker', () => {
  for (const word of ['soy', 'dios', 'Dios', 'hoy', 'mar', 'amor', 'canción']) {
    const runtime = { lineAnalysis: analyzeLine(`Aquí ${word}`), rhyme: { label: 'A' } };
    assert.equal(hasAgudaRhymeEnding(runtime), true, word);
    assert.equal(formatRhymeChipLabel(runtime), 'A´', word);
    runtime.rhyme.label = 'a';
    assert.equal(formatRhymeChipLabel(runtime), 'a´', word);
    runtime.rhyme.label = 'A´';
    assert.equal(formatRhymeChipLabel(runtime), 'A´', word);
    runtime.rhyme.label = '-';
    assert.equal(formatRhymeChipLabel(runtime), '-', word);
  }
});

test('leaves llana and esdrujula rhyme endings without the acute marker', () => {
  for (const word of ['casa', 'pájaro']) {
    const runtime = { lineAnalysis: analyzeLine(`Aquí ${word}`), rhyme: { label: 'A' } };
    assert.equal(hasAgudaRhymeEnding(runtime), false, word);
    assert.equal(formatRhymeChipLabel(runtime), 'A', word);
  }
  assert.equal(hasAgudaRhymeEnding({}), false);
  assert.equal(formatRhymeChipLabel({}), '-');
});
