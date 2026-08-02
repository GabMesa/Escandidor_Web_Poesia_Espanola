import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getSpeechRecognitionErrorMessage,
  insertPoemLineBreak,
  insertPoemText
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