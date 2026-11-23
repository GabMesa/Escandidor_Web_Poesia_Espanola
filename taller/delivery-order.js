import {escapeHtml as h} from './model.js';
import {
  ALLOWED_FONTS,
  cleanPoemOverride,
  hasPoemOverride,
  resolvePoemFormat,
  poemFormatBadges,
  formatDisplayDate
} from './delivery-format.js';

export function moveDeliveryPoem(selections,poemId,direction){
  const index=selections.findIndex(selection=>selection.poemId===poemId),target=index+direction;
  if(![-1,1].includes(direction)||index<0||target<0||target>=selections.length)return selections;
  const ordered=[...selections];
  [ordered[index],ordered[target]]=[ordered[target],ordered[index]];
  return ordered;
}

function poemConfigHtml(contest,entry,index){
  const id=h(entry.selection.poemId);
  const override=cleanPoemOverride(entry.selection.format);
  const resolved=resolvePoemFormat(contest,entry);
  const customized=hasPoemOverride(entry.selection);
  const autoDate=entry.version?.savedAt?formatDisplayDate('',new Date(entry.version.savedAt)):formatDisplayDate('');
  const boolValue=val=>val===true?'yes':val===false?'no':'inherit';
  return `<div class="delivery-poem-config" data-poem-config-panel="${id}">
    <div class="delivery-poem-config-head">
      <span class="small muted">${customized?'Configuración propia de este poema':'Usando el formato general de la entrega'}</span>
      ${customized?`<button type="button" class="quiet small" data-action="reset-poem-format" data-id="${id}">Restablecer</button>`:''}
    </div>
    <div class="form-grid">
      <label class="full">Ubicación en la hoja
        <select data-poem-format="pageBreak" data-id="${id}">
          <option value="inherit" ${(override.pageBreak||'inherit')==='inherit'?'selected':''}>Según disposición general</option>
          <option value="new" ${override.pageBreak==='new'?'selected':''}>Empezar en hoja nueva</option>
          ${index>0?`<option value="same" ${override.pageBreak==='same'?'selected':''}>En la misma hoja que el anterior</option>`:''}
        </select>
      </label>
      <label>Columnas
        <select data-poem-format="columns" data-id="${id}">
          <option value="" ${override.columns===undefined?'selected':''}>General (${contest?.profile?.poemStyle?.columns||1})</option>
          <option value="1" ${override.columns===1?'selected':''}>1 columna</option>
          <option value="2" ${override.columns===2?'selected':''}>2 columnas</option>
          <option value="3" ${override.columns===3?'selected':''}>3 columnas</option>
        </select>
      </label>
      <label>Alineación
        <select data-poem-format="align" data-id="${id}">
          <option value="" ${!override.align?'selected':''}>General</option>
          <option value="left" ${override.align==='left'?'selected':''}>Izquierda</option>
          <option value="center" ${override.align==='center'?'selected':''}>Centrada</option>
          <option value="right" ${override.align==='right'?'selected':''}>Derecha</option>
          <option value="hemistich" ${override.align==='hemistich'?'selected':''}>Por hemistiquio</option>
        </select>
      </label>
      <label class="check full"><input type="checkbox" data-poem-format="fitOnePage" data-id="${id}" ${resolved.fitOnePage?'checked':''}>Ajustar para que entre completo en una hoja</label>
      ${resolved.align==='hemistich'?`
      <label>Corte hemistiquio
        <input type="text" data-poem-format="hemistichCut" data-id="${id}" value="${h(override.hemistichCut??'')}" placeholder="Auto (ej.: 7 o 6)">
      </label>
      <label>Cesura
        <select data-poem-format="hemistichGap" data-id="${id}">
          <option value="" ${!override.hemistichGap?'selected':''}>General</option>
          <option value="compact" ${override.hemistichGap==='compact'?'selected':''}>Compacta</option>
          <option value="normal" ${override.hemistichGap==='normal'?'selected':''}>Normal</option>
          <option value="wide" ${override.hemistichGap==='wide'?'selected':''}>Amplia</option>
        </select>
      </label>`:''}
      <label>Título del poema
        <select data-poem-format="showTitle" data-id="${id}">
          <option value="inherit" ${boolValue(override.showTitle)==='inherit'?'selected':''}>General</option>
          <option value="yes" ${boolValue(override.showTitle)==='yes'?'selected':''}>Mostrar</option>
          <option value="no" ${boolValue(override.showTitle)==='no'?'selected':''}>Ocultar</option>
        </select>
      </label>
      <label>Fecha del poema
        <select data-poem-format="showDate" data-id="${id}">
          <option value="inherit" ${boolValue(override.showDate)==='inherit'?'selected':''}>General</option>
          <option value="yes" ${boolValue(override.showDate)==='yes'?'selected':''}>Mostrar</option>
          <option value="no" ${boolValue(override.showDate)==='no'?'selected':''}>Ocultar</option>
        </select>
      </label>
      ${resolved.showDate?`<label class="full">Fecha personalizada<input type="text" data-poem-format="dateText" data-id="${id}" value="${h(override.dateText||'')}" placeholder="${h(autoDate||'Ej.: noviembre de 2026')}"></label>`:''}
      <label>Alineación título
        <select data-poem-format="titleAlign" data-id="${id}">
          <option value="inherit" ${!override.titleAlign?'selected':''}>Según poema</option>
          <option value="left" ${override.titleAlign==='left'?'selected':''}>Izquierda</option>
          <option value="center" ${override.titleAlign==='center'?'selected':''}>Centrada</option>
          <option value="right" ${override.titleAlign==='right'?'selected':''}>Derecha</option>
        </select>
      </label>
      <label>Estilo título
        <select data-poem-format="titleStyle" data-id="${id}">
          <option value="" ${!override.titleStyle?'selected':''}>General</option>
          <option value="bold" ${override.titleStyle==='bold'?'selected':''}>Negrita</option>
          <option value="normal" ${override.titleStyle==='normal'?'selected':''}>Normal</option>
          <option value="italic" ${override.titleStyle==='italic'?'selected':''}>Cursiva</option>
          <option value="uppercase" ${override.titleStyle==='uppercase'?'selected':''}>MAYÚSCULAS</option>
        </select>
      </label>
      <label>Espacio estrofas
        <select data-poem-format="stanzaGap" data-id="${id}">
          <option value="" ${!override.stanzaGap?'selected':''}>General</option>
          <option value="compact" ${override.stanzaGap==='compact'?'selected':''}>Compacto</option>
          <option value="normal" ${override.stanzaGap==='normal'?'selected':''}>Normal</option>
          <option value="wide" ${override.stanzaGap==='wide'?'selected':''}>Amplio</option>
        </select>
      </label>
      <label>Sangría (cm)
        <input type="number" min="0" max="5" step="0.25" data-poem-format="indent" data-id="${id}" value="${override.indent!==undefined?override.indent:''}" placeholder="${contest?.profile?.poemStyle?.indent||0}">
      </label>
      <label>Tamaño (pt)
        <input type="number" min="8" max="24" step="0.5" data-poem-format="size" data-id="${id}" value="${override.size!==undefined?override.size:''}" placeholder="${contest?.profile?.size||12}">
      </label>
      <label>Interlineado
        <select data-poem-format="lineSpacing" data-id="${id}">
          <option value="" ${override.lineSpacing===undefined?'selected':''}>General (${contest?.profile?.lineSpacing||1.5})</option>
          ${[1,1.15,1.5,2].map(n=>`<option value="${n}" ${override.lineSpacing===n?'selected':''}>${n===2?'Doble':n}</option>`).join('')}
        </select>
      </label>
      <label class="full">Tipografía
        <select data-poem-format="font" data-id="${id}">
          <option value="" ${!override.font?'selected':''}>General (${h(contest?.profile?.font||'Times New Roman')})</option>
          ${ALLOWED_FONTS.map(f=>`<option value="${h(f)}" ${override.font===f?'selected':''}>${h(f)}</option>`).join('')}
        </select>
      </label>
    </div>
  </div>`;
}

export function deliveryOrderHtml(entries,{contest=null,expandedPoemId=''}={}){
  return `<section class="panel delivery-order" aria-labelledby="delivery-order-title"><h2 id="delivery-order-title">Poemas de la entrega</h2><p class="hint">Ordená los poemas, abrilos en la mesa para editarlos o configurá el formato de cada uno por separado.</p>${entries.length?`<ol>${entries.map((entry,index)=>{
    const title=entry.poem?.title||'Poema no disponible',id=h(entry.selection.poemId);
    const isExpanded=expandedPoemId&&expandedPoemId===entry.selection.poemId;
    const badges=contest&&entry.poem?poemFormatBadges(contest,entry):[];
    const customized=hasPoemOverride(entry.selection);
    return `<li class="${isExpanded?'is-expanded':''}">
      <div class="delivery-order-row">
        <span class="delivery-order-title"><strong>${h(title)}</strong>${!entry.version?'<span class="hint">Versión no disponible. Revisá la selección en el concurso.</span>':''}${badges.length?`<span class="delivery-poem-badges">${badges.map(b=>`<span class="tag gray">${h(b)}</span>`).join('')}</span>`:''}</span>
        <div class="delivery-order-actions">
          <button type="button" data-action="move-delivery-poem" data-id="${id}" data-direction="-1" aria-label="${h('Subir '+title)}" title="Subir"${index===0?' disabled':''}>↑</button>
          <button type="button" data-action="move-delivery-poem" data-id="${id}" data-direction="1" aria-label="${h('Bajar '+title)}" title="Bajar"${index===entries.length-1?' disabled':''}>↓</button>
        </div>
      </div>
      ${entry.poem?`<div class="delivery-poem-tools">
        <button type="button" class="quiet small" data-action="edit-delivery-poem" data-id="${id}" aria-label="${h('Editar '+title+' en la mesa')}">Editar en la mesa ↗</button>
        <button type="button" class="${customized?'':'quiet '}small" data-action="toggle-poem-config" data-id="${id}" aria-expanded="${isExpanded?'true':'false'}">${isExpanded?'Ocultar formato':customized?'Formato propio ▾':'Configurar ▾'}</button>
      </div>`:''}
      ${isExpanded&&entry.poem?poemConfigHtml(contest,entry,index):''}
    </li>`;
  }).join('')}</ol>`:'<p class="hint">Seleccioná poemas desde el concurso para ordenar tu entrega.</p>'}</section>`;
}
