import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePoemsFromMarkdown} from '../poem-markdown-import.js';
import {buildHistoryMarkdown} from '../poem-exports.js';

test('imports a collection with BOM, CRLF, accents, stanza breaks and quotations',()=>{
  const text='\uFEFF# Canción\r\n\r\n  Primer verso  \r\nSegundo verso\r\n\r\n> Una cita\r\n\r\nÚltimo verso  \r\n\r\n# Otro poema\r\n\r\nOtro verso\r\n';
  assert.deepEqual(parsePoemsFromMarkdown(text),[
    {title:'Canción',text:'  Primer verso  \nSegundo verso\n\n> Una cita\n\nÚltimo verso  '},
    {title:'Otro poema',text:'Otro verso'}
  ]);
});
test('keeps long titles and separate poems with identical titles',()=>{
  const title='Un título largo '.repeat(11).trim();
  const poems=parsePoemsFromMarkdown(`# ${title}\n\nTexto uno\n\n# ${title}\n\nTexto dos`);
  assert.equal(poems.length,2);assert.equal(poems[0].title,title);assert.equal(poems[1].title,title);
  assert.deepEqual(poems.map(p=>p.text),['Texto uno','Texto dos']);
});
test('does not turn nested headings into extra poems and ignores exported history metadata',()=>{
  const poems=parsePoemsFromMarkdown('# Uno\n\n## Parte del poema\nUn verso\n\n# Dos\n<!-- Versión 2 -->\n\nOtro verso');
  assert.deepEqual(poems,[{title:'Uno',text:'## Parte del poema\nUn verso'},{title:'Dos',text:'Otro verso'}]);
  const markdown=buildHistoryMarkdown([{poemKey:'a',title:'Luna',version:{poemText:'La luna',label:'Borrador'}},{poemKey:'a',title:'Luna',version:{poemText:'La luna brilla',versionNumber:2}}]);
  assert.deepEqual(parsePoemsFromMarkdown(markdown).map(p=>p.text),['La luna','La luna brilla']);
});
test('a 95-poem collection retains its titles and complete last poem',()=>{
  const entries=Array.from({length:95},(_,i)=>({title:`Poema ${i+1}`,text:`Verso ${i+1}\n\n> Cita ${i+1}\nÚltimo verso ${i+1}`}));
  assert.deepEqual(parsePoemsFromMarkdown(entries.map(p=>`# ${p.title}\n\n${p.text}\n`).join('\n')),entries);
  assert.deepEqual(parsePoemsFromMarkdown('Sin encabezados'),[]);
});
