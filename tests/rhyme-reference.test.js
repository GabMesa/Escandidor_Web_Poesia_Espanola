import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeWord,
  extractRhymeData,
  normalizeRhymeChunk,
  syllabifyWord
} from '../analyzer.js';

function rhymeOf(word, options = {}) {
  return extractRhymeData({ analyses: [analyzeWord(word)] }, options);
}

test('assonance ignores an unaccented weak vowel in the stressed diphthong', () => {
  assert.deepEqual(
    [rhymeOf('pasión').assonantKey, rhymeOf('corazón').assonantKey],
    ['o', 'o']
  );
});

test('article rule: ll and consonantal y have the same consonant sound', () => {
  assert.equal(rhymeOf('halla').consonantKey, rhymeOf('haya').consonantKey);
});

test('article rule: silent h is removed from consonant rhyme keys', () => {
  assert.equal(normalizeRhymeChunk('uho'), 'uo');
});

test('article rule: consonant spellings are normalized by pronunciation', () => {
  const table = [
    ['gue', 'ge'], ['gué', 'ge'], ['gui', 'gi'], ['guí', 'gi'],
    ['güe', 'gue'], ['güé', 'gue'], ['güi', 'gui'], ['güí', 'gui'],
    ['que', 'ke'], ['qué', 'ke'], ['qui', 'ki'], ['quí', 'ki'],
    ['ce', 'ze'], ['cé', 'ze'], ['ci', 'zi'], ['cí', 'zi'],
    ['ge', 'je'], ['gé', 'je'], ['gi', 'ji'], ['gí', 'ji'],
    ['ch', 'ch'], ['ll', 'y'],
    ['ya', 'ya'], ['ye', 'ye'], ['yi', 'yi'], ['yo', 'yo'], ['yu', 'yu'],
    ['yá', 'ya'], ['yé', 'ye'], ['yí', 'yi'], ['yó', 'yo'], ['yú', 'yu'],
    ['y', 'i'], ['h', ''], ['v', 'b'], ['c', 'k']
  ];

  assert.deepEqual(
    table.map(([chunk]) => normalizeRhymeChunk(chunk, { distinguishSZInRhyme: true })),
    table.map(([, expected]) => expected)
  );
});

test('article rule: the trans prefix stays together when syllabifying', () => {
  assert.deepEqual(syllabifyWord('transatlántico'), ['trans', 'at', 'lán', 'ti', 'co']);
});

test('article rule: -mente keeps lexical stress and adds secondary stress on men', () => {
  assert.deepEqual(analyzeWord('rápidamente').secondaryStressIndices, [3]);
  assert.deepEqual(analyzeWord('velozmente').secondaryStressIndices, [2]);
});

test('article exception: the syllable after an esdrújula stress may be ignored', () => {
  assert.equal(rhymeOf('pájaro').consonantKey, rhymeOf('paro').consonantKey);
});
