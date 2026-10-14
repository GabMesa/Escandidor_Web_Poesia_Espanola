import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fetchContest} from '../prototipo/importer.js';
import {extractPdf} from './prototype-services.mjs';
const cases=[
  {id:'manini',slug:'42187-48-concurso-literario-dr-alberto-manini-rios-2026',expected:{deadline:'2026-11-27',resultsDate:'',maxPoems:10,maxVerses:100}},
  {id:'berceo',slug:'41991-iii-premio-internacional-de-poesia-gonzalo-de-berceo',expected:{deadline:'2026-12-04',deadlineTime:'23:59',resultsDate:'2027-04-23',minTotal:500,maxTotal:800,plicaRequired:true}},
  {id:'tino',slug:'41851-ix-premio-de-poesia-joven-tino-barriuso',expected:{deadline:'2026-10-31',deadlineTime:'23:59',resultsDate:'',plicaRequired:false}},
  {id:'zahara',slug:'42033-xiii-concurso-internacional-de-poesia-de-zahara-de-los-atunes-2026',expected:{deadline:'2026-12-15',maxPoems:2,minPoemVerses:20,maxVerses:60,verseCounting:'includes-title-and-blanks'}},
  {id:'adonais',slug:'42092-80-edicion-premio-adonais',expected:{deadline:'2026-10-15',minTotal:500,maxTotal:800}},
  {id:'paco',slug:'42088-xxii-certamen-de-poesia-paco-molla',expected:{deadline:'2026-10-15'}},
];
await mkdir('qa/prototipo/importaciones',{recursive:true});const report=[];
for(const c of cases){
  try{
    const result=await fetchContest('https://www.escritores.org/recursos-para-escritores/'+c.slug,{extractPdf});
    await writeFile(`qa/prototipo/importaciones/${c.id}.json`,JSON.stringify(result,null,2));
    const checks=Object.entries(c.expected).map(([field,value])=>({field,expected:value,actual:result[field],pass:result[field]===value}));
    report.push({id:c.id,name:result.name,sourceUrl:result.sourceUrl,checks,pdfRead:result.pdfRead,detected:result.detected,profile:result.profile});
    console.log(c.id,JSON.stringify({checks,pdfRead:result.pdfRead,detected:result.detected,resultsDate:result.resultsDate,resultsNote:result.resultsNote,aiPlacement:result.aiPlacement}));
  }catch(error){report.push({id:c.id,error:error.message});console.log(c.id,error.message);}
}
await writeFile('qa/prototipo/importaciones/informe.json',JSON.stringify({checkedAt:new Date().toISOString(),cases:report},null,2));
const rows=report.map(r=>`| ${r.name||r.id} | ${r.checks?.every(c=>c.pass)?'Correctos':r.error||'Revisar diferencias'} | ${r.pdfRead?.length?r.pdfRead.map(p=>p.ok?'Texto PDF leído'+(p.sparsePages?' (páginas con poco texto)':''):'PDF no legible').join('; '):'HTML'} |`).join('\n');
await writeFile('qa/prototipo/importaciones/informe.md',`# Auditoría de seis convocatorias\n\nConsulta real a Escritores.org. Los campos comparados están en informe.json. No se afirma cobertura total de las bases.\n\n| Concurso | Campos comparados | Fuente |\n| --- | --- | --- |\n${rows}\n\nLos campos no detectados se distinguen de los valores sugeridos para exportar. No se convierte un mes o trimestre del fallo en una fecha exacta. Los PDF escaneados o con secciones en imágenes requieren lectura manual.\n`);
assert.ok(report.length===6&&report.every(r=>r.checks?.every(c=>c.pass)),'Revisar las diferencias del informe de importación.');
