import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fetchContest} from '../prototipo/importer.js';
import {extractPdf} from './prototype-services.mjs';
import {buildDocx,documentHtml} from '../prototipo/document-export.js';
import {coverWarnings} from '../prototipo/cover-policy.js';
const base='https://www.escritores.org/recursos-para-escritores/';
const ateneo='42066-certamenes-2026-del-ateneo-literario-de-artes-y-de-ciencias-de-puerto-real-v-concurso-de-sonetos-hernan-de-usero-vii-premio-de-poesia-rosa-butler-x-edicion-del-premio-de-novela-isaac-asimov-2026';
const cases=[
  {id:'berceo',slug:'41991-iii-premio-internacional-de-poesia-gonzalo-de-berceo',name:'Gonzalo de Berceo',rule:'Portada con número de versos; seudónimo en la obra y declaración de IA en la primera página.',cover:true,verses:700,pseudonym:true,statement:true},
  {id:'vina',slug:'42186-xx-edicion-del-certamen-literario-de-la-vina-y-el-vino',name:'De la Viña y el Vino',rule:'Primera página con título o lema, sin firma ni elementos de identificación. No exige una portada separada.',cover:false,verses:50,pseudonym:false,font:'Times New Roman',lineSpacing:2},
  {id:'campazas',slug:'41961-iii-certamen-nacional-de-poesia-manuel-campazas',name:'Manuel Campazas',rule:'Obra identificada con el título, sin firma; Times New Roman 12 e interlineado 1,5. No exige portada separada.',cover:false,verses:30,pseudonym:false},
  {id:'usero',slug:ateneo,name:'Hernán de Usero',rule:'PDF de la obra con título y seudónimo. No exige portada separada.',cover:false,verses:14,pseudonym:true},
  {id:'rosa',slug:ateneo,name:'Rosa Butler',rule:'PDF de la obra con título y seudónimo. No exige portada separada.',cover:false,verses:25,pseudonym:true},
  {id:'adonais',slug:'42092-80-edicion-premio-adonais',name:'Adonáis',rule:'Documento compatible con Word; el uso de seudónimos excluye. No exige portada separada.',cover:false,verses:600,pseudonym:false},
];
const out='qa/prototipo/portadas';await mkdir(out,{recursive:true});
const fetched=new Map();for(const slug of new Set(cases.map(c=>c.slug)))fetched.set(slug,await fetchContest(base+slug,{extractPdf}));
const results=[];
for(const item of cases){
  const c=structuredClone(fetched.get(item.slug));
  c.name=item.name;c.profile={...c.profile,font:item.font||'Times New Roman',size:12,lineSpacing:item.lineSpacing||1.5,cover:item.cover,workTitle:`Obra de prueba · ${item.name}`,pseudonym:item.pseudonym?'Junco de prueba':'NO-DEBE-APARECER',coverContestName:false,coverTitle:true,coverPseudonym:item.pseudonym,coverVerses:item.id==='berceo',coverStatement:item.statement?'Declaración de ejemplo para verificar el formato: ausencia de generación textual mediante IA. Reemplazar por la declaración veraz exigida por las bases.':'',coverAlignment:'center',coverPosition:'top'};
  // Explicit reviewed typography overrides are not claims of automatic PDF extraction.
  const entries=[{poem:{id:'audit',title:c.profile.workTitle},version:{id:'test',poemText:Array.from({length:item.verses},(_,i)=>`Verso de prueba ${i+1}`).join('\n')}}];
  assert.equal(coverWarnings(c).filter(w=>!w.includes('no se incluirá')).length,0,item.name);
  const html=documentHtml(c,entries),docx=buildDocx(c,entries),docxText=await docx.text();
  assert.ok(!html.includes('NO-DEBE-APARECER')&&!docxText.includes('NO-DEBE-APARECER'),item.name+' signature leak');
  assert.ok(html.includes(c.profile.workTitle));assert.equal(html.includes('Junco de prueba'),item.pseudonym);
  assert.equal(html.includes('class="cover"'),item.cover);assert.equal(html.includes('700 versos'),item.id==='berceo');
  await writeFile(`${out}/${item.id}.html`,html);await writeFile(`${out}/${item.id}.docx`,Buffer.from(await docx.arrayBuffer()));
  results.push({...item,sourceUrl:base+item.slug,profile:c.profile,automaticCoverRequirements:c.coverRequirements,pdfRead:c.pdfRead,htmlPassed:true,docxXmlPassed:true,pdfVisualPassed:false});
}
await writeFile(`${out}/auditoria.json`,JSON.stringify({checkedAt:new Date().toISOString(),scope:'Portadas y primeras páginas, no elegibilidad ni entrega completa. Ejemplos ficticios.',cases:results},null,2));
console.log('Verified cover/first-page fields for six contests; awaiting PDF visual checks.');
