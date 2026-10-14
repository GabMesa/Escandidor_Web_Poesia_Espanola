import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePlica,plicaExportFields,contestKey} from '../plica-policy.js';
import {buildDocx} from '../prototipo/document-export.js';
import {seedData,resolveSelection} from '../prototipo/model.js';
import {parseContest} from '../prototipo/importer.js';
test('AI statement requires an explicit choice and does not appear in the poem document',async()=>{
  const plica={fullName:'Nombre de prueba',includeAi:true,aiStatement:'Declaración elegida por el poeta.'};
  const {poems,contests}=seedData(),c=contests[0],entries=resolveSelection(poems,c.selections);
  const text=await buildDocx(c,entries,true,plicaExportFields(plica)).text();
  assert.match(text,/Declaración elegida por el poeta/);assert.match(text,/Nombre de prueba/);
  const body=await buildDocx(c,entries).text();assert.doesNotMatch(body,/Nombre de prueba|Declaración elegida/);
  assert.equal(plicaExportFields({...plica,includeAi:false})['Declaración sobre inteligencia artificial'],undefined);
  assert.throws(()=>normalizePlica({includeAi:true,aiStatement:''}));
});
test('plica input rejects invalid dates, field types and oversized data',()=>{
  assert.throws(()=>normalizePlica({signatureDate:'2026-02-31'}));
  assert.throws(()=>normalizePlica({fullName:{}}));assert.throws(()=>normalizePlica({biography:'x'.repeat(6001)}));
  assert.throws(()=>contestKey(''));assert.equal(normalizePlica({fullName:'  Poeta  '}).fullName,'Poeta');
});
test('verse limits with omitted repeated unit and explicit prohibition of plica are detected',()=>{
  const html='<h1>Premio</h1><h2>BASES</h2><p>Un mínimo de 500 versos, y un máximo de 800, de forma libre.</p><p>No se admitirán plicas.</p>';
  const c=parseContest(html,'https://www.escritores.org/recursos-para-escritores/test');
  assert.equal(c.minTotal,500);assert.equal(c.maxTotal,800);assert.equal(c.plicaRequired,false);assert.equal(c.detected.font,false);
});
