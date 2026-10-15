import {escapeHtml as h} from './model.js';

const startup=[['session','Comprobar sesión'],['library','Recuperar biblioteca'],['preferences','Aplicar tus preferencias'],['poem','Abrir tu poema'],['analysis','Preparar el análisis']];
const opening=[['draft','Conservar tu borrador'],['poem','Cargar la versión elegida'],['analysis','Analizar versos y rimas']];
const defaults={session:'Comprobando tu sesión y el trabajo guardado en este navegador.',library:'Recuperando tus poemas y versiones.',preferences:'Aplicando colores, fuente y configuración de tu mesa.',poem:'Preparando el poema en el espacio de escritura.',analysis:'Calculando sílabas, acentos y rimas.',draft:'Conservando los cambios antes de abrir otro poema.'};

export function createEditorLoading(){
  let active=true,kind='startup',requestId,index=0,detail=defaults.session,error='';
  const steps=()=>kind==='startup'?startup:opening;
  function html(){
    const list=steps();
    return `<section class="editor-loading ${kind==='open'?'editor-loading-compact':''}" data-editor-loader aria-label="Carga de Escandidor" aria-busy="${!error}">
      <div class="editor-loading-art" aria-hidden="true"><svg viewBox="0 0 80 80"><path class="loading-paper" d="M20 18h30l10 10v37H20Z M50 18v12h10"/><path class="loading-writing" d="M29 40h22 M29 49h17 M29 58h20"/><path class="loading-pen" d="m53 39 15-24 5 4-17 23-6 3Z"/></svg><span></span><span></span><span></span></div>
      <div class="editor-loading-body"><p class="eyebrow">TU MESA SE ESTÁ PREPARANDO</p><h2>${error?'No se pudo completar la carga':kind==='open'?'Abriendo tu poema':'Preparando Escandidor'}</h2>
      <p class="editor-loading-detail" role="${error?'alert':'status'}" aria-live="polite" data-loading-detail>${h(error||detail)}</p>
      <div class="editor-loading-meter"><span data-loading-count>${error?'Carga interrumpida':`Etapa ${index+1} de ${list.length}`}</span><progress max="${list.length}" value="${index}" aria-label="Etapas completadas de Escandidor"></progress></div>
      <ol class="editor-loading-steps">${list.map(([key,label],i)=>`<li data-loading-step="${key}" class="${i<index?'is-complete':i===index?'is-current':''}" ${i===index?'aria-current="step"':''}><span aria-hidden="true">${i<index?'✓':i+1}</span>${h(label)}</li>`).join('')}</ol>
      ${error?'<a href="" class="loading-retry">Volver a intentar</a>':''}</div></section>`;
  }
  function stage(key,message='',id){
    if(!active||(kind==='open'&&id!==requestId))return;
    if(key==='error'){fail(message);return;}
    const next=steps().findIndex(([value])=>value===key);
    if(next<index||next<0)return;
    index=next;detail=message||defaults[key];
    const node=document.querySelector('[data-editor-loader]');if(!node)return;
    node.querySelector('[data-loading-detail]').textContent=detail;
    node.querySelector('[data-loading-count]').textContent=`Etapa ${index+1} de ${steps().length}`;
    node.querySelector('progress').value=index;
    node.querySelectorAll('[data-loading-step]').forEach((item,i)=>{item.classList.toggle('is-complete',i<index);item.classList.toggle('is-current',i===index);if(i===index)item.setAttribute('aria-current','step');else item.removeAttribute('aria-current');item.querySelector('span').textContent=i<index?'✓':String(i+1);});
  }
  function fail(message){if(!active)return;error=message;const node=document.querySelector('[data-editor-loader]');if(node)node.outerHTML=html();active=false;}
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==document.querySelector('#workshop-editor')?.contentWindow||event.data?.type!=='workshop:loading-stage')return;
    stage(event.data.stage,event.data.detail,event.data.requestId);
  });
  return {html,stage,begin(id,waiting=false){active=true;kind=waiting?'startup':'open';requestId=id;index=0;error='';detail=waiting?defaults.session:defaults.draft;return html();},finish(){active=false;},fail};
}
