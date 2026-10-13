import test from 'node:test';
import assert from 'node:assert/strict';
import { compressPoemVersions } from '../poem-compression.js';

const history = texts => texts.map((poemText, index) => ({ id: `v${index + 1}`, poemText, versionNumber: index + 1, savedAt: `2026-10-13T12:00:0${index}Z` }));

test('compresses the approved adjacent examples', () => {
  for (const [texts, expected] of [
    [['la', 'la luna', 'la casa', 'la casa canta'], ['la luna', 'la casa canta']],
    [['El mar', 'El mar canta', 'El mar canta de noche'], ['El mar canta de noche']],
    [['La luna brilla', 'La luna', 'La luna duerme'], ['La luna brilla', 'La luna duerme']],
  ]) {
    const result = compressPoemVersions(history(texts));
    assert.deepEqual(result.retained.map(version => version.poemText), expected);
  }
});

test('does not compare against earlier nonadjacent survivors', () => {
  const result = compressPoemVersions(history(['la', 'sol', 'la luna']));
  assert.equal(result.removed.length, 0);
});

test('keeps identity, date and version number without changing the input', () => {
  const versions = history(['la', 'la luna', 'la casa', 'la casa canta']);
  const original = structuredClone(versions);
  const result = compressPoemVersions(versions);
  assert.deepEqual(versions, original);
  assert.deepEqual(result.retained.map(version => version.id), ['v2', 'v4']);
  assert.equal(result.retained[1], versions[3]);
});

test('orders legacy histories chronologically and keeps the newest identical version', () => {
  const versions = history(['La luna', 'La luna', 'La luna brilla']);
  const result = compressPoemVersions([versions[2], versions[0], versions[1]]);
  assert.deepEqual(result.retained, [versions[2]]);
});

test('containment is literal and includes line breaks and capitalization', () => {
  assert.equal(compressPoemVersions(history(['La\nluna', 'La luna brilla'])).removed.length, 0);
  assert.equal(compressPoemVersions(history(['La luna', 'la luna brilla'])).removed.length, 0);
  assert.equal(compressPoemVersions(history(['La\nluna', 'La\nluna\nbrilla'])).removed.length, 1);
});

test('keeps the newest of consecutive equal versions with its metadata', () => {
  const versions = history(['La luna', 'La luna', 'La luna', 'El mar', 'La luna']);
  versions[2].settings = { rhymeMode: 'asonante' };
  const result = compressPoemVersions(versions);
  assert.deepEqual(result.retained, [versions[2], versions[3], versions[4]]);
  assert.equal(result.retained[0], versions[2]);
  assert.deepEqual(result.removed, [versions[0], versions[1]]);
});

test('treats line ending and trailing whitespace differences as equal and keeps the newest', () => {
  const versions = history(['La luna\r\nEl mar\r\n', 'La luna\nEl mar', 'La luna\nEl mar\n \t']);
  const result = compressPoemVersions(versions);
  assert.deepEqual(result.retained, [versions[2]]);
  assert.deepEqual(result.removed, [versions[0], versions[1]]);
});
