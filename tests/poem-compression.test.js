import test from 'node:test';
import assert from 'node:assert/strict';
import { compressPoemVersions } from '../poem-compression.js';

const history = texts => texts.map((poemText, index) => ({ id: `v${index + 1}`, poemText, versionNumber: index + 1, savedAt: `2026-10-13T12:00:0${index}Z` }));
test('compression keeps a revision pinned by a contest while removing unpinned copies',()=>{
 const versions=history(['El río','El río','El río']);
 const result=compressPoemVersions(versions,{protectedVersionIds:['v1']});
 assert.deepEqual(result.retained.map(v=>v.id),['v1','v3']);
 assert.deepEqual(result.removed.map(v=>v.id),['v2']);
});

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

test('collapses repeated history cycles and preserves distinct metric configurations',()=>{
 const versions=history(['Borrador A','Otro texto B','Borrador A','Otro texto B','Borrador A']);
 versions[0].settings={rhymeMode:'consonante'};
 const result=compressPoemVersions(versions);
 assert.deepEqual(result.retained.map(v=>v.id),['v1','v4','v5']);
 assert.equal(result.replacements.find(r=>r.removed.id==='v3').retained.id,'v5');
});
test('keeps sinalefa and line override differences, independent of property order',()=>{
 const versions=history(['Luna','Luna','Luna','Luna']);
 versions[0].settings={a:1,b:2};versions[1].settings={b:2,a:1};
 versions[2].settings={a:1,b:2};versions[2].sinalefaOverrides={a:true};
 versions[3].settings={a:1,b:2};versions[3].lineOverrides={0:{stress:'6'}};
 assert.deepEqual(compressPoemVersions(versions).retained.map(v=>v.id),['v2','v3','v4']);
});
test('handles 5000 alternating duplicates and resolves replacements to surviving snapshots',()=>{
 const versions=Array.from({length:5000},(_,i)=>({id:String(i),poemText:'Texto '+i%21,versionNumber:i+1,savedAt:new Date(2026,0,1,0,0,i).toISOString()}));
 const result=compressPoemVersions(versions),ids=new Set(result.retained.map(v=>v.id));
 assert.equal(result.retained.length,21);assert.equal(result.removed.length,4979);assert.ok(result.replacements.every(r=>ids.has(r.retained.id)));
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
  versions[2].settings = { rhymeMode: 'consonante' };
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
