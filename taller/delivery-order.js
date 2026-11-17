import {escapeHtml as h} from './model.js';

export function moveDeliveryPoem(selections,poemId,direction){
  const index=selections.findIndex(selection=>selection.poemId===poemId),target=index+direction;
  if(![-1,1].includes(direction)||index<0||target<0||target>=selections.length)return selections;
  const ordered=[...selections];
  [ordered[index],ordered[target]]=[ordered[target],ordered[index]];
  return ordered;
}

export function deliveryOrderHtml(entries){
  return `<section class="panel delivery-order" aria-labelledby="delivery-order-title"><h2 id="delivery-order-title">Orden de los poemas</h2><p class="hint">Subí o bajá los poemas para elegir el orden de la entrega. Se guarda para este concurso y se aplica a la vista previa, al DOCX y al PDF.</p>${entries.length?`<ol>${entries.map((entry,index)=>{
    const title=entry.poem?.title||'Poema no disponible',id=h(entry.selection.poemId);
    return `<li><span class="delivery-order-title">${h(title)}${!entry.version?'<span class="hint">Versión no disponible. Revisá la selección en el concurso.</span>':''}</span><div class="delivery-order-actions"><button type="button" data-action="move-delivery-poem" data-id="${id}" data-direction="-1" aria-label="${h('Subir '+title)}" ${index===0?'disabled':''}>↑</button><button type="button" data-action="move-delivery-poem" data-id="${id}" data-direction="1" aria-label="${h('Bajar '+title)}" ${index===entries.length-1?'disabled':''}>↓</button></div></li>`;
  }).join('')}</ol>`:'<p class="hint">Seleccioná poemas desde el concurso para ordenar tu entrega.</p>'}</section>`;
}
