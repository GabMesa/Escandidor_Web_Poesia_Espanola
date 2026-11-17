import test from 'node:test';
import assert from 'node:assert/strict';
import {moveDeliveryPoem,deliveryOrderHtml} from '../taller/delivery-order.js';
import {resolveSelection,defaultContestProfile} from '../taller/model.js';
import {documentPreview} from '../taller/document-preview.js';
import {documentHtml,buildDocx} from '../taller/document-export.js';

const selections=()=>[{poemId:'a',versionId:'latest'},{poemId:'b',versionId:'fixed'},{poemId:'c',versionId:'latest'}];

test('moving delivery poems preserves version choices and leaves saved copies intact',()=>{
  const original=selections(),snapshot=structuredClone(original);
  const moved=moveDeliveryPoem(original,'b',-1);
  assert.deepEqual(moved.map(s=>s.poemId),['b','a','c']);
  assert.equal(moved[0].versionId,'fixed');
  assert.deepEqual(original,snapshot);
  assert.deepEqual(moveDeliveryPoem(moved,'b',1),original);
  for(const [id,direction] of [['a',-1],['c',1],['missing',1],['b',0],['b',NaN]]){
    assert.equal(moveDeliveryPoem(original,id,direction),original);
  }
});

test('saved delivery order drives the preview, print/PDF and DOCX with the chosen revisions',async()=>{
  const poems=['a','b','c'].map(id=>({id,title:'Poema '+id,versions:[
    {id:'fixed',savedAt:'2026-01-01',versionNumber:1,poemText:'Texto fijado '+id},
    {id:'new',savedAt:'2026-02-01',versionNumber:2,poemText:'Texto nuevo '+id}
  ]}));
  const contest=JSON.parse(JSON.stringify({name:'Entrega',profile:{...defaultContestProfile(),cover:false},selections:moveDeliveryPoem(selections(),'b',-1)}));
  const entries=resolveSelection(poems,contest.selections),snapshot=structuredClone(entries);
  const outputs=[documentPreview(contest,entries),documentHtml(contest,entries),new TextDecoder().decode(await buildDocx(contest,entries).arrayBuffer())];
  for(const output of outputs){
    assert.ok(output.indexOf('Poema b')<output.indexOf('Poema a'));
    assert.ok(output.indexOf('Poema a')<output.indexOf('Poema c'));
    assert.match(output,/Texto fijado b/);assert.doesNotMatch(output,/Texto nuevo b/);
  }
  contest.selections=moveDeliveryPoem(contest.selections,'b',1);
  assert.deepEqual(snapshot.map(e=>e.poem.id),['b','a','c']);
});

test('delivery controls handle empty, single and unavailable poems and escape titles and IDs',()=>{
  assert.match(deliveryOrderHtml([]),/Seleccioná poemas/);
  const html=deliveryOrderHtml([{selection:{poemId:'<id>'},poem:{title:'<Título>'},version:{}}]);
  assert.equal((html.match(/ disabled/g)||[]).length,2);
  assert.match(html,/&lt;Título&gt;/);assert.match(html,/data-id="&lt;id&gt;"/);
  assert.doesNotMatch(html,/<Título>/);
  assert.match(deliveryOrderHtml([{selection:{poemId:'missing'}}]),/Versión no disponible/);
});
