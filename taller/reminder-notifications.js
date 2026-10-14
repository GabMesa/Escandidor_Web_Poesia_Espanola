import {upcomingNotices} from './model.js';
export const NOTIFICATION_KEY='escandador.reminderNotifications.v1';
const dayNumber=date=>Math.floor(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())/86400000);
export function notificationCandidates(contests,now=new Date()){
  const today=dayNumber(now);
  return upcomingNotices(contests,now).filter(n=>{
    if(n.contest.demo)return false;
    if(n.kind==='published')return true;
    const date=n.kind==='results'?n.contest.resultsDate:n.contest.deadline;
    const days=dayNumber(new Date(date+'T12:00:00'))-today;
    if(n.kind==='expired')return days===-1;
    if(n.kind==='results')return [7,2,0].includes(days);
    return days===0||(n.contest.reminders||[14,7,2]).includes(days);
  }).map(n=>({...n,key:JSON.stringify([n.contest.id,n.kind,n.kind==='published'?'publication':n.kind==='results'?n.contest.resultsDate:n.contest.deadline,n.kind==='published'||n.kind==='expired'?'once':dayNumber(now)])}));
}
export function createReminderNotifications({getContests,onOpen=()=>{},onStatus=()=>{},storage=globalThis.localStorage,NotificationImpl=globalThis.Notification,now=()=>new Date(),page=globalThis.window}={}){
  let saved={enabled:false,sent:{}};
  try{const value=JSON.parse(storage.getItem(NOTIFICATION_KEY));if(value&&typeof value.enabled==='boolean'&&value.sent&&typeof value.sent==='object'&&!Array.isArray(value.sent))saved=value;}catch{}
  let timer;
  const write=()=>{try{storage.setItem(NOTIFICATION_KEY,JSON.stringify(saved));return true;}catch{return false;}};
  function status(){
    const supported=!!NotificationImpl&&globalThis.isSecureContext!==false;
    const permission=NotificationImpl?.permission;
    const enabled=supported&&permission==='granted'&&saved.enabled;
    return {enabled,available:supported&&permission!=='denied',message:!supported?'Este navegador no admite avisos. Podés consultar los recordatorios aquí.':permission==='denied'?'El navegador bloqueó los avisos. Podés habilitarlos en sus permisos para este sitio.':enabled?'Avisos activados mientras el taller esté abierto.':'Activá los avisos para recibir recordatorios en este equipo.'};
  }
  function check(){
    if(!status().enabled)return;
    const notices=notificationCandidates(getContests(),now()).filter(n=>!saved.sent[n.key]);
    if(!notices.length)return;
    try{
      const notification=new NotificationImpl(notices.length===1?notices[0].contest.name:`${notices.length} recordatorios en tu taller`,{
        body:notices.map(n=>`${n.label}: ${n.contest.name}`).join('\n'),tag:'mesa-de-poesia-recordatorios',
      });
      notification.onclick=()=>{onOpen(notices.length===1?notices[0].contest.id:null);notification.close();};
      for(const notice of notices)saved.sent[notice.key]=now().getTime();
      saved.sent=Object.fromEntries(Object.entries(saved.sent).sort((a,b)=>b[1]-a[1]).slice(0,500));write();
    }catch{}
  }
  return {
    status,check,
    async enable(){
      if(!status().available)return;
      const permission=NotificationImpl.permission==='granted'?'granted':await NotificationImpl.requestPermission();
      saved.enabled=permission==='granted';
      if(!write()){saved.enabled=false;throw Error('No se pudo guardar la preferencia de avisos en este navegador.');}
      onStatus();check();
    },
    disable(){saved.enabled=false;write();onStatus();},
    start(){if(timer)return;timer=setInterval(check,60000);page?.addEventListener('focus',check);check();},
    stop(){clearInterval(timer);timer=undefined;page?.removeEventListener('focus',check);},
  };
}
