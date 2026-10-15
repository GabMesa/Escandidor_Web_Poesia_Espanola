import test from 'node:test';
import assert from 'node:assert/strict';
import {filterContestPoems,contestPoemsHtml} from '../taller/contest-poems.js';
const poem=(id,savedAt,tags=[])=>({id,title:id,tags,versions:[{id:'v-'+id,poemText:'Versos de '+id,savedAt,versionNumber:1}]});
test('contest poems prioritize selected entries then the latest edit within each group',()=>{
 const poems=[poem('viejo','2026-01-01'),poem('nuevo','2026-10-01'),poem('elegido','2026-02-01'),poem('elegido reciente','2026-05-01')];
 assert.deepEqual(filterContestPoems(poems,[{poemId:'elegido'},{poemId:'elegido reciente'}]).map(p=>p.id),['elegido reciente','elegido','nuevo','viejo']);
 assert.equal(poems[0].id,'viejo');
});
test('contest search combines labels, poem contents, tags and selected-only without changing selections',()=>{
 const poems=[poem('mar','2026-01-01',['azul','luto']),poem('sol','2026-02-01',['azul']),poem('luna','2026-03-01',['noche'])],selections=[{poemId:'mar'}];
 assert.deepEqual(filterContestPoems(poems,selections,{selectedOnly:true,query:'versos',tags:['azul','luto']}).map(p=>p.id),['mar']);
 assert.equal(filterContestPoems(poems,selections,{tags:['azul','luto'],tagMode:'all'}).length,1);
 assert.equal(filterContestPoems(poems,selections,{tags:['azul','noche'],tagMode:'any'}).length,3);
 assert.equal(selections.length,1);
});
test('contest preview shows the fixed revision and escapes poem text',()=>{
 const p=poem('mar','2026-01-01');p.versions.push({id:'fixed',poemText:'Texto <seguro>',versionNumber:2,savedAt:'2026-02-01'});
 const html=contestPoemsHtml({poems:[p],contest:{selections:[{poemId:'mar',versionId:'fixed'}]},filters:{},data:{tagCatalog:[],tagColors:{}}});
 assert.match(html,/Texto &lt;seguro&gt;/);assert.doesNotMatch(html,/<seguro>/);
});
