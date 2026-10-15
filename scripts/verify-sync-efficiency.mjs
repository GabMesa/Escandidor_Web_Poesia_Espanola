import assert from 'node:assert/strict';
import {createCloudSync} from '../cloud-sync.js';

const base=process.env.WORKSHOP_QA_ORIGIN||'http://localhost:8794';
let cookie='',created=false;
const api=async(path,options={})=>{
 const response=await fetch(base+path,{...options,headers:{'Content-Type':'application/json',Cookie:cookie,...options.headers}});
 const data=await response.json();assert.ok(response.ok,`${response.status}: ${JSON.stringify(data)}`);return {response,data};
};
class Storage {
 values=new Map();getItem(key){return this.values.get(key)??null;}
 setItem(key,value){this.values.set(key,value);}removeItem(key){this.values.delete(key);}
}
try {
 const name='syncqa'+Date.now();
 const registered=await api('/api/auth/register',{method:'POST',body:JSON.stringify({username:name,email:name+'@example.test',password:'SyncQA123!'})});
 cookie=registered.response.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');created=true;
 const payload={title:'Poema de prueba de sincronización',content:'La luna sigue aquí.',sync:{id:'sync-qa-1',versionNumber:1},settings:{poemFont:'atkinson'}};
 const first=await api('/api/poems',{method:'POST',body:JSON.stringify(payload)}),id=first.data.poem.id;
 const calls=[],storage=new Storage();let state={user:null,queue:Promise.resolve()};
 let receivedVersions=0;
 const request=(path,options={})=>{
  calls.push({path,method:options.method||'GET'});
  return fetch(base+path,{...options,headers:{...options.headers,Cookie:cookie}}).then(async response=>{
   const data=await response.clone().json();receivedVersions+=(data.changes||[]).filter(c=>c.versionData).length;
   return response;
  });
 };
 let sync=createCloudSync({storage,state,request});
 const pull=async(options)=>{await sync.loadFromServer(options);assert.equal(state.error?.message||null,null);};
 sync.setUser(registered.data.user);await pull();calls.length=0;
 for(let i=0;i<5;i++)await pull();
 assert.deepEqual(calls.map(c=>c.path),Array(5).fill('/api/sync-status'));
 await api(`/api/poems/${id}`,{method:'PUT',body:JSON.stringify({...payload,content:'La luna cambió desde otro dispositivo.',sync:{id:'sync-qa-2',versionNumber:2}})});
 calls.length=0;await pull();
 assert.ok(calls.some(c=>c.path.startsWith('/api/poems/changes?')));
 assert.ok(!calls.some(c=>c.path.startsWith('/api/poems?')));assert.equal(receivedVersions,1);
 assert.ok(JSON.parse(storage.getItem('escandador.poemMemory.v1')).poems['server:'+id].some(v=>v.poemText.includes('otro dispositivo')));
 calls.length=0;await pull();assert.deepEqual(calls.map(c=>c.path),['/api/sync-status']);
 state={user:null,queue:Promise.resolve()};sync=createCloudSync({storage,state,request});sync.setUser(registered.data.user);
 calls.length=0;await pull();assert.ok(!calls.some(c=>c.path.startsWith('/api/poems?')));
 calls.length=0;await pull({force:true});assert.ok(calls.some(c=>c.path.startsWith('/api/poems?')));
 await api(`/api/poems/${id}?version=2`,{method:'DELETE'});calls.length=0;await pull();
 assert.deepEqual(JSON.parse(storage.getItem('escandador.poemMemory.v1')).poems['server:'+id].map(v=>v.cloudVersion),[1]);
 assert.ok(!calls.some(c=>c.path.startsWith('/api/poems?')));
 await api(`/api/poems/${id}`,{method:'PUT',body:JSON.stringify({...payload,content:'Una tercera versión para revisar.',sync:{id:'sync-qa-3',versionNumber:3}})});await pull();
 await api(`/api/poems/${id}?version=2`,{method:'DELETE'});await pull({force:true});
 assert.deepEqual(JSON.parse(storage.getItem('escandador.poemMemory.v1')).poems['server:'+id].map(v=>v.cloudVersion),[1]);
 await api(`/api/poems/${id}`,{method:'DELETE'});await pull();
 assert.equal(JSON.parse(storage.getItem('escandador.poemMemory.v1')).poems['server:'+id],undefined);
 console.log(JSON.stringify({origin:base,idleChecks:5,historyRequestsWhileIdle:0,newVersionContentsReceived:receivedVersions,restartReusesSnapshot:true,remoteEditDownloaded:true,remoteVersionDeletionDownloaded:true,remoteDeletionDownloaded:true,manualRefreshDownloads:true}));
} finally {
 if(created){await api('/api/auth/account',{method:'DELETE'});console.log('Temporary QA account deleted.');}
}
