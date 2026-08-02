import test from 'node:test';
import assert from 'node:assert/strict';
import {
  POETIC_FORM_PRESETS,
  getExpectedSyllableCounts,
  getRhymeSchemeArtRequirement,
  matchesSyllablePattern,
  matchesRhymeSchemeArt,
  parseSyllablePattern,
} from '../poetic-forms.js';

test('includes every stanza form from the referenced catalog', () => {
  const expectedForms = [
    'pareado', 'terceto', 'tercetillo', 'cuarteto', 'serventesio',
    'redondilla', 'cuarteta', 'copla', 'seguidilla', 'cuadernaVia',
    'quinteto', 'quintilla', 'lira', 'pieQuebrado', 'octavaReal',
    'octavilla', 'decima', 'soneto', 'romance', 'sextina', 'silva', 'silvaArromanzada',
  ];

  assert.deepEqual(Object.keys(POETIC_FORM_PRESETS).filter((key) => key !== 'custom'), expectedForms);
  assert.equal(POETIC_FORM_PRESETS.cuadernaVia.hemistichSplit, '7');
  assert.equal(POETIC_FORM_PRESETS.soneto.rhymeScheme, 'ABBA ABBA CDC DCD');
  assert.equal(POETIC_FORM_PRESETS.decima.rhymeScheme, 'abbaaccddc');
  assert.equal(POETIC_FORM_PRESETS.sextina.rhymeMode, 'sextina');
  assert.equal(POETIC_FORM_PRESETS.sextina.rhymeScheme, 'ABCDEF FAEBDC CFDABE ECBFAD DEACFB BDFECA AB DE CF');
});

test('validates fixed, mixed, repeated, and flexible syllable patterns', () => {
  assert.deepEqual(parseSyllablePattern('7-11-7-7-11'), [[7], [11], [7], [7], [11]]);
  assert.deepEqual(getExpectedSyllableCounts('7-5-7-5', 5), [5]);
  assert.equal(matchesSyllablePattern(4, '8-8-4-8-8-4', 2), true);
  assert.deepEqual(getExpectedSyllableCounts('7 11', 8), [7, 11]);
  assert.equal(matchesSyllablePattern(7, '7 11', 8), true);
  assert.equal(matchesSyllablePattern(11, '7 11', 8), true);
  assert.equal(matchesSyllablePattern(9, '7 11', 8), false);
  assert.deepEqual(getExpectedSyllableCounts('8-7 11-8', 1), [7, 11]);
  assert.equal(POETIC_FORM_PRESETS.silva.stressPatterns[11], '6-10');
});

test('does not invent a fixed syllable count where the source only specifies an art category', () => {
  assert.equal(POETIC_FORM_PRESETS.terceto.syllablePattern, undefined);
  assert.equal(POETIC_FORM_PRESETS.quinteto.syllablePattern, undefined);
});

test('uses rhyme-scheme case to validate minor and major art', () => {
  assert.equal(getRhymeSchemeArtRequirement('a'), 'minor');
  assert.equal(getRhymeSchemeArtRequirement("B'"), 'major');
  assert.equal(matchesRhymeSchemeArt('a', 8), true);
  assert.equal(matchesRhymeSchemeArt('a', 11), false);
  assert.equal(matchesRhymeSchemeArt('A', 8), false);
  assert.equal(matchesRhymeSchemeArt('A', 14), true);
  assert.equal(matchesRhymeSchemeArt('A', 7 + 7), true);
});