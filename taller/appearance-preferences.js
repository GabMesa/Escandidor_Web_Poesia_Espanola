import {visualPreferences} from '../visual-preferences.js';
import {showPoemColorPicker} from '../poem-color-picker.js';
import {escapeHtml as h} from './model.js';

export function createAppearancePreferences({state,showDialog,persist,apply,toast}) {
  const modal=document.querySelector('#modal');
  function open(){
    const p=visualPreferences(state.data.preferences.appearance);
    showDialog('Apariencia del taller',`<form id="visual-preferences-form"><p class="muted">Elegí cómo querés ver tu mesa. El color guardado de los poemas se conserva.</p><label>Color de tu mesa<button type="button" data-appearance-pick style="border-left:12px solid ${h(p.color)}">Elegir color · ${h(p.color)}</button><input type="hidden" name="color" value="${h(p.color)}"></label><label class="check"><input type="checkbox" name="newPoems" ${p.newPoems?'checked':''}>Ver los nuevos poemas con este color</label><label>Aplicar el color<select name="scope"><option value="poem" ${p.scope==='poem'?'selected':''}>Respetar el color de cada poema</option><option value="workshop" ${p.scope==='workshop'?'selected':''}>Toda la app, excepto Escandidor</option><option value="all" ${p.scope==='all'?'selected':''}>Toda la app, incluido Escandidor</option></select></label><p class="hint">Los poemas existentes mantienen sus colores. Podés desactivar esta preferencia para volver a verlos.</p><p data-appearance-status role="status"></p><div class="form-foot"><button type="button" data-action="close">Cancelar</button><button type="submit" class="primary">Guardar apariencia</button></div></form>`);
  }
  modal.addEventListener('click',event=>{
    if(!event.target.closest('[data-appearance-pick]'))return;
    const form=modal.querySelector('#visual-preferences-form');
    showPoemColorPicker({title:'Color de tu mesa',current:form.elements.color.value,onAccept:color=>{form.elements.color.value=color;const button=form.querySelector('[data-appearance-pick]');button.textContent='Elegir color · '+color;button.style.borderLeftColor=color;}});
  });
  modal.addEventListener('submit',async event=>{
    if(event.target.id!=='visual-preferences-form')return;
    event.preventDefault();event.stopPropagation();
    const form=event.target,data=new FormData(form),previous=visualPreferences(state.data.preferences.appearance);
    const next=visualPreferences({color:data.get('color'),scope:data.get('scope'),newPoems:data.has('newPoems'),since:previous.newPoems?previous.since:new Date().toISOString()});
    const button=form.querySelector('[type=submit]');button.disabled=true;form.setAttribute('aria-busy','true');form.querySelector('[data-appearance-status]').textContent='Aplicando apariencia…';
    const original=state.data.preferences.appearance;
    try{state.data.preferences.appearance=next;if(!persist())throw Error('No se pudo guardar la apariencia.');await apply();modal.close();toast('Apariencia guardada. Los colores de tus poemas se conservan.');}
    catch(error){state.data.preferences.appearance=original;persist();await apply().catch(()=>{});form.querySelector('[data-appearance-status]').textContent=error.message;}
    finally{button.disabled=false;form.removeAttribute('aria-busy');}
  });
  return {open};
}
