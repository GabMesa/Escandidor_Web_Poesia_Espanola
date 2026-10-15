import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRhymeSchemes, validateStanzaRhymeSchemes as validate } from '../rhyme-scheme.js';

function poem(stanzas, counts = 8, accents = {}) {
  let lineIndex = 0, verse = 0;
  return stanzas.flatMap((keys, index) => {
    const lines = keys.map(key => ({
      lineIndex: lineIndex++, metricVerseCount: Array.isArray(counts) ? counts[verse++] : counts,
      lineAnalysis: { text: 'Un verso', accentType: accents[lineIndex - 1] ?? 'llana' },
      rhyme: { activeKey: key }
    }));
    if (index < stanzas.length - 1) lines.push({ lineIndex: lineIndex++, lineAnalysis: { text: '' } });
    return lines;
  });
}

test('commas separate alternatives; spaces and pipes separate stanzas; primes normalize', () => {
  assert.deepEqual(parseRhymeSchemes("-aab’-ccb’, -AAB'-CCB' | abba abba"), [
    [['-', 'a', 'a', "b'", '-', 'c', 'c', "b'"], ['-', 'A', 'A', "B'", '-', 'C', 'C', "B'"]],
    [['a', 'b', 'b', 'a']], [['a', 'b', 'b', 'a']]
  ]);
});

test('empty scheme remains free and invalid alternatives are reported', () => {
  assert.equal(validate(poem([['a']]), '').summary, 'Esquema libre');
  for (const input of ['abba,', 'abba,,abab', 'ab2a', "'abba"]) assert.equal(validate(poem([['a']]), input).valid, false, input);
});

test('repeated schemes may restart rhyme families at every stanza', () => {
  const lines = poem([['asa', 'elo', 'elo', 'asa'], ['ida', 'ente', 'ente', 'ida']]);
  assert.equal(validate(lines, 'abba', { repeat: true }).valid, true);
  const shared = validate(lines, 'abba', { repeat: true, sharedRhymes: true });
  assert.equal(shared.valid, false);
  assert.deepEqual(shared.failingVerses, [5, 6, 7, 8]);
});

test('sharing the same rhymes also accepts correctly repeated endings', () => {
  assert.equal(validate(poem([['asa', 'elo', 'elo', 'asa'], ['asa', 'elo', 'elo', 'asa']]), 'abba', { repeat: true, sharedRhymes: true }).valid, true);
});

test('each stanza may choose a whole alternative with different art', () => {
  const keys = ['libre', 'asa', 'asa', 'on', 'libre', 'elo', 'elo', 'on'];
  const lines = poem([keys, keys.map(key => 'otra'+key)], [...Array(8).fill(8), ...Array(8).fill(11)], { 3:'aguda', 7:'aguda', 12:'aguda', 16:'aguda' });
  const result = validate(lines, "-aab'-ccb', -AAB'-CCB'", { repeat: true });
  assert.equal(result.valid, true, result.summary);
  assert.equal(result.lineStatus.get(1).expectedLetter, 'a');
  assert.equal(result.lineStatus.get(10).expectedLetter, 'A');
});

test('alternatives cannot be mixed verse by verse within a stanza', () => {
  assert.equal(validate(poem([['asa', 'asa', 'elo', 'elo']], [8, 11, 8, 11]), 'aabb,AABB').valid, false);
});

test('explicit stanza schemes are independent even when the letters repeat', () => {
  const keys = ['suelto', 'asa', 'asa', 'on', 'suelto', 'elo', 'elo', 'on'];
  const lines = poem([keys, keys.map(k => 'otra'+k)], 11, { 3:'aguda', 7:'aguda', 12:'aguda', 16:'aguda' });
  assert.equal(validate(lines, "-AAB'-CCB' -AAB'-CCB'").valid, true);
  assert.equal(validate(lines, "-AAB'-CCB' -AAB'-CCB'", { sharedRhymes:true }).valid, false);
});

test('explicit schemes support alternatives within each stanza and a repeating sequence', () => {
  const lines = poem([['x','y','y','x'], ['z','z'], ['n','m','m','n'], ['o','o']]);
  assert.equal(validate(lines, 'abba,ABBA aa', { repeat:true }).valid, true);
});

test('shared alternatives are chosen with the following stanzas in mind', () => {
  const lines = poem([['x','y','x','y'], ['y','x','x','y']]);
  const result = validate(lines, 'abab,baba abba', { sharedRhymes:true });
  assert.equal(result.valid, true, result.summary);
  assert.equal(result.lineStatus.get(0).expectedLetter, 'b');
});

test('primes require aguda or monosyllabic endings', () => {
  assert.equal(validate(poem([['on','on']],8,{0:'aguda',1:'monosílaba'}), "a'a'").valid,true);
  assert.equal(validate(poem([['on','on']]), "a'a'").valid,false);
});

test('free verses are not bound to rhyme families and different letters cannot share a rhyme', () => {
  assert.equal(validate(poem([['asa','asa','asa']]), '-aa').valid,true);
  assert.equal(validate(poem([['asa','asa']]), 'ab').valid,false);
});

test('repetition cycles within a stanza, as in romance', () => {
  assert.equal(validate(poem([['x','on','y','on','z','on']]), '-a', {repeat:true}).valid,true);
});

test('missing, extra, or undersized explicit stanzas are reported', () => {
  assert.equal(validate(poem([['x','x']]), 'aa aa').valid,false);
  assert.equal(validate(poem([['x','x'],['y','y'],['z','z']]), 'aa aa').valid,false);
  const short = validate(poem([['x','x'],['y']]), 'aa aa');
  assert.equal(short.valid,false);assert.deepEqual(short.failingVerses,[3]);
  assert.equal(validate(poem([['x','x'],['y','y','y']]), 'aa aa').valid,false);
});

test('the sonnet preset supports its complete notation without stanza breaks', () => {
  const keys = ['a','b','b','a','a','b','b','a','c','d','c','d','c','d'];
  assert.equal(validate(poem([keys],11), 'ABBA ABBA CDC DCD', {wholePoem:true,sharedRhymes:true}).valid,true);
});

test('legacy ungrouped schemes keep their partial validation', () => {
  const result = validate(poem([['a','a','b','c']]), 'aa');
  assert.equal(result.valid,true);assert.equal(result.lineStatus.size,2);
});
