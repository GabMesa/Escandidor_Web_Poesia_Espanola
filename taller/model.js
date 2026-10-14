import {sortPoemVersions} from '../poem-exports.js';
export const STORAGE_KEY = 'escandador.contestsPrototype.v1';
export const LIBRARY_KEY = 'escandador.poemMemory.v1';
export const WRITERS_LIST = 'https://www.escritores.org/concursos/concursos-1/concursos-poesia';
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export const normalizeTag = value => String(value).trim().normalize('NFC').toLocaleLowerCase('es');
export const tagsFromText = value => [...new Set(String(value).split(',').map(normalizeTag).filter(Boolean))].slice(0,30);
export function latestVersion(poem){return sortPoemVersions(poem?.versions||[]).at(-1);}
export function resolveSelection(poems, selections) {
  return selections.map(selection => {
    const poem = poems.find(p => p.id === selection.poemId);
    const version = selection.versionId === 'latest' ? latestVersion(poem) : poem?.versions.find(v => v.id === selection.versionId);
    return {selection, poem, version};
  });
}
export function poemBlocks(text) {
  const blocks=[];
  for(const line of String(text).replace(/\r\n?/g,'\n').split('\n')){
    if(/^\s*>/.test(line)){
      const content=line.replace(/^\s*> ?/,'');
      if(blocks.at(-1)?.type==='quote') blocks.at(-1).lines.push(content);
      else blocks.push({type:'quote',lines:[content]});
    } else blocks.push({type:line.trim()?'verse':'blank',lines:[line]});
  }
  return blocks;
}
export function countLines(text) {
  const blocks=poemBlocks(text);
  return {verses:blocks.filter(b=>b.type==='verse').length,quotes:blocks.filter(b=>b.type==='quote').reduce((n,b)=>n+b.lines.filter(l=>l.trim()).length,0)};
}
export function calendarText(contest, kind='deadline') {
  const date=kind==='results'?contest.resultsDate:contest.deadline;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')) throw Error('Falta una fecha exacta para el calendario.');
  const escape=value=>String(value||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
  const compact=date.replace(/-/g,'');
  const next=new Date(`${date}T12:00:00Z`);next.setUTCDate(next.getUTCDate()+1);
  const end=next.toISOString().slice(0,10).replace(/-/g,'');
  // An all-day event avoids inventing an unknown closing hour or timezone.
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Mesa de Poesia//Concursos//ES','CALSCALE:GREGORIAN','BEGIN:VEVENT',`UID:${contest.id}-${kind}@mesa-de-poesia.local`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}`,`DTSTART;VALUE=DATE:${compact}`,`DTEND;VALUE=DATE:${end}`,`SUMMARY:${escape((kind==='results'?'Fallo previsto: ':'Cierre: ')+contest.name)}`,`DESCRIPTION:${escape(`Revisar las bases. Hora: ${contest.deadlineTime||'no indicada'}. Zona: ${contest.timezone||'no indicada'}. ${contest.sourceUrl||''}`)}`,...(contest.reminders||[7,2]).flatMap(days=>['BEGIN:VALARM',`TRIGGER:-P${days}D`,'ACTION:DISPLAY','DESCRIPTION:Recordatorio de concurso','END:VALARM']),'END:VEVENT','END:VCALENDAR',''].join('\r\n');
}
export function upcomingNotices(contests, now=new Date()) {
  const today=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime();
  const notices=[];
  for(const c of contests){
    if(c.agendaEnabled===false)continue;
    if(c.resultsUrl) notices.push({kind:'published',contest:c,label:'Resultados publicados',detail:c.demo?'Ejemplo de publicación. No corresponde a un fallo real.':'Enlace de resultados confirmado por vos.'});
    if(!['sent','closed'].includes(c.status) && c.deadline){
      const days=Math.round((new Date(c.deadline+'T00:00:00').getTime()-today)/86400000);
      if(days>=0 && days<=Math.max(...(c.reminders||[14,7,2])))notices.push({kind:'deadline',contest:c,label:days===0?'Cierra hoy':`Cierra en ${days} días`,detail:c.deadlineTime?`Hora indicada: ${c.deadlineTime} · ${c.timezone||'zona no indicada'}`:'Hora de cierre no indicada: revisá las bases.'});
      if(days<0)notices.push({kind:'expired',contest:c,label:'Plazo de recepción pasado',detail:'Revisá las bases antes de preparar una entrega.'});
    }
    if(!c.resultsUrl && c.resultsDate){
      const days=Math.round((new Date(c.resultsDate+'T00:00:00').getTime()-today)/86400000);
      if(days<=7)notices.push({kind:'results',contest:c,label:days<=0?'Consultar el fallo':`Fallo previsto en ${days} días`,detail:'La fecha prevista no confirma que los resultados se hayan publicado.'});
    }
  }
  return notices;
}
export function readEditorLibrary(storage) {
  try {
    const data=JSON.parse(storage.getItem(LIBRARY_KEY)||'{}');
    return Object.entries(data.poems||{}).filter(([,v])=>Array.isArray(v)&&v.length).map(([key,versions])=>({id:'local:'+key,title:versions.find(v=>v.poemTitle)?.poemTitle||key,local:true,tags:[],versions:versions.map(v=>({...v,id:String(v.id),poemText:v.poemText||''}))}));
  } catch{return [];}
}
export const defaultContestProfile=()=>({font:'Times New Roman',size:12,lineSpacing:1.5,paper:'A4',margin:2.5,cover:true,newPage:true,numbered:true,quoteItalic:true,pseudonym:'',workTitle:''});
export const createEmptyWorkshop=()=>({schemaVersion:1,poems:[],contests:[],localTags:{},tagCatalog:[],tagColors:{},preferences:{}});
