import test from 'node:test';
import assert from 'node:assert/strict';
import {latestVersion,resolveSelection,poemBlocks,countLines,calendarText,upcomingNotices,seedData} from '../prototipo/model.js';
import {parseContest,parseDate,validateWritersUrl} from '../prototipo/importer.js';
import {buildDocx,documentHtml} from '../prototipo/document-export.js';
test('automatic selection follows new versions; fixed versions and delivered copies retain their text',()=>{
  const {poems,contests}=seedData(),c=contests[0],poem=poems[0];
  const delivered=structuredClone(resolveSelection(poems,c.selections));
  const fixed=[{poemId:poem.id,versionId:poem.versions[0].id}];
  poem.versions.push({id:'new',savedAt:'2027-01-01T00:00:00Z',versionNumber:3,poemText:'Texto nuevo'});
  assert.equal(latestVersion(poem).id,'new');assert.equal(resolveSelection(poems,c.selections)[0].version.poemText,'Texto nuevo');
  assert.notEqual(resolveSelection(poems,fixed)[0].version.poemText,'Texto nuevo');assert.notEqual(delivered[0].version.poemText,'Texto nuevo');
});
test('quotes preserve line breaks and do not count as poem verses',()=>{
  const text='> Cita\n> — Autor\n\nUn verso\nOtro verso';
  assert.deepEqual(countLines(text),{verses:2,quotes:2});assert.deepEqual(poemBlocks(text)[0],{type:'quote',lines:['Cita','— Autor']});
});
test('extract explicit dates; leave vague result dates unknown',()=>{
  assert.equal(parseDate('27:11:2026'),'2026-11-27');assert.equal(parseDate('23 de abril de 2027'),'2027-04-23');assert.equal(parseDate('31/02/2026'),'');assert.equal(parseDate('febrero de 2027'),'');
  const html='<h1>Premio &quot;Río&quot;</h1><p>Fecha de cierre de la convocatoria: 27:11:2026</p><p>País de la entidad convocante: Uruguay</p><p>Entidad convocante: AEDI</p><h2>BASES</h2><p>Se enviará un PDF en Times New Roman de cuerpo 12.</p><p>El fallo se dará a conocer durante febrero de 2027.</p>';
  const c=parseContest(html,'https://www.escritores.org/recursos-para-escritores/123-premio');
  assert.equal(c.name,'Premio "Río"');assert.equal(c.deadline,'2026-11-27');assert.equal(c.resultsDate,'');assert.match(c.resultsNote,/febrero/);assert.equal(c.profile.size,12);
});
test('URL importer rejects other hosts, credentials and alternate ports',()=>{
  for(const url of ['http://www.escritores.org/concursos/test','https://escritores.org.evil.test/concursos/test','https://user@escritores.org/concursos/test','https://escritores.org:9000/concursos/test','https://127.0.0.1/concursos/test'])assert.throws(()=>validateWritersUrl(url));
  assert.equal(validateWritersUrl('https://www.escritores.org/recursos-para-escritores/123-premio').hostname,'www.escritores.org');
});
test('calendar uses all-day date without inventing a timezone and contains reminders',()=>{
  const c=seedData().contests[0],ics=calendarText(c);assert.match(ics,/DTSTART;VALUE=DATE:20261127/);assert.match(ics,/DTEND;VALUE=DATE:20261128/);assert.match(ics,/TRIGGER:-P7D/);assert.doesNotMatch(ics,/TZID=/);assert.throws(()=>calendarText(c,'results'));
});
test('a past result date asks to consult the award and never announces publication',()=>{
  const c={...seedData().contests[1],resultsDate:'2026-10-10'};
  const notices=upcomingNotices([c],new Date('2026-10-13T12:00:00'));assert.equal(notices.find(n=>n.kind==='results').label,'Consultar el fallo');assert.ok(!notices.some(n=>n.kind==='published'));
});
test('DOCX is a real ZIP document with quote formatting and no author metadata',async()=>{
  const {poems,contests}=seedData(),c=contests[0],entries=resolveSelection(poems,c.selections),blob=buildDocx(c,entries);
  const bytes=new Uint8Array(await blob.arrayBuffer());assert.equal(new DataView(bytes.buffer).getUint32(0,true),0x04034b50);
  const text=new TextDecoder().decode(bytes);assert.match(text,/word\/document.xml/);assert.match(text,/<w:i\/>/);assert.match(text,/Epígrafe de ejemplo/);assert.doesNotMatch(text,/dc:creator/);assert.doesNotMatch(text,/&gt; Todo/);
  const html=documentHtml(c,entries);assert.match(html,/<blockquote>/);assert.doesNotMatch(html,/&gt; Todo/);assert.match(html,/@page \{size:A4/);
});
