import test from 'node:test';
import assert from 'node:assert/strict';
import {coverLines,coverOptions,detectCoverRequirements,coverWarnings} from '../prototipo/cover-policy.js';
import {documentHtml,buildDocx} from '../prototipo/document-export.js';
const entries=[{poem:{title:'Título de prueba'},version:{poemText:'> Epígrafe\n\nUno\nDos'}}];
const profile={cover:true,font:'Times New Roman',size:12,lineSpacing:1.5,paper:'A4',margin:2.5,pseudonym:'Junco',workTitle:'La prueba',newPage:true};
test('minimal cover avoids unsolicited contest name and verse count',()=>{
  const c={name:'Concurso',rules:'Título y seudónimo',profile};assert.deepEqual(coverLines(c,entries).map(l=>l.text),['La prueba','Junco']);
});
test('a motto-only cover can omit title, pseudonym and contest name',()=>{
  const c={name:'Concurso',profile:{...profile,coverTitle:false,coverPseudonym:false,coverMotto:'La palabra y la copa',coverAlignment:'left'}};
  assert.deepEqual(coverLines(c,entries),[{text:'La palabra y la copa',type:'motto'}]);
  assert.match(documentHtml(c,entries),/text-align:left/);
});
test('Berceo cover detects verse count and declaration on first page',()=>{
  const rules='En la portada constará el número de versos. La primera página contendrá una declaración responsable sin generación textual mediante inteligencia artificial (IA).';
  const c={name:'Berceo',rules,profile:{...profile,coverStatement:'Declaración revisada de prueba.'}};
  assert.equal(coverOptions(c).verses,true);assert.equal(coverWarnings(c).length,0);assert.equal(coverLines(c,entries)[2].text,'2 versos');
  assert.match(documentHtml(c,entries),/2 versos/);assert.match(documentHtml(c,entries),/Declaración revisada/);
  assert.equal(coverWarnings({...c,profile:{...c.profile,coverStatement:''}}).length,1);
});
test('signature restrictions apply to both a cover and a first page without a cover',async()=>{
  const c={name:'Viña',rules:'En la primera página figurará el título o lema. No llevará ninguna clase de firma.',profile:{...profile,pseudonym:'NO-FILTRAR'}};
  assert.equal(detectCoverRequirements(c.rules).kind,'first-page');
  assert.doesNotMatch(documentHtml(c,entries),/NO-FILTRAR/);assert.doesNotMatch(documentHtml({...c,profile:{...c.profile,cover:false}},entries),/NO-FILTRAR/);
  assert.doesNotMatch(await buildDocx(c,entries).text(),/NO-FILTRAR/);
});
