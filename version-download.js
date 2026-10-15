// The snapshot contains only server-confirmed versions. Drafts and the outbox
// remain in the library; losing this optional snapshot requires a full pull.
export function createVersionDownload({api,storage,onProgress=()=>{}}) {
 let snapshot=null;
 const key=ownerId=>`escandador.cloudSnapshot.v1:${ownerId}`;
 const validCursor=value=>Number.isSafeInteger(value)&&value>=0;
 function cached(ownerId) {
  if(snapshot?.ownerId===ownerId)return snapshot;
  try {
   const value=JSON.parse(storage.getItem(key(ownerId))||'null');
   if(value?.schema===1&&value.ownerId===ownerId&&validCursor(value.cursor)&&Array.isArray(value.poems)
     &&value.poems.every(p=>Number.isSafeInteger(p.id)&&Array.isArray(p.versions)))return snapshot=value;
  } catch {}
  return null;
 }
 async function full(poemId=null) {
  const poems=new Map();let cursor=null,received=0;
  do {
   const query=new URLSearchParams({limit:'200'});
   if(poemId)query.set('poemId',poemId);
   if(cursor){query.set('afterPoem',cursor.poemId);query.set('afterVersion',cursor.version);}
   const page=await api('/api/poems?'+query);
   for(const poem of page.poems||[]) {
    received+=(poem.versions||[]).length;
    const existing=poems.get(poem.id);
    if(existing){existing.versions.push(...poem.versions);existing.version=poem.version;existing.content=poem.content;}
    else poems.set(poem.id,poem);
   }
   cursor=page.nextCursor;
   onProgress({detail:`${poems.size} poemas · ${received} versiones recibidas${cursor?' · descargando el siguiente bloque…':'.'}`,poems:poems.size,versions:received});
  } while(cursor);
  return [...poems.values()];
 }
 return {
  async download({ownerId,cursor=null,force=false}) {
   const previous=cached(ownerId);
   if(!validCursor(cursor)||!previous||previous.cursor>cursor)
    return {poems:await full(),cursor};
   const poems=new Map(previous.poems.map(p=>[p.id,{...p,versions:[...p.versions]}]));
   let after=previous.cursor,received=0;const removedVersions=[];
   while(after<cursor) {
    let page;
    try {page=await api(`/api/poems/changes?after=${after}&through=${cursor}`);}
    catch(error){if(error.status===404)return {poems:await full(),cursor};throw error;}
    if(!Array.isArray(page.changes))return {poems:await full(),cursor};
    for(const change of page.changes) {
     if(!change.poem){poems.delete(change.poemId);continue;}
     const poem=poems.get(change.poemId)||{versions:[]};
     Object.assign(poem,change.poem);
     if(change.version!==null) {
      const index=poem.versions.findIndex(v=>v.version===change.version);
      if(change.versionData){if(index<0)poem.versions.push(change.versionData);else poem.versions[index]=change.versionData;received++;}
      else {removedVersions.push({poemId:change.poemId,version:change.version});if(index>=0)poem.versions.splice(index,1);}
     }
     poems.set(change.poemId,poem);
    }
    onProgress({detail:`Actualizando los cambios · ${received} versiones recibidas.`,poems:poems.size,versions:received});
    if(page.nextCursor==null)break;
    if(!validCursor(page.nextCursor)||page.nextCursor<=after||page.nextCursor>cursor)throw Error('El servidor devolvió un cursor inválido.');
    after=page.nextCursor;
   }
   // Keep explicit retirements even during a requested full refresh, including
   // deletion of the highest version number in a poem.
   if(force)return {poems:await full(),cursor,removedVersions};
   // A restored or unmerged poem can become visible with its original history.
   // Fetch only that poem when its contents are absent from this device.
   for(const [id,poem] of poems) {
    if(!poem.versions.length){const restored=await full(id);if(restored.length)poems.set(id,restored[0]);else poems.delete(id);}
   }
   for(const poem of poems.values()) {
    poem.versions.sort((a,b)=>a.version-b.version);
    const latest=poem.versions.at(-1);
    if(latest)Object.assign(poem,{version:latest.version,versionName:latest.versionName,content:latest.content});
   }
   return {poems:[...poems.values()],cursor,removedVersions};
  },
  async commit(ownerId,remote) {
   if(!validCursor(remote.cursor))return;
   // Commit the library first. A restart can always rebuild it from this
   // confirmed snapshot even if a later local write was interrupted.
   await storage.flush?.();
   snapshot={schema:1,ownerId,cursor:remote.cursor,poems:remote.poems};
   try {storage.setItem(key(ownerId),JSON.stringify(snapshot));await storage.flush?.();}
   catch {storage.removeItem?.(key(ownerId));await storage.flush?.();}
  }
 };
}
