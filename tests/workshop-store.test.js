import test from 'node:test';
import assert from 'node:assert/strict';
import {openWorkshopStore} from '../taller/workshop-store.js';
import {createEmptyWorkshop} from '../taller/model.js';

test('workshop skips unchanged saves and preserves newer edits while a write is in flight',async t=>{
 const initial=createEmptyWorkshop(),values=new Map(),writes=[];
 let release,started;
 const gate=new Promise(resolve=>{release=resolve;});
 const writing=new Promise(resolve=>{started=resolve;});
 t.mock.method(globalThis,'fetch',async(path,options={})=>{
  if(path==='/api/auth/me')return Response.json({user:{id:1}});
  if(!options.method)return Response.json({data:initial,revision:0});
  const body=JSON.parse(options.body);writes.push(body);
  if(writes.length===1){started();await gate;}
  return Response.json({revision:body.revision+1});
 });
 const oldStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),oldDocument=Object.getOwnPropertyDescriptor(globalThis,'document');
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}});
 Object.defineProperty(globalThis,'document',{configurable:true,value:{querySelector:()=>null}});
 t.after(()=>{
  if(oldStorage)Object.defineProperty(globalThis,'localStorage',oldStorage);else delete globalThis.localStorage;
  if(oldDocument)Object.defineProperty(globalThis,'document',oldDocument);else delete globalThis.document;
 });
 const store=await openWorkshopStore();
 store.save(store.data);await store.flush();assert.equal(writes.length,0);
 store.data.preferences.poemColors={'poem:1':'#205EA6'};store.save(store.data);await writing;
 for(let i=0;i<10;i++)store.save(store.data);
 store.data.preferences.poemColors['poem:2']='#879A39';store.save(store.data);
 const settled=store.flush();release();await settled;
 assert.equal(writes.length,2);
 assert.deepEqual(writes[1].data.preferences.poemColors,{'poem:1':'#205EA6','poem:2':'#879A39'});
 assert.deepEqual(store.data.preferences.poemColors,writes[1].data.preferences.poemColors);
 assert.equal(store.pendingBackup(),null);
 store.save(store.data);await store.flush();assert.equal(writes.length,2);
});
