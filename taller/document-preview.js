import {escapeHtml as h} from './model.js';
import {coverHtml,coverOptions} from './cover-policy.js';
import {paginateDeliveryEntries,workHeaderOptions,renderPoemContentHtml} from './delivery-format.js';

export function documentPreview(contest,entries,view='poem'){
  const p=contest.profile;
  const paperWidthCm=p.paper==='Letter'?21.59:21;
  const marginPct=Math.min(18,Math.max(4,Number((((Number(p.margin)||2.5)/paperWidthCm)*100).toFixed(2))));
  const sheet=(content,number,extraClass='')=>`<article class="paper${extraClass?' '+extraClass:''}" aria-label="Página ${number}" style="--paper-ratio:${p.paper==='Letter'?'8.5 / 11':'210 / 297'};--paper-margin:${marginPct}%;font-family:'${h(p.font)}',serif;font-size:${p.size*1.25}px;line-height:${p.lineSpacing}"><div class="paper-content">${content}</div>${p.numbered?`<footer class="page-number" aria-label="Número de página">${number}</footer>`:''}</article>`;

  if(view==='cover'&&p.cover){
    return sheet(coverHtml(contest,entries),1,'paper-cover');
  }
  if(!entries.length)return '<div class="empty">Seleccioná poemas desde el concurso para previsualizar.</div>';

  const pages=paginateDeliveryEntries(contest,entries);
  const workHeader=workHeaderOptions(contest,entries);
  const showInlinePseudonym=!p.cover&&Boolean(p.pseudonym)&&coverOptions(contest).pseudonym;
  const firstPageNumber=p.cover?2:1;

  return pages.map((page,pageIndex)=>{
    const headerHtml=pageIndex===0&&!p.cover&&(workHeader.showTitle||workHeader.showDate)
      ?`<header class="work-header">${workHeader.showTitle?`<h1 class="work-title">${h(workHeader.titleText)}</h1>`:''}${workHeader.showDate&&workHeader.dateText?`<p class="work-date">${h(workHeader.dateText)}</p>`:''}</header>`
      :'';
    const poemsHtml=page.items.map(item=>{
      const rendered=renderPoemContentHtml(item.entry,item.format,{
        size:item.effectiveSize,
        lineSpacing:item.effectiveLineSpacing,
        quoteItalic:p.quoteItalic!==false,
        scalePx:1.25,
        showPseudonym:showInlinePseudonym?p.pseudonym:'',
        forPrint:false
      });
      const fitNote=item.fit.fitted?`<p class="poem-fit-indicator" aria-label="Ajustado para entrar en una hoja">Ajustado a ${item.effectiveSize} pt · interlineado ${item.effectiveLineSpacing} para entrar en 1 hoja</p>`:'';
      return `<section class="preview-poem${item.format.columns>1?` has-columns cols-${item.format.columns}`:''}${item.format.fitOnePage?' fit-one-page':''}" data-poem-id="${h(item.entry.poem.id)}" style="${rendered.sectionStyle}">${rendered.headerHtml}${rendered.bodyHtml}${fitNote}</section>`;
    }).join('');
    const bodyHtml=page.isSideBySide
      ?`<div class="sheet-multi-cols" style="--sheet-cols:${page.items.length}">${poemsHtml}</div>`
      :poemsHtml;
    return sheet(headerHtml+bodyHtml,firstPageNumber+pageIndex,page.isSideBySide?'paper-multi-cols':'');
  }).join('');
}
