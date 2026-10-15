import test from 'node:test';
import assert from 'node:assert/strict';
import {createVersionDownload} from '../version-download.js';

class Storage {
 values=new Map();getItem(k){return this.values.get(k)??null;}
 setItem(k,v){this.values.set(k,v);}removeItem(k){this.values.delete(k);}
}
const metadata={id:11,title:'Luna',settings:{poemFont:'atkinson'}};
const version=n=>({version:n,content:'Verso '+n,versionName:'v'+n,sync:{id:'v'+n}});

test('a cached 5000-version library downloads only new versions, including after restarting the app',async()=>{
 const storage=new Storage(),calls=[];
 const api=async path=>{
  calls.push(path);
  if(path.startsWith('/api/poems/changes'))return {changes:[{poemId:11,version:5001,poem:metadata,versionData:version(5001)}],nextCursor:null};
  const after=Number(new URL(path,'https://test').searchParams.get('afterVersion'))||0;
  return {poems:[{...metadata,versions:Array.from({length:200},(_,i)=>version(after+i+1))}],nextCursor:after+200<5000?{poemId:11,version:after+200}:null};
 };
 const first=createVersionDownload({api,storage});
 const full=await first.download({ownerId:1,cursor:10000});assert.equal(full.poems[0].versions.length,5000);await first.commit(1,full);
 calls.length=0;
 const restarted=createVersionDownload({api,storage});
 const incremental=await restarted.download({ownerId:1,cursor:10002});
 assert.deepEqual(calls,['/api/poems/changes?after=10000&through=10002']);
 assert.equal(incremental.poems[0].versions.length,5001);assert.equal(incremental.poems[0].content,'Verso 5001');
 assert.equal(full.poems[0].versions.length,5000);
 await restarted.commit(1,incremental);calls.length=0;
 await restarted.download({ownerId:1,cursor:10002});assert.equal(calls.length,0);
});

test('incremental pages apply removals, renames and legacy metadata edits without changing cached contents in place',async()=>{
 const storage=new Storage(),calls=[];
 const api=async path=>{
  calls.push(path);
  if(path.includes('after=10&'))return {changes:[
   {poemId:11,version:1,poem:metadata,versionData:null},
   {poemId:11,version:2,poem:{...metadata,title:'Nueva luna'},versionData:{...version(2),versionName:'Versión elegida'}}
  ],nextCursor:12};
  return {changes:[{poemId:22,version:null,poem:null,versionData:null}],nextCursor:null};
 };
 const downloader=createVersionDownload({api,storage});
 const original={cursor:10,poems:[{...metadata,versions:[version(1),version(2)]},{id:22,title:'Otro poema',versions:[version(1)]}]};
 await downloader.commit(1,original);
 const updated=await downloader.download({ownerId:1,cursor:15});
 assert.equal(updated.poems.length,1);assert.equal(updated.poems[0].title,'Nueva luna');
 assert.deepEqual(updated.poems[0].versions,[{...version(2),versionName:'Versión elegida'}]);
 assert.equal(original.poems[0].versions.length,2);assert.equal(calls.length,2);
});

test('failed delta pages never advance the persisted cursor and retry the complete missing range',async()=>{
 const storage=new Storage(),calls=[];let offline=true;
 const api=async path=>{calls.push(path);if(path.includes('after=10&'))return {changes:[],nextCursor:12};if(offline)throw Error('Sin conexión');return {changes:[],nextCursor:null};};
 const downloader=createVersionDownload({api,storage});await downloader.commit(1,{cursor:10,poems:[{...metadata,versions:[version(1)]}]});
 await assert.rejects(downloader.download({ownerId:1,cursor:15}),/Sin conexión/);
 assert.equal(JSON.parse(storage.getItem('escandador.cloudSnapshot.v1:1')).cursor,10);
 offline=false;calls.length=0;await downloader.download({ownerId:1,cursor:15});assert.ok(calls[0].includes('after=10&'));
});

test('restoring a poem with existing contents fetches only that missing poem',async()=>{
 const storage=new Storage(),calls=[];
 const downloader=createVersionDownload({storage,api:async path=>{
  calls.push(path);
  if(path.startsWith('/api/poems/changes'))return {changes:[{poemId:11,version:null,poem:metadata,versionData:null}],nextCursor:null};
  return {poems:[{...metadata,versions:[version(1),version(2)]}],nextCursor:null};
 }});
 await downloader.commit(1,{cursor:10,poems:[]});
 const restored=await downloader.download({ownerId:1,cursor:12});
 assert.equal(restored.poems[0].versions.length,2);assert.ok(calls[1].includes('poemId=11'));
});

test('manual refresh, a different account and an invalid or missing cache require a full download',async()=>{
 const storage=new Storage(),calls=[];
 const downloader=createVersionDownload({storage,api:async path=>{calls.push(path);return {poems:[],nextCursor:null};}});
 await downloader.commit(1,{cursor:10,poems:[]});
 await downloader.download({ownerId:1,cursor:10,force:true});
 await downloader.download({ownerId:2,cursor:10});
 await downloader.download({ownerId:1,cursor:9});
 storage.setItem('escandador.cloudSnapshot.v1:3','invalid JSON');await downloader.download({ownerId:3,cursor:10});
 assert.ok(calls.every(path=>path==='/api/poems?limit=200'));assert.equal(calls.length,4);
});
