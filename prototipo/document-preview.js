import {escapeHtml as h,poemBlocks,countLines} from './model.js';
import {coverHtml,coverOptions} from './cover-policy.js';

export function documentPreview(contest,entries,view='poem'){
  const p=contest.profile;
  const sheet=(content,number)=>`<article class="paper" aria-label="Página ${number}" style="--paper-ratio:${p.paper==='Letter'?'8.5 / 11':'210 / 297'};font-family:'${h(p.font)}',serif;font-size:${p.size*1.25}px;line-height:${p.lineSpacing}"><div class="paper-content">${content}</div>${p.numbered?`<footer class="page-number" aria-label="Número de página">${number}</footer>`:''}</article>`;
  if(view==='cover'&&p.cover){
    return sheet(coverHtml(contest,entries),1);
  }
  if(!entries.length)return '<div class="empty">Seleccioná poemas desde el concurso para previsualizar.</div>';
  const poems=entries.map(e=>`<section class="preview-poem"><h2 style="font-family:inherit;font-size:inherit">${h(e.poem.title)}</h2>${!p.cover&&p.pseudonym&&coverOptions(contest).pseudonym?`<p>${h(p.pseudonym)}</p>`:''}${poemBlocks(e.version.poemText).map(b=>b.type==='quote'?`<blockquote style="font-style:${p.quoteItalic?'italic':'normal'}">${h(b.lines.join('\n'))}</blockquote>`:`<div class="verse" style="min-height:${p.size*p.lineSpacing*1.25}px">${h(b.lines[0])||'&nbsp;'}</div>`).join('')}</section>`);
  const first=p.cover?2:1;
  return p.newPage?poems.map((poem,i)=>sheet(poem,first+i)).join(''):sheet(poems.join(''),first);
}
