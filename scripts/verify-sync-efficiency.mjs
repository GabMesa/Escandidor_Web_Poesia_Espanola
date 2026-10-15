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
 const calls=[],storage=new Storage(),state={user:null,queue:Promise.resolve()};
 const sync=createCloudSync({storage,state,request:(path,options={})=>{
  calls.push({path,method:options.method||'GET'});
  return fetch(base+path,{...options,headers:{...options.headers,Cookie:cookie}});
 }});
 const pull=async(options)=>{await sync.loadFromServer(options);assert.equal(state.error?.message||null,null);};
 sync.setUser(registered.data.user);await pull();calls.length=0;
 for(let i=0;i<5;i++)await pull();
 assert.deepEqual(calls.map(c=>c.path),Array(5).fill('/api/sync-status'));
 await api(`/api/poems/${id}`,{method:'PUT',body:JSON.stringify({...payload,content:'La luna cambió desde otro dispositivo.',sync:{id:'sync-qa-2',versionNumber:2}})});
 calls.length=0;await pull();
 assert.ok(calls.some(c=>c.path.startsWith('/api/poems?')));
 assert.ok(JSON.parse(storage.getItem('escandador.poemMemory.v1')).poems['server:'+id].some(v=>v.poemText.includes('otro dispositivo')));
 calls.length=0;await pull();assert.deepEqual(calls.map(c=>c.path),['/api/sync-status']);
 calls.length=0;await pull({force:true});assert.ok(calls.some(c=>c.path.startsWith('/api/poems?')));
 await api(`/api/poems/${id}`,{method:'DELETE'});await pull();
 assert.equal(JSON.parse(storage.getItem('escandador.poemMemory.v1')).poems['server:'+id],undefined);
 console.log(JSON.stringify({origin:base,idleChecks:5,historyRequestsWhileIdle:0,remoteEditDownloaded:true,remoteDeletionDownloaded:true,manualRefreshDownloads:true}));
} finally {
 if(created){await api('/api/auth/account',{method:'DELETE'});console.log('Temporary QA account deleted.');}
}
