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
export function seedData() {
  const poem=(id,title,tags,text,day)=>({id,title,tags,demo:true,versions:[{id:id+'-v1',label:'Versión 1',versionNumber:1,savedAt:`2026-10-${day}T13:00:00-03:00`,poemText:text},{id:id+'-v2',label:'Versión 2',versionNumber:2,savedAt:`2026-10-${day}T17:00:00-03:00`,poemText:text}]});
  const poems=[poem('orilla','La orilla que vuelve',['mar','listo para enviar'],'> Todo vuelve a su lugar,\n> incluso lo que nunca se ha marchado.\n> — Epígrafe de ejemplo\n\nLa tarde deja un hilo sobre el agua,\ny el agua lo devuelve a la ribera.\nHay una casa al fondo de la lluvia,\nhay una luz que insiste y que me espera.\n\nNo sé volver sin traer conmigo\nla voz del mar doblada en el abrigo.','12'),poem('patio','Un patio en octubre',['memoria','revisar'],'La sombra del limonero\nse demora en la pared.\nMi madre riega la tarde\ncomo si fuera a volver.\n\nY en las baldosas del patio\nqueda su nombre de pie.','11'),poem('casa','La casa del viento',['soneto','listo para enviar'],'Abro la puerta y entra la mañana,\ntrae en sus manos una luz pequeña.\nLa casa escucha, el corazón se empeña\nen darle un nombre al aire en la ventana.','10'),poem('ciudad','Inventario de una ciudad',['ciudad','revisar'],'Una esquina, dos luces, tres ausencias.\nLa ciudad se recuesta sobre el río.\nHay un nombre borrado en cada muro,\ny un pájaro que aprende a decir frío.','09'),poem('silencio','Lo que guarda el silencio',['memoria','listo para enviar'],'No todo lo que calla está vacío.\nLa piedra guarda el paso de la lluvia.\nLa mesa guarda un sitio para alguien.\nYo guardo una palabra todavía.','08'),poem('carta','Carta sin destino',['mar','borrador'],'Escribo desde el borde de la arena,\ndonde las cosas pierden su contorno.\nSi llega esta palabra hasta tus manos,\ndevolvé al mar su forma de retorno.','07')];
  const profile={font:'Times New Roman',size:12,lineSpacing:1.5,paper:'A4',margin:2.5,cover:true,newPage:true,numbered:true,quoteItalic:true,pseudonym:'Junco',workTitle:'La memoria del agua'};
  const contests=[{id:'manini',name:'Dr. Alberto Manini Ríos · 2026',country:'Uruguay',organizer:'AEDI Uruguay',deadline:'2026-11-27',deadlineTime:'',timezone:'',resultsDate:'',resultsNote:'Fallo previsto durante febrero de 2027; sin día exacto.',sourceUrl:'https://www.escritores.org/recursos-para-escritores/42187-48-concurso-literario-dr-alberto-manini-rios-2026',originalUrl:'',status:'preparing',demo:true,delivery:'Papel · tres copias a una cara',rules:'Hasta 10 poemas. Máximo 100 versos por poema. A4, cuerpo 12, Calibri, Times New Roman o similar. Páginas numeradas. Seudónimo y plica en sobre separado. Sin imágenes ni decoraciones.',maxPoems:10,maxVerses:100,minTotal:0,maxTotal:0,selections:[{poemId:'orilla',versionId:'latest'}],profile:{...profile,cover:false},reminders:[14,7,2],snapshots:[]},{id:'berceo',name:'Gonzalo de Berceo · III Premio',country:'España',organizer:'Fundación San Millán de la Cogolla',deadline:'2026-12-04',deadlineTime:'23:59',timezone:'Europe/Madrid',resultsDate:'2027-04-23',resultsNote:'Fallo a finales del primer trimestre; publicación el 23 de abril de 2027.',sourceUrl:'https://www.escritores.org/recursos-para-escritores/41991-iii-premio-internacional-de-poesia-gonzalo-de-berceo',originalUrl:'https://www.fsanmillan.es/premiodepoesia/',status:'interested',demo:true,delivery:'Formulario · obra y plica en PDF',rules:'Entre 500 y 800 versos. Portada con número de versos. Primera página con declaración sobre ausencia de generación textual mediante IA. Dos PDF separados, máximo 10 MB cada uno.',maxPoems:0,maxVerses:0,minTotal:500,maxTotal:800,selections:[],profile:{...profile},reminders:[14,7,2],snapshots:[]},{id:'example',name:'Certamen del Río · ejemplo de resultados',country:'Ejemplo',organizer:'Convocatoria ficticia para probar el flujo',deadline:'2026-10-01',deadlineTime:'',timezone:'',resultsDate:'2026-10-12',resultsNote:'Fecha de ejemplo.',resultsUrl:'https://www.escritores.org/concursos/concursos-1/concursos-poesia',sourceUrl:'',originalUrl:'',status:'sent',demo:true,delivery:'Ejemplo de entrega digital',rules:'Datos ficticios para probar avisos de resultados publicados.',maxPoems:0,maxVerses:0,minTotal:0,maxTotal:0,selections:[],profile:{...profile},reminders:[7,2],snapshots:[]}];
  return {schemaVersion:1,poems,contests,localTags:{}};
}
