import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeWord,
  extractRhymeData,
  normalizeRhymeChunk,
  normalizeValidationWord,
  syllabifyWord,
  detectStressSyllable,
  classifyWordAccentType,
  adjustPoeticCount,
  analyzeLine,
  analyzePoem,
  extractVowelsForSinalefa,
  findSinalefaTriphthongs,
  findAutomaticTriphthongBreaks,
  isTriphthongVowelSequence
} from '../analyzer.js';

function rhymeOf(word, options = {}) {
  return extractRhymeData({ analyses: [analyzeWord(word)] }, options);
}

test('syllabifies and classifies common Spanish words', () => {
  const celestiales = analyzeWord('celestiales');
  assert.deepEqual(celestiales.syllables, ['ce', 'les', 'tia', 'les']);
  assert.equal(celestiales.stressIndex, 2);
  assert.equal(celestiales.accentType, 'llana');

  const llamaba = analyzeWord('llamaba');
  assert.deepEqual(llamaba.syllables, ['lla', 'ma', 'ba']);
  assert.equal(llamaba.stressIndex, 1);
  assert.equal(llamaba.accentType, 'llana');

  assert.deepEqual(syllabifyWord('sabia'), ['sa', 'bia']);
  assert.equal(detectStressSyllable('sabia', ['sa', 'bia']), 0);
  assert.equal(classifyWordAccentType(['sa', 'bia'], 0), 'llana');
  assert.equal(adjustPoeticCount(6, 'aguda'), 7);
  assert.equal(adjustPoeticCount(6, 'esdrújula'), 5);
});

test('keeps celestiales and mortales together in consonant rhyme', () => {
  const celestiales = rhymeOf('celestiales');
  const mortales = rhymeOf('mortales');

  assert.equal(celestiales.consonantKey, 'ales');
  assert.equal(mortales.consonantKey, 'ales');
  assert.equal(celestiales.assonantKey, 'ae');
  assert.equal(mortales.assonantKey, 'ae');
  assert.equal(celestiales.finalWordKey, 'celestiales');
  assert.equal(mortales.finalWordKey, 'mortales');
});

test('keeps sabia and llamaba apart in consonant rhyme but together in assonant rhyme', () => {
  const sabia = rhymeOf('sabia');
  const llamaba = rhymeOf('llamaba');

  assert.equal(sabia.consonantKey, 'abia');
  assert.equal(llamaba.consonantKey, 'aba');
  assert.equal(sabia.assonantKey, 'aa');
  assert.equal(llamaba.assonantKey, 'aa');
  assert.notEqual(sabia.consonantKey, llamaba.consonantKey);
});

test('respects distinguishSZInRhyme when normalizing rhyme chunks', () => {
  assert.equal(normalizeRhymeChunk('luz'), 'lus');
  assert.equal(normalizeRhymeChunk('luz', { distinguishSZInRhyme: true }), 'luz');
});

test('normalizes validation words and poem level analysis', () => {
  assert.equal(normalizeValidationWord('  ¡Canción!  '), 'cancion');

  const line = analyzeLine('Celestiales y mortales.');
  assert.equal(line.lastWord, 'mortales');
  assert.equal(line.accentType, 'llana');
  assert.equal(line.poeticCount, 8);

  const poem = analyzePoem('Celestiales y mortales.\nSabia y llamaba.');
  assert.equal(poem.lines.length, 2);
  assert.equal(poem.rawCount, line.rawCount + analyzeLine('Sabia y llamaba.').rawCount);
});

test('applies Rioplatense initial Y without changing conjunction y sinalefa', () => {
  assert.deepEqual(analyzeLine('claro y el', { rioplatenseY: true }).boundaries.map((item) => item.candidate), [true, true]);
  assert.equal(analyzeLine('claro yo').boundaries[0].candidate, true);
  assert.equal(analyzeLine('claro yo', { rioplatenseY: true }).boundaries[0].candidate, false);
  assert.deepEqual(extractVowelsForSinalefa('yo', { rioplatenseY: true }), ['o']);
  assert.deepEqual(extractVowelsForSinalefa('y', { rioplatenseY: true }), ['y']);
});

test('requires a more open middle vowel and unstressed lateral vowels for triphthongs', () => {
  assert.equal(isTriphthongVowelSequence(['e', 'a', 'o']), true);
  assert.equal(isTriphthongVowelSequence(['i', 'e', 'u']), true);
  assert.equal(isTriphthongVowelSequence(['a', 'e', 'i']), false);
  assert.equal(isTriphthongVowelSequence(['e', 'a', 'ó']), false);
  assert.equal(isTriphthongVowelSequence(['e', 'o', 'i']), false);

  const validLine = analyzeLine('mi a y');
  const validBoundaries = validLine.boundaries.map((boundary) => ({ ...boundary, active: boundary.candidate }));
  const triphthongs = findSinalefaTriphthongs(validLine, validBoundaries);

  assert.deepEqual(triphthongs.map(({ start, end, vowels, valid }) => ({ start, end, vowels, valid })), [
    { start: 0, end: 1, vowels: ['i', 'a', 'y'], valid: true }
  ]);
  assert.deepEqual(findAutomaticTriphthongBreaks(validLine, validBoundaries), []);

  const invalidOrder = analyzeLine('ahora y ola');
  const invalidOrderBoundaries = invalidOrder.boundaries.map((boundary) => ({ ...boundary, active: boundary.candidate }));
  assert.deepEqual(
    findSinalefaTriphthongs(invalidOrder, invalidOrderBoundaries).map(({ vowels, valid }) => ({ vowels, valid })),
    [{ vowels: ['a', 'y', 'o'], valid: false }]
  );
  assert.deepEqual(findAutomaticTriphthongBreaks(invalidOrder, invalidOrderBoundaries), [1]);

  const stressedClosed = analyzeLine('mí a y');
  const stressedClosedBoundaries = stressedClosed.boundaries.map((boundary) => ({ ...boundary, active: boundary.candidate }));
  assert.deepEqual(
    findSinalefaTriphthongs(stressedClosed, stressedClosedBoundaries).map(({ vowels, valid }) => ({ vowels, valid })),
    [{ vowels: ['í', 'a', 'y'], valid: false }]
  );
  assert.deepEqual(findAutomaticTriphthongBreaks(stressedClosed, stressedClosedBoundaries), [1]);

  const mundoHayVowels = [
    ...extractVowelsForSinalefa(analyzeWord('mundo').syllables.at(-1)),
    ...extractVowelsForSinalefa(analyzeWord('hay').syllables[0])
  ];
  assert.deepEqual(mundoHayVowels, ['o', 'a', 'y']);
  assert.equal(isTriphthongVowelSequence(mundoHayVowels), true);

  const niEuforico = analyzeLine('ni eufórico');
  const niEuforicoBoundaries = niEuforico.boundaries.map((boundary) => ({ ...boundary, active: boundary.candidate }));
  assert.deepEqual(findSinalefaTriphthongs(niEuforico, niEuforicoBoundaries), []);

  const comaYHaga = analyzeLine('coma y haga fuego');
  const comaYHagaBoundaries = comaYHaga.boundaries.map((boundary) => ({ ...boundary, active: boundary.candidate }));
  assert.deepEqual(
    findSinalefaTriphthongs(comaYHaga, comaYHagaBoundaries).map(({ vowels, valid }) => ({ vowels, valid })),
    [{ vowels: ['a', 'y', 'a'], valid: false }]
  );
  assert.deepEqual(findAutomaticTriphthongBreaks(comaYHaga, comaYHagaBoundaries), [1]);
});
