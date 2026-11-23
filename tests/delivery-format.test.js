import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultContestProfile,resolveSelection} from '../taller/model.js';
import {coverLines,coverOptions} from '../taller/cover-policy.js';
import {
  splitVerseHemistichs,
  resolvePoemFormat,
  paginateDeliveryEntries,
  workHeaderOptions,
  computeFitAdjustment
} from '../taller/delivery-format.js';
import {deliveryOrderHtml} from '../taller/delivery-order.js';
import {documentPreview} from '../taller/document-preview.js';
import {documentHtml,buildDocx} from '../taller/document-export.js';

function makePoem(id,title,poemText,extraVersion={}){
  return {
    id,
    title,
    versions:[{
      id:'v1',
      versionNumber:1,
      savedAt:'2026-10-15T12:00:00.000Z',
      poemText,
      ...extraVersion
    }]
  };
}

test('splits Spanish verses into hemistichs using inline slashes, saved Escandidor settings, explicit cuts and metric midpoints',()=>{
  assert.deepEqual(
    splitVerseHemistichs('De la noche profunda / nace el alba serena'),
    ['De la noche profunda','nace el alba serena']
  );

  // Classic 7+7 alexandrine with punctuation between hemistichs
  assert.deepEqual(
    splitVerseHemistichs('La princesa está triste... ¿Qué tendrá la princesa?',{cut:'7'}),
    ['La princesa está triste...','¿Qué tendrá la princesa?']
  );

  // Saved Escandidor hemistichSplit setting (6+6 dodecasílabo)
  const dodeca=splitVerseHemistichs('En la noche clara brillan los luceros',{
    version:{settings:{hemistichSplit:'6',rioplatenseY:true}}
  });
  assert.deepEqual(dodeca,['En la noche clara','brillan los luceros']);

  // Automatic midpoint fallback without explicit cut
  const autoSplit=splitVerseHemistichs('Los suspiros se escapan de su boca de fresa,');
  assert.ok(Array.isArray(autoSplit)&&autoSplit.length===2);
  assert.equal(autoSplit[0],'Los suspiros se escapan');
  assert.equal(autoSplit[1],'de su boca de fresa,');

  // Single-word verse returns null so it centers cleanly
  assert.equal(splitVerseHemistichs('Silencio'),null);
});

test('work title and date can be shown or hidden independently with or without a separate cover',async()=>{
  const poems=[makePoem('p1','Nocturno','La noche cae despacio\nsobre los tejados')];
  const selections=[{poemId:'p1',versionId:'latest'}];
  const entries=resolveSelection(poems,selections);

  // Cover enabled: title hidden, date enabled with custom text
  const withCover={
    name:'Premio',
    profile:{...defaultContestProfile(),cover:true,coverTitle:false,coverDate:true,workTitle:'Mi Obra',workDate:'Noviembre de 2026'},
    selections
  };
  assert.equal(coverOptions(withCover).title,false);
  assert.equal(coverOptions(withCover).date,true);
  assert.deepEqual(coverLines(withCover,entries),[{text:'Noviembre de 2026',type:'date'}]);
  const coverPreview=documentPreview(withCover,entries,'cover');
  assert.match(coverPreview,/Noviembre de 2026/);
  assert.doesNotMatch(coverPreview,/Mi Obra/);

  // Cover disabled: work title and work date enabled in work header
  const withoutCover={
    name:'Premio',
    profile:{...defaultContestProfile(),cover:false,showWorkTitle:true,coverDate:true,workTitle:'Cuaderno del Sur',workDate:'2026-11-23'},
    selections
  };
  const header=workHeaderOptions(withoutCover,entries);
  assert.equal(header.showTitle,true);
  assert.equal(header.showDate,true);
  assert.equal(header.titleText,'Cuaderno del Sur');
  assert.match(header.dateText,/23 de noviembre de 2026/);

  const previewHtml=documentPreview(withoutCover,entries,'poem');
  const printHtml=documentHtml(withoutCover,entries);
  const docxXml=new TextDecoder().decode(await buildDocx(withoutCover,entries).arrayBuffer());
  for(const out of [previewHtml,printHtml,docxXml]){
    assert.match(out,/Cuaderno del Sur/);
    assert.match(out,/23 de noviembre de 2026/);
  }
});

test('supports independent per-poem appearance overrides including hemistich alignment, title visibility and poem date',async()=>{
  const poems=[
    makePoem('p1','Alejandrino','La princesa está triste... ¿Qué tendrá la princesa?\nLos suspiros se escapan de su boca de fresa,'),
    makePoem('p2','Haiku','Agua en la piedra\ncanta la tarde mansa\nvuelve el silencio')
  ];
  const contest={
    name:'Certamen',
    profile:{...defaultContestProfile(),cover:false,poemStyle:{align:'left',showTitle:true,showDate:false}},
    selections:[
      {poemId:'p1',versionId:'latest',format:{align:'hemistich',hemistichCut:'7',showDate:true,dateText:'Montevideo, 2026'}},
      {poemId:'p2',versionId:'latest',format:{align:'right',showTitle:false,font:'Georgia',size:10}}
    ]
  };
  const entries=resolveSelection(poems,contest.selections);
  const f1=resolvePoemFormat(contest,entries[0]);
  const f2=resolvePoemFormat(contest,entries[1]);
  assert.equal(f1.align,'hemistich');
  assert.equal(f1.showDate,true);
  assert.equal(f1.dateText,'Montevideo, 2026');
  assert.equal(f2.align,'right');
  assert.equal(f2.showTitle,false);
  assert.equal(f2.font,'Georgia');
  assert.equal(f2.size,10);

  const preview=documentPreview(contest,entries,'poem');
  assert.match(preview,/verse-hemistich/);
  assert.match(preview,/hemistich-left">La princesa está triste\.\.\.</);
  assert.match(preview,/hemistich-right">¿Qué tendrá la princesa\?</);
  assert.match(preview,/Montevideo, 2026/);
  assert.doesNotMatch(preview,/>Haiku</);
  assert.match(preview,/text-align:right/);

  const docxXml=new TextDecoder().decode(await buildDocx(contest,entries).arrayBuffer());
  assert.match(docxXml,/<w:tabs><w:tab w:val="right"/);
  assert.match(docxXml,/<w:jc w:val="right"\/>/);
  assert.match(docxXml,/Montevideo, 2026/);
  assert.doesNotMatch(docxXml,/>Haiku</);
});

test('supports laying out a long poem in multiple columns and fitting it onto a single page',async()=>{
  const longText=Array.from({length:48},(_,i)=>`Verso número ${i+1} que camina despacio por la página`).join('\n');
  const poems=[makePoem('long','Poema extenso',longText)];
  const contest={
    name:'Certamen',
    profile:{...defaultContestProfile(),cover:false,size:12,lineSpacing:1.5},
    selections:[{poemId:'long',versionId:'latest',format:{columns:2,fitOnePage:true}}]
  };
  const entries=resolveSelection(poems,contest.selections);
  const format=resolvePoemFormat(contest,entries[0]);
  const fit=computeFitAdjustment(entries[0],format,contest.profile);
  assert.equal(fit.overflows,false);

  const preview=documentPreview(contest,entries,'poem');
  const printHtml=documentHtml(contest,entries);
  const docxXml=new TextDecoder().decode(await buildDocx(contest,entries).arrayBuffer());
  assert.match(preview,/poem-cols-2/);
  assert.match(preview,/fit-one-page/);
  assert.match(printHtml,/poem-cols-2/);
  assert.match(docxXml,/<w:cols w:num="2"/);
  assert.match(docxXml,/<w:type w:val="continuous"\/>/);
});

test('groups multiple poems onto one sheet via per-sheet, flow, side-by-side columns or per-poem pageBreak',async()=>{
  const poems=[
    makePoem('a','Primero','Uno\nDos'),
    makePoem('b','Segundo','Tres\nCuatro'),
    makePoem('c','Tercero','Cinco\nSeis')
  ];

  // Mode 1: per-sheet (2 poems per page) + side-by-side columns
  const perSheet={
    name:'Conjunto',
    profile:{...defaultContestProfile(),cover:false,pageLayout:'per-sheet',poemsPerPage:2,multiPoemLayout:'columns',newPage:false},
    selections:[{poemId:'a',versionId:'latest'},{poemId:'b',versionId:'latest'},{poemId:'c',versionId:'latest'}]
  };
  const entries=resolveSelection(poems,perSheet.selections);
  const pages=paginateDeliveryEntries(perSheet,entries);
  assert.equal(pages.length,2);
  assert.equal(pages[0].items.length,2);
  assert.equal(pages[0].isSideBySide,true);
  assert.equal(pages[1].items.length,1);

  const preview=documentPreview(perSheet,entries,'poem');
  assert.equal((preview.match(/<article class="paper/g)||[]).length,2);
  assert.match(preview,/sheet-multi-cols/);
  const docxXml=new TextDecoder().decode(await buildDocx(perSheet,entries).arrayBuffer());
  assert.match(docxXml,/<w:tbl>/);

  // Mode 2: one-per-page default, but poem B explicitly shares page with poem A
  const mixed={
    name:'Mixto',
    profile:{...defaultContestProfile(),cover:false,pageLayout:'one-per-page',newPage:true},
    selections:[
      {poemId:'a',versionId:'latest'},
      {poemId:'b',versionId:'latest',format:{pageBreak:'same'}},
      {poemId:'c',versionId:'latest'}
    ]
  };
  const mixedPages=paginateDeliveryEntries(mixed,resolveSelection(poems,mixed.selections));
  assert.equal(mixedPages.length,2);
  assert.deepEqual(mixedPages[0].items.map(i=>i.entry.poem.id),['a','b']);
  assert.deepEqual(mixedPages[1].items.map(i=>i.entry.poem.id),['c']);
});

test('delivery poem list provides edit-in-workbench action and expandable per-poem configuration',()=>{
  const poems=[makePoem('p1','Brisa','Viento suave'),makePoem('p2','Olas','Mar abierto')];
  const contest={
    name:'Certamen',
    profile:{...defaultContestProfile()},
    selections:[{poemId:'p1',versionId:'latest'},{poemId:'p2',versionId:'latest',format:{columns:2,pageBreak:'same'}}]
  };
  const entries=resolveSelection(poems,contest.selections);
  const collapsed=deliveryOrderHtml(entries,{contest});
  assert.match(collapsed,/data-action="edit-delivery-poem" data-id="p1"/);
  assert.match(collapsed,/Editar en la mesa/);
  assert.match(collapsed,/2 columnas/);
  assert.match(collapsed,/Misma hoja/);
  assert.doesNotMatch(collapsed,/data-poem-config-panel="p2"/);

  const expanded=deliveryOrderHtml(entries,{contest,expandedPoemId:'p2'});
  assert.match(expanded,/data-poem-config-panel="p2"/);
  assert.match(expanded,/data-poem-format="align"/);
  assert.match(expanded,/Por hemistiquio/);
  assert.match(expanded,/En la misma hoja que el anterior/);
});
