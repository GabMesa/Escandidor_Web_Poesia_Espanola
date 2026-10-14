import {countLines,escapeHtml as h} from './model.js';
export function detectCoverRequirements(text){
  const flat=String(text||'').replace(/\s+/g,' ');
  const signatureForbidden=/uso de seud[oó]nimos excluye|sin firma|ninguna clase de firma|sin firmar|sin[^.]{0,40}datos personales/i.test(flat);
  const coverMention=/\bportada\b|\bcubierta\b/i.test(flat);
  const firstPage=/primera p[aá]gina|primera hoja/i.test(flat);
  const verses=/portada[^.]{0,150}(?:n[uú]mero de versos|versos)|(?:n[uú]mero de versos)[^.]{0,100}portada/i.test(flat);
  const ai=/primera p[aá]gina[^.]{0,500}(?:inteligencia artificial|\bIA\b)/i.test(flat);
  return {kind:coverMention?'cover':firstPage?'first-page':'unspecified',verses,ai,signatureForbidden};
}
export function coverOptions(contest){
  const p=contest.profile,requirements=contest.coverRequirements||detectCoverRequirements(contest.rules);
  return {contestName:p.coverContestName===true,title:p.coverTitle!==false,pseudonym:p.coverPseudonym!==false&&!requirements.signatureForbidden,verses:p.coverVerses===undefined?requirements.verses:p.coverVerses===true,motto:String(p.coverMotto||''),statement:String(p.coverStatement||''),alignment:p.coverAlignment==='left'?'left':'center',position:p.coverPosition==='middle'?'middle':'top'};
}
export function coverLines(contest,entries){
  const p=contest.profile,o=coverOptions(contest),lines=[];
  if(o.contestName)lines.push({text:contest.name,type:'contest'});
  if(o.title)lines.push({text:p.workTitle|| (entries.length===1?entries[0].poem.title:'Poemario'),type:'title'});
  if(o.motto)lines.push({text:o.motto,type:'motto'});
  if(o.pseudonym&&p.pseudonym)lines.push({text:p.pseudonym,type:'pseudonym'});
  if(o.verses)lines.push({text:entries.reduce((n,e)=>n+countLines(e.version.poemText).verses,0)+' versos',type:'verses'});
  if(o.statement)lines.push({text:o.statement,type:'statement'});
  return lines;
}
export function coverHtml(contest,entries){const o=coverOptions(contest);return `<div class="cover" style="text-align:${o.alignment};padding-top:${o.position==='middle'?'5cm':'0'}">${coverLines(contest,entries).map(l=>l.type==='title'?`<h2>${h(l.text)}</h2>`:`<p class="cover-${l.type}">${h(l.text)}</p>`).join('')}</div>`;}
export function coverWarnings(contest){const o=coverOptions(contest),r=contest.coverRequirements||detectCoverRequirements(contest.rules),warnings=[];if(r.verses&&(!contest.profile.cover||!o.verses))warnings.push('Las bases piden el número de versos en la portada.');if(r.ai&&(!contest.profile.cover||!o.statement.trim()))warnings.push('Las bases piden una declaración de IA en la primera página de la obra.');if(r.signatureForbidden&&contest.profile.pseudonym)warnings.push('Las bases excluyen la firma o el seudónimo: no se incluirá en la obra.');return warnings;}
