import test from 'node:test';
import assert from 'node:assert/strict';
import { sortPoemVersions, selectMarkdownEntries, buildHistoryMarkdown, buildVideoTimeline, interpolatePoemEdit } from '../poem-exports.js';
const v1 = { savedAt:'2026-10-01', versionNumber:1, poemText:'La luna', label:'Borrador' };
const v2 = { savedAt:'2026-10-02', versionNumber:2, poemText:'La luna brilla' };
test('Markdown exports latest per poem using stable identity, including duplicate titles', () => {
 const entries=[{poemKey:'a',title:'Luna',version:v2},{poemKey:'b',title:'Luna',version:v1},{poemKey:'a',title:'Luna',version:v1}];
 assert.deepEqual(selectMarkdownEntries(entries,'latest').map(e=>e.version),[v2,v1]);
 assert.equal(selectMarkdownEntries(entries,'all').length,3);
 assert.deepEqual(sortPoemVersions([v2,v1]),[v1,v2]);
});
test('Markdown keeps history labels separate from poem content', () => {
 const md=buildHistoryMarkdown([{poemKey:'a',title:'Luna',version:v1},{poemKey:'a',title:'Luna',version:v2}]);
 assert.match(md,/<!-- Borrador -->/);assert.match(md,/<!-- Versión 2 -->/);
 assert.equal((md.match(/^# Luna$/gm)||[]).length,2);
 assert.match(md,/La luna brilla/);
});
test('Video timeline sorts revisions and omits duplicate text from settings-only changes', () => {
 assert.deepEqual(buildVideoTimeline([v2,{...v1,versionNumber:2},v1]).map(v=>v.text),['La luna','La luna brilla']);
});
test('Animation handles additions, replacements, deletions and Unicode without broken characters', () => {
 assert.equal(interpolatePoemEdit('La luna','La luna brilla',1),'La luna brilla');
 assert.equal(interpolatePoemEdit('casa azul','casa roja',0),'casa azul');
 assert.equal(interpolatePoemEdit('casa azul','casa roja',1),'casa roja');
 assert.equal(interpolatePoemEdit('abcd','ab',.5),'abc');
 const frame=interpolatePoemEdit('🌙 luz','🌙 mar',.7);
 assert.ok(frame.startsWith('🌙 '));assert.doesNotMatch(frame,/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
});
