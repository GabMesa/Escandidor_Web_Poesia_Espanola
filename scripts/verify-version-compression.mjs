import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createCloudSync} from '../cloud-sync.js';
const base=process.env.WORKSHOP_QA_ORIGIN||'http://localhost:8794';
const total=Number(process.env.COMPRESSION_QA_VERSIONS)||542;
let cookie='',created=false;
const api=async(path,{method='GET',body}={})=>{
 const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await response.json();assert.ok(response.ok,`${response.status}: ${JSON.stringify(data)}`);return {response,data};
};
class Storage{values=new Map();getItem(k){return this.values.get(k)??null;}setItem(k,v){this.values.set(k,v);}removeItem(k){this.values.delete(k);}}
try{
 const name='compressqa'+Date.now(),registered=await api('/api/auth/register',{method:'POST',body:{username:name,email:name+'@example.test',password:'CompressQA123!'}});
 cookie=registered.response.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');created=true;
 const user=registered.data.user;
 const payloads=Array.from({length:total},(_,i)=>({title:'Prueba de compresión de ciclos',versionName:'v'+(i+1),content:'Alternativa '+String(i%21).padStart(2,'0')+': la memoria del poema.',settings:{poemFont:i===0?'lora':'atkinson'},sync:{id:'compression-qa-'+i,versionNumber:i+1,savedAt:new Date(Date.UTC(2026,0,1,0,0,i)).toISOString(),kind:'manual'}}));
 const first=await api('/api/poems',{method:'POST',body:payloads[0]}),id=first.data.poem.id;
 for(let i=1;i<payloads.length;i+=20)await api(`/api/poems/${id}/versions`,{method:'POST',body:{versions:payloads.slice(i,i+20)}});
 const before=(await api('/api/poems')).data.poems.find(p=>p.id===id);assert.equal(before.versions.length,total);
 const started=Date.now();let result,removed=0;
 do{result=(await api(`/api/poems/${id}/compress`,{method:'POST',body:{}})).data;removed+=result.removed;}while(result.more);
 assert.equal(result.after,22);assert.equal(removed,total-22);assert.equal(result.removedVersions.length,total-22);
 const staleReplay=await api(`/api/poems/${id}/versions`,{method:'POST',body:{versions:payloads.slice(0,20)}});assert.equal(staleReplay.data.uploaded.length,20);
 const storage=new Storage(),syncState={user:null,queue:Promise.resolve()};let writes=0;
 const sync=createCloudSync({storage,state:syncState,request:(path,options={})=>{if(options.method)writes++;return fetch(base+path,{...options,headers:{...options.headers,Cookie:cookie}});}});
 sync.setUser(user);
 const versions=before.versions.map(v=>({id:v.sync.id,poemTitle:before.title,poemText:v.content,versionNumber:v.sync.versionNumber,savedAt:v.sync.savedAt,settings:v.sync.settings,kind:v.sync.kind,cloudVersion:v.version}));
 storage.setItem('escandador.poemMemory.v1',JSON.stringify({schemaVersion:2,poems:{['server:'+id]:versions},trash:{}}));
 storage.setItem('escandador.cloudPoemMap.v1:'+user.id,JSON.stringify({['server:'+id]:{poemId:id,versions:Object.fromEntries(versions.map(v=>[v.id,{cloudVersion:v.cloudVersion}]))}}));
 const legacy={...versions[1],id:'old-device-local-alias'};
 storage.setItem('escandador.poemMemory.v1',JSON.stringify({schemaVersion:2,poems:{['server:'+id]:[...versions,legacy]},trash:{}}));
 const legacyMap=JSON.parse(storage.getItem('escandador.cloudPoemMap.v1:'+user.id));legacyMap['server:'+id].versions[legacy.id]={cloudVersion:legacy.cloudVersion};storage.setItem('escandador.cloudPoemMap.v1:'+user.id,JSON.stringify(legacyMap));
 await sync.syncSavedVersion({poemKey:'server:'+id,title:before.title,version:legacy});assert.equal(syncState.error?.message||null,null);writes=0;
 for(let i=0;i<3;i++)await sync.loadFromServer();
 assert.equal(syncState.error?.message||null,null);assert.equal(writes,0);
 assert.equal(JSON.parse(storage.getItem('escandador.poemMemory.v1')).poems['server:'+id].length,22);
 const after=(await api('/api/poems')).data.poems.find(p=>p.id===id);assert.equal(after.versions.length,22);assert.equal(after.content,before.content);
 const states=p=>new Set(p.versions.map(v=>JSON.stringify([v.content,v.sync.settings])));
 assert.deepEqual(states(after),states(before));
 await mkdir('qa/compresion',{recursive:true});const report={before:total,after:22,archived:total-22,everyStatePreserved:true,currentTextUnchanged:true,staleDeviceDownloads22:true,oldBatchCannotResurrect:true,legacyAliasesCannotResurrect:true,repeatedPullDoesNotUpload:true,elapsedMs:Date.now()-started,origin:base};
 await writeFile('qa/compresion/'+(base.startsWith('https:')?'produccion':'local')+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{if(created){await api('/api/auth/account',{method:'DELETE'});console.log('Temporary QA account deleted.');}}
