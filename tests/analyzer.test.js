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
  analyzePoem
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
});
