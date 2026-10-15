import {applicationState} from '../application-state.js';
import {createEmptyWorkshop} from './model.js';
import {mergeWorkshop} from './merge-workshop.js';
export async function openWorkshopStore(){
 const response=await fetch('/api/auth/me',{cache:'no-store'});
 if(!response.ok)throw Error('No se pudo conectar con tu taller.');
 const {user}=await response.json(),key=`escandador.workshop.v1:${user?.id||'guest'}`;
 let data=createEmptyWorkshop(),revision=0;
 if(user){const r=await fetch('/api/workshop',{cache:'no-store'});const result=await r.json();if(!r.ok)throw Error(result.error);data=result.data;revision=result.revision;}
 else try{data=JSON.parse(localStorage.getItem(key))||data;}catch{}
 const runtime=applicationState.runtime.workshopPersistence={user,key,revision,baseline:structuredClone(data),queue:Promise.resolve(),pending:null,error:null};
 const status=()=>{
  const node=document.querySelector('#workshop-save-status');if(!node)return;
  const cloud=applicationState.workshop?.cloudSync;
  const error=runtime.error?.message||(user&&cloud?.status==='error'?cloud.message:'');
  const waiting=Boolean(runtime.pending||(user&&cloud?.status!=='ready'));
  const detail=error?'Pendiente de guardar: '+error:waiting?'Sincronizando poemas y taller…':user?'Guardado en tu cuenta':'Sin cuenta · poemas en este navegador';
  node.textContent=error?'Pendiente':waiting?'Guardando…':user?'Guardado':'Local';node.title=detail;node.setAttribute('aria-label',detail);node.dataset.state=error?'error':waiting?'saving':user?'saved':'local';
 };
 let flushing=null;
 function flush(){
  if(flushing)return flushing;
  flushing=flushSnapshot().finally(()=>{flushing=null;});
  return flushing;
 }
 async function flushSnapshot(){
  if(!user||!runtime.pending)return;const snapshot=runtime.pending;
  try{
   let upload=snapshot;
   for(let attempt=0;attempt<4;attempt++){
    const r=await fetch('/api/workshop',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:runtime.revision,data:upload})}),result=await r.json();
    if(r.status===409&&attempt<3){
     const latestResponse=await fetch('/api/workshop',{cache:'no-store'}),latest=await latestResponse.json();if(!latestResponse.ok)throw Error(latest.error||'No se pudo actualizar el taller.');
     upload=mergeWorkshop(runtime.baseline,upload,latest.data);runtime.revision=latest.revision;runtime.baseline=structuredClone(latest.data);continue;
    }
    if(!r.ok)throw Error(result.error||'No se pudo guardar.');
    runtime.revision=result.revision;runtime.error=null;
    const current=runtime.pending===snapshot?upload:mergeWorkshop(snapshot,runtime.pending,upload);
    Object.keys(data).forEach(k=>delete data[k]);Object.assign(data,structuredClone(current));localStorage.setItem(key,JSON.stringify(data));
    runtime.baseline=structuredClone(upload);
    if(runtime.pending===snapshot){runtime.pending=null;localStorage.removeItem(key+':pending');}
    else{runtime.pending=structuredClone(current);localStorage.setItem(key+':pending',JSON.stringify({revision:runtime.revision,data:current}));}
    break;
   }
  }
  catch(error){runtime.error=error;throw error;}finally{status();}
 }
 function save(value){
  localStorage.setItem(key,JSON.stringify(value));
  if(user&&!runtime.error&&JSON.stringify(value)===JSON.stringify(runtime.pending||runtime.baseline)){status();return;}
  if(user){runtime.pending=structuredClone(value);localStorage.setItem(key+':pending',JSON.stringify({revision:runtime.revision,data:value}));runtime.queue=runtime.queue.catch(()=>{}).then(flush);runtime.queue.catch(()=>{});}status();
 }
 async function settle(){await runtime.queue.catch(()=>{});await flush();}
 const recovery=localStorage.getItem(key+':pending');
 if(user&&recovery){try{const draft=JSON.parse(recovery);if(draft.revision===revision){data=draft.data;save(data);}else runtime.error=Error('Hay un borrador pendiente y cambios en otra sesión. Descargá la copia local antes de reemplazarla.');}catch{}}
 return {user,key,data,save,status,flush:settle,pendingBackup:()=>localStorage.getItem(key+':pending')};
}
