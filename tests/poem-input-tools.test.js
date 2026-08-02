import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cutPoemLine,
  getSpeechRecognitionErrorMessage,
  insertPoemLineBreak,
  insertPoemText,
  remapPoemLineSettings
} from '../poem-input-tools.js';

test('inserts recognized text at the caret and preserves surrounding text', () => {
  assert.deepEqual(insertPoemText('Primer verso\nTercero', 13, 13, 'Segundo verso'), {
    text: 'Primer verso\nSegundo versoTercero',
    cursor: 26
  });
});

test('replaces a selection and separates dictated words', () => {
  assert.deepEqual(insertPoemText('Canta la noche', 9, 14, 'luna'), {
    text: 'Canta la luna',
    cursor: 13
  });
});

test('ignores empty recognition results', () => {
  assert.deepEqual(insertPoemText('Verso', 5, 5, '   '), {
    text: 'Verso',
    cursor: 5
  });
});

test('turns a dictation pause into a clean line break', () => {
  assert.deepEqual(insertPoemLineBreak('Primer verso   ', 15, 15), {
    text: 'Primer verso\n',
    cursor: 13
  });
  assert.deepEqual(insertPoemLineBreak('Primer verso\nSegundo', 13, 13), {
    text: 'Primer verso\nSegundo',
    cursor: 13
  });
});

test('cuts the whole current line from a collapsed selection', () => {
  assert.deepEqual(cutPoemLine('Primero\nSegundo\nTercero', 11), {
    text: 'Primero\nTercero',
    cursor: 8,
    cutText: 'Segundo\n'
  });
  assert.deepEqual(cutPoemLine('Primero\nSegundo', 2), {
    text: 'Segundo',
    cursor: 0,
    cutText: 'Primero\n'
  });
  assert.deepEqual(cutPoemLine('Primero\nSegundo', 12), {
    text: 'Primero',
    cursor: 7,
    cutText: 'Segundo'
  });
});

test('moves configured line settings when a verse is inserted in the middle', () => {
  const previousText = 'Perdóname... te lo ruego\nhoy he sido un cruel villano';
  const nextText = 'Perdóname... te lo ruego\nDonde se ahoga mi casa\nhoy he sido un cruel villano';

  assert.deepEqual(remapPoemLineSettings(previousText, nextText, {
    sinalefaOverrides: { '1:0': false, '1:2': true },
    lineOverrides: { 1: { rhymeText: 'B', sinalefaOn: '3' } },
    openAdvancedByLine: { 1: true }
  }), {
    sinalefaOverrides: { '2:0': false, '2:2': true },
    lineOverrides: { 2: { rhymeText: 'B', sinalefaOn: '3' } },
    openAdvancedByLine: { 2: true }
  });
});

test('keeps configured line settings when editing that verse text', () => {
  assert.deepEqual(remapPoemLineSettings('Primer verso\nSegundo verso', 'Primer verso\nSegundo verso corregido', {
    sinalefaOverrides: { '1:0': true },
    lineOverrides: { 1: { stress: '3-7' } }
  }), {
    sinalefaOverrides: { '1:0': true },
    lineOverrides: { 1: { stress: '3-7' } },
    openAdvancedByLine: {}
  });
});

test('explains actionable speech recognition errors', () => {
  assert.equal(
    getSpeechRecognitionErrorMessage('not-allowed'),
    'El navegador no tiene permiso para usar el micrófono.'
  );
  assert.equal(
    getSpeechRecognitionErrorMessage('network'),
    'El servicio de dictado no está disponible. Prueba la página en Chrome o Edge.'
  );
});