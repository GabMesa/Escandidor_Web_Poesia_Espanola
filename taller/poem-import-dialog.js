import {previewPoemImport} from '../poem-import-plan.js';
import {escapeHtml as h} from './model.js';

export function createPoemImportDialog({allPoems,showDialog,command,render,toast}){
  const modal=document.querySelector('#modal');let preview=[],running=false;
  function updateSelection(){
    const selected=modal.querySelectorAll('[name=include]:checked').length,total=preview.length;
    const button=modal.querySelector('[data-import-confirm]');if(!button)return;
    button.disabled=!selected;button.textContent=`Importar ${selected} ${selected===1?'poema':'poemas'}`;
    modal.querySelector('[data-import-selected]').textContent=`${selected} de ${total} seleccionados`;
    const all=modal.querySelector('[data-import-all]');all.checked=selected===total;all.indeterminate=selected>0&&selected<total;
  }
  async function open(file){
    if(running)return;
    if(file.size>2000000)throw Error('El archivo supera 2 MB.');
    preview=previewPoemImport(await file.text(),allPoems());
    if(!preview.length)throw Error('El archivo debe tener títulos con # y texto debajo.');
    showDialog('Revisar importación',`<form id="poem-import-form"><p class="muted">${h(file.name)} · ${preview.length} poemas. Elegí cuáles traer y dónde guardar los que ya tienen el mismo título. El historial existente se conserva.</p><div class="import-selection"><label class="check"><input type="checkbox" data-import-all checked>Seleccionar todos</label><span data-import-selected></span></div><div class="import-poems">${preview.map(p=>`<article class="import-poem"><label class="check import-title"><input type="checkbox" name="include" value="${p.index}" checked><strong>${h(p.title)}</strong></label><p class="small muted import-excerpt">${h(p.text.split('\n').find(l=>l.trim())||'')}</p>${p.matches.length?`<label class="import-destination">Ya hay ${p.matches.length===1?'un poema':'poemas'} con este título<select name="target:${p.index}" aria-label="Destino de ${h(p.title)}">${p.matches.map(m=>`<option value="${h(m.sourceKey)}">Agregar versión al existente · ${m.versions.length} versiones · ${h(m.versions.at(-1)?.poemText?.split('\n')[0]?.slice(0,65)||m.title)}</option>`).join('')}<option value="">Crear un poema separado</option></select></label>`:'<p class="small muted">Se creará un poema nuevo.</p>'}<details><summary>Ver poema a importar</summary><pre>${h(p.text)}</pre></details></article>`).join('')}</div><p class="small muted">Si el texto coincide con la última versión del poema elegido, se conserva sin duplicarlo. Desmarcá un poema para mantener solamente el que ya tenés.</p><div class="form-foot"><button type="button" data-action="close">Cancelar</button><button class="primary" type="submit" data-import-confirm></button></div></form>`,true);
    updateSelection();
  }
  function progress(value){
    const bar=modal.querySelector('#poem-import-progress');if(!bar)return;
    bar.max=value.total;bar.value=value.completed;
    modal.querySelector('[data-import-percent]').textContent=Math.round(value.completed/value.total*100)+' %';
    modal.querySelector('[data-import-stage]').textContent=value.stage==='server'?'Guardando en tu cuenta':'Guardando en este navegador';
    modal.querySelector('[data-import-current]').textContent=`${value.title} · ${value.index} de ${value.count}`;
  }
  modal.addEventListener('change',event=>{
    if(!event.target.closest('#poem-import-form'))return;
    if(event.target.hasAttribute('data-import-all'))for(const input of modal.querySelectorAll('[name=include]'))input.checked=event.target.checked;
    updateSelection();
  });
  modal.addEventListener('cancel',event=>{if(running)event.preventDefault();});
  modal.addEventListener('submit',async event=>{
    if(event.target.id!=='poem-import-form')return;event.preventDefault();event.stopPropagation();if(running)return;
    const data=new FormData(event.target),selected=new Set(data.getAll('include'));
    const entries=preview.filter(p=>selected.has(String(p.index))).map(p=>({title:p.title,text:p.text,targetKey:data.get('target:'+p.index)||null}));
    if(!entries.length)return;
    running=true;modal.dataset.importing='true';
    showDialog('Importando poemas',`<div class="import-progress"><div class="row"><strong data-import-stage>Preparando importación</strong><span data-import-percent>0 %</span></div><progress id="poem-import-progress" value="0" max="${entries.length}" aria-label="Progreso de importación"></progress><p data-import-current role="status" aria-live="polite">${entries.length} poemas seleccionados</p><p class="small muted">Conservamos tus versiones y el borrador abierto.</p><div data-import-result></div></div>`,true);
    modal.querySelector('[data-action=close]').disabled=true;
    try{
      const response=await command({action:'import-planned',entries},progress),result=response.importResult;
      const pending=result.sync?.pending||0;
      modal.querySelector('[data-import-stage]').textContent=pending?'Guardados en este navegador':'Importación terminada';
      modal.querySelector('[data-import-current]').textContent=`${result.importedCount} importados · ${result.unchanged} ya estaban iguales${result.sync?' · '+result.sync.uploaded+' guardados en tu cuenta':''}`;
      modal.querySelector('[data-import-result]').innerHTML=`${pending?`<p class="notice" role="alert">${pending} poemas pendientes de sincronizar. Se conservaron localmente y se reintentará al recuperar la conexión. También podés usar Actualizar. ${h(result.sync.error)}</p>`:''}<div class="form-foot"><button class="primary" data-action="close">Listo</button></div>`;
      if(!pending){const bar=modal.querySelector('progress');bar.value=bar.max;modal.querySelector('[data-import-percent]').textContent='100 %';}
      render();toast(pending?'Poemas guardados localmente; queda sincronización pendiente.':'Importación terminada.');
    }catch(error){
      modal.querySelector('[data-import-stage]').textContent='No se pudo completar la importación';
      modal.querySelector('[data-import-result]').innerHTML=`<p role="alert">${h(error.message)}</p><p class="small muted">Los poemas que ya se guardaron se conservan en la biblioteca.</p><div class="form-foot"><button data-action="close">Cerrar</button></div>`;
      render();
    }finally{running=false;delete modal.dataset.importing;modal.querySelector('.dialog-head [data-action=close]').disabled=false;}
  });
  return {open};
}
