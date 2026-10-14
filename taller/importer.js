import {detectCoverRequirements} from './cover-policy.js';
function decodeEntities(text) {
  const named={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',aacute:'á',eacute:'é',iacute:'í',oacute:'ó',uacute:'ú',ntilde:'ñ',uuml:'ü',Aacute:'Á',Eacute:'É',Iacute:'Í',Oacute:'Ó',Uacute:'Ú',Ntilde:'Ñ',ordm:'º',ndash:'–',mdash:'—',laquo:'«',raquo:'»',hellip:'…'};
  return text.replace(/&(#x[\da-f]+|#\d+|\w+);/gi,(all,code)=>{if(code.startsWith('#')){const n=code[1].toLowerCase()==='x'?parseInt(code.slice(2),16):parseInt(code.slice(1),10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';}return named[code]??all;});
}
export function htmlText(html) {
  return decodeEntities(html.replace(/<(script|style)[\s\S]*?<\/\1>/gi,'').replace(/<\/(p|div|li|h\d|section)>|<br\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,' ')).replace(/[ \t]+/g,' ').split('\n').map(line=>line.trim()).filter(Boolean).join('\n');
}
const field=(text,label)=>text.match(new RegExp(label+'\\s*:\\s*([^\\n]+)','i'))?.[1]?.trim()||'';
function dateString(day,month,year){const value=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;const dt=new Date(value+'T12:00:00Z');return Number.isFinite(dt.getTime())&&dt.toISOString().startsWith(value)?value:'';}
export function parseDate(value) {
  const numeric=String(value).match(/\b(\d{1,2})[:/.-](\d{1,2})[:/.-](20\d{2})\b/);
  if(numeric)return dateString(numeric[1],numeric[2],numeric[3]);
  const words=String(value).toLowerCase().match(/\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?(20\d{2})\b/);
  if(words)return dateString(words[1],['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'].indexOf(words[2])+1,words[3]);
  return '';
}
export function parseContest(html,url,documentText='') {
  const text=htmlText(html);
  const name=htmlText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]||'Concurso importado').replace(/\s*-\s*Escritores.org[\s\S]*/i,'').slice(0,250);
  const closing=field(text,'Fecha de cierre de la convocatoria');
  const country=field(text,'País de la entidad convocante');
  const organizer=field(text,'Entidad convocante');
  const basesStart=text.indexOf('\nBASES');
  const bases=basesStart>=0?text.slice(basesStart+6):text;
  const body=(bases.split(/©|Condiciones para la reproducción|Para consultar todas las convocatorias|Importante: La información/)[0]+'\n'+documentText).slice(0,60000);
  const sentences=body.split(/\n|(?<=[.!?])\s+/);
  const resultsSentences=sentences.filter(s=>/fallo|resultados|se dar[áa] a conocer|se har[áa]n? p[úu]blic/i.test(s)&&/20\d{2}|mes|trimestre|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre/i.test(s)).slice(0,6);
  const publication=resultsSentences.find(s=>/p[úu]blic|dar[áa] a conocer|resultados/i.test(s)&&parseDate(s));
  const resultsDate=publication?parseDate(publication):resultsSentences.map(parseDate).find(Boolean)||'';
  const relevant=body.split('\n').filter(s=>/versos|página|carilla|portada|cubierta|plica|seudónimo|interlineado|formato|fuente|cuerpo|márgen|margen|papel|pdf|word|docx|entrega|correo|env[ií]o|inteligencia|inédit|residen|años|original/i.test(s)).join('\n').slice(0,6000);
  const links=[...html.matchAll(/href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].flatMap(m=>{try{const target=new URL(decodeEntities(m[1]),url);return /^https?:$/.test(target.protocol)?[{url:target.href,label:htmlText(m[2])}]:[];}catch{return [];}});
  const original=links.find(l=>!/escritores\.org/.test(new URL(l.url).hostname)&&/bases|premio|poes[ií]a|convocatoria|formulario/.test((l.label+' '+l.url).toLowerCase()));
  const attachments=links.filter(l=>/\.pdf(?:$|\?)/i.test(l.url)).slice(0,5);
  const formats=[...new Set([...body.matchAll(/\b(pdf|docx|word|odt)\b/gi)].map(m=>m[1].toUpperCase()))];
  const font=body.match(/Times New Roman|Calibri|Arial/i)?.[0]||'';
  const size=body.match(/(?:cuerpo|tamaño|puntos|fuente)\s*(?:de\s*)?(1[0-8])\b/i)?.[1]||body.match(/\b(1[0-8])\s*puntos/i)?.[1]||'';
  const spacing=/doble (?:espacio|interlineado)|interlineado doble/i.test(body)?2:/interlineado\s*(?:de\s*)?1[,.]5/i.test(body)?1.5:null;
  const paper=/\bA-?4\b/i.test(body)?'A4':/tamaño carta/i.test(body)?'Letter':'';
  const closingLines=sentences.filter(s=>/plazo|cerrar|cierra|terminar|finaliza|hasta|recepci[oó]n|admisi[oó]n/i.test(s));
  const time=closingLines.map(s=>s.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/)?.[0]).find(Boolean)||'';
  const timezone=/hora española|España peninsular/i.test(body)?'Europe/Madrid':'';
  const number=value=>({uno:1,un:1,dos:2,tres:3,cinco:5,diez:10,cien:100,ciento:100,quinientos:500,ochocientos:800}[String(value).toLowerCase()]||Number(value)||0);
  const maxPoems=number(body.match(/hasta\s+(\d+|diez|cinco|tres|dos|un)\s+poemas(?:\s+por\s+autor)?/i)?.[1])||number(body.match(/cada autor[^.\n]{0,65}?m[aá]ximo\s+de\s+(\d+)\s+trabajos/i)?.[1]);
  const perPoem=body.match(/los poemas constar[aá]n[^.\n]{0,180}/i)?.[0]||'';
  const minPoemVerses=number(perPoem.match(/(\d+)\s+versos\s+como\s+m[ií]nimo/i)?.[1]);
  const maxVerses=number(body.match(/cada poema[^.\n]{0,70}?(\d+|cien|diez)\s+versos/i)?.[1])||number(perPoem.match(/m[aá]ximo,?\s*(\d+)\s+versos/i)?.[1]);
  const range=body.match(/(?:entre|de)\s+(\d+)\s+(?:y|a)\s+(\d+)\s+versos/i);
  const minTotal=range?Number(range[1]):number(body.match(/m[ií]nimo\s*(?:de\s*)?(\d+|quinientos)\s*versos/i)?.[1]);
  const maxTotal=range?Number(range[2]):number(body.match(/m[aá]ximo\s*(?:de\s*)?(\d+|ochocientos)\s*versos/i)?.[1])||(minTotal?number(body.match(/m[ií]nimo[^.\n]{0,80}versos[^.\n]{0,40}m[aá]ximo\s+de\s+(\d+|ochocientos)\b/i)?.[1]):0);
  const plicaForbidden=/no se admitir[aá]n plicas|no[^.\n]{0,30}plica/i.test(body);
  const aiRequirement=sentences.filter(s=>/inteligencia artificial|generaci[oó]n textual|\bIA\b/.test(s)).join('\n').slice(0,2500);
  const aiPlacement=/primera p[aá]gina[^.\n]{0,220}(?:inteligencia artificial|\bIA\b)/i.test(body)?'obra':'unspecified';
  const coverRequirements=detectCoverRequirements(body);
  return {name,country,organizer,deadline:parseDate(closing)||closingLines.map(parseDate).find(Boolean)||'',deadlineTime:time,timezone,resultsDate,resultsNote:resultsSentences.join('\n'),sourceUrl:url,originalUrl:original?.url||'',delivery:field(text,'Participación por medios electrónicos')==='No'?'Entrega física: revisar las bases':/formulario|presentaci[oó]n telem[aá]tica/i.test(body)?'Formulario del organizador':formats.length?`Formatos detectados: ${formats.join(', ')}`:'Revisar medio de entrega',minPoemVerses,verseCounting:/incluyendo[^.\n]{0,100}t[i?]tulo[^.\n]{0,100}espacios/i.test(body)?'includes-title-and-blanks':'body',rules:relevant||'Los requisitos no se pudieron extraer. Revisá las bases enlazadas.',maxPoems,maxVerses,minTotal,maxTotal,plicaRequired:plicaForbidden?false:/plica/i.test(body)?true:null,aiRequirement,aiPlacement,coverRequirements,profile:{font:font||'Times New Roman',size:Number(size)||12,lineSpacing:spacing||1.5,paper:paper||'A4',margin:2.5,cover:coverRequirements.kind==='cover',newPage:true,numbered:/numerad|paginad/i.test(body),quoteItalic:true,pseudonym:'',workTitle:'',coverContestName:false,coverTitle:true,coverPseudonym:!coverRequirements.signatureForbidden,coverVerses:coverRequirements.verses,coverMotto:'',coverStatement:'',coverAlignment:'center',coverPosition:'top'},detected:{font:!!font,size:!!size,lineSpacing:!!spacing,paper:!!paper,maxPoems:!!maxPoems,maxVerses:!!maxVerses,minTotal:!!minTotal,maxTotal:!!maxTotal},attachments,extractedAt:new Date().toISOString(),excerpt:body,reviewed:false};
}
export function validateWritersUrl(value) {
  const url=new URL(value);
  if(url.protocol!=='https:'||!['escritores.org','www.escritores.org'].includes(url.hostname)||url.port||url.username||url.password)throw Error('Pegá una URL HTTPS de escritores.org.');
  if(!/^\/(recursos-para-escritores|concursos)\//.test(url.pathname))throw Error('Pegá el enlace de una convocatoria de Escritores.org.');
  url.hash='';return url;
}
export async function fetchContest(value,{extractPdf}={}) {
  let url=validateWritersUrl(value);
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
  try {
    let response;
    for(let count=0;count<4;count++){
      response=await fetch(url,{redirect:'manual',signal:controller.signal,headers:{'User-Agent':'MesaDePoesia-LocalPrototype/1.0','Accept':'text/html'}});
      if([301,302,303,307,308].includes(response.status)){url=validateWritersUrl(new URL(response.headers.get('location'),url).href);continue;}
      break;
    }
    if(!response?.ok)throw Error(`Escritores.org respondió ${response?.status||'sin datos'}. Podés completar la ficha manualmente.`);
    if(!/text\/html/i.test(response.headers.get('content-type')||''))throw Error('Pegá la página de la convocatoria, no el archivo PDF.');
    const reader=response.body.getReader();let size=0;const chunks=[];
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2000000){await reader.cancel();throw Error('La página es demasiado grande.');}chunks.push(value);}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    const html=new TextDecoder().decode(bytes);
    let contest=parseContest(html,url.href);
    const pdfRead=[];let pdfText='';
    if(extractPdf){for(const link of contest.attachments.slice(0,2)){
      try{
        const pdfUrl=validateWritersUrl(link.url);
        if(!/\.pdf$/i.test(pdfUrl.pathname))continue;
        const response=await fetch(pdfUrl,{redirect:'error',signal:AbortSignal.timeout(12000)});
        if(!response.ok)throw Error('No disponible');
        const reader=response.body.getReader(),parts=[];let length=0;
        while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>8000000){await reader.cancel();throw Error('PDF demasiado grande');}parts.push(value);}
        const bytes=new Uint8Array(length);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
        const extracted=await extractPdf(bytes);pdfText+='\n'+extracted.text;pdfRead.push({url:link.url,ok:true,pages:extracted.pages,sparsePages:extracted.sparsePages,imagePages:extracted.imagePages});
      }catch(e){pdfRead.push({url:link.url,ok:false,error:e.message});}
    }}
    if(pdfText)contest=parseContest(html,url.href,pdfText);
    contest.pdfRead=pdfRead;
    if(!contest.deadline && /concursos literarios POESÍA/i.test(contest.name))throw Error('Ese enlace es el listado. Abrí un concurso y copiá su URL individual.');
    return contest;
  } finally {clearTimeout(timeout);}
}
