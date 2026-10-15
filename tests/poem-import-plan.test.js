import test from 'node:test';
import assert from 'node:assert/strict';
import {previewPoemImport,appendPoemImport} from '../poem-import-plan.js';
const existing={id:'original',poemTitle:'Canción',poemText:'Texto anterior',versionNumber:43,savedAt:'2026-01-01',settings:{poemFont:'lora'}};
const tools={createKey:()=> 'separado',createVersion:({title,text,versionNumber})=>({id:'nuevo',poemTitle:title,poemText:text,versionNumber})};
test('preview matches existing user poems with case, whitespace and Unicode normalization',()=>{
 const poems=[{title:' CANCIÓN ',sourceKey:'local:a',local:true,versions:[existing]},{title:'Canción',sourceKey:'local:b',local:true,versions:[existing]}];
 const [entry]=previewPoemImport('# Cancio\u0301n\n\nTexto nuevo',poems);
 assert.equal(entry.matches.length,2);assert.equal(entry.targetKey,'local:a');
});
test('choosing an existing poem appends a checkpoint while retaining its identity and history',()=>{
 const memory={poems:{local:[existing]}};
 const result=appendPoemImport(memory,{title:'Canción',text:'Texto nuevo',targetKey:'local'},tools);
 assert.equal(result.poemKey,'local');assert.deepEqual(memory.poems.local[0],existing);assert.equal(result.version.versionNumber,44);assert.equal(memory.poems.local.length,2);
});
test('an empty destination reuses the existing title instead of creating a duplicate',()=>{
 const memory={poems:{local:[existing]}};
 appendPoemImport(memory,{title:'Canción',text:'Texto nuevo',targetKey:null},tools);
 assert.equal(memory.poems.local.length,2);assert.equal(Object.keys(memory.poems).length,1);
});

test('repeated titles inside one file and older identical texts reuse one poem and history',()=>{
 const memory={poems:{}};let serial=0;
 const factory={createKey:()=>`local:${serial++}`,createVersion:({title,text,versionNumber})=>({id:`v${serial++}`,poemTitle:title,poemText:text,versionNumber})};
 for(const text of ['Primero','Segundo','Primero'])appendPoemImport(memory,{title:'Canción',text},factory);
 assert.equal(Object.keys(memory.poems).length,1);assert.equal(Object.values(memory.poems)[0].length,2);
});
test('an identical latest text is not duplicated and a vanished destination is rejected',()=>{
 const memory={poems:{local:[existing]}};
 assert.equal(appendPoemImport(memory,{title:'Canción',text:'Texto anterior\n',targetKey:'local'},tools).changed,false);
 assert.equal(memory.poems.local.length,1);
 assert.throws(()=>appendPoemImport(memory,{title:'Canción',text:'Texto nuevo',targetKey:'missing'},tools),/disponible/);
 assert.throws(()=>appendPoemImport(memory,{title:'Otro',text:'Texto nuevo',targetKey:'local'},tools),/título/);
});
