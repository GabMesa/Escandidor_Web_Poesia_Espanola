import {compressPoemVersions,poemVersionState} from '../../poem-compression.js';
import {errorResponse} from './helpers.js';

export function storedVersion(row){
  const sync=JSON.parse(row.sync_json||'{}');
  return {id:row.client_id||`cloud-${row.poem_id}-${row.version}`,serverVersion:row.version,versionNumber:row.version,poemText:row.content,savedAt:sync.savedAt||row.created_at,settings:sync.settings||{},label:row.name,row};
}

// Only exact rows from the inspected snapshot can be archived and removed.
// The full original row stays in the database alongside its replacement ID.
export function compressionStatements(userId,poemId,replacements){
  if(replacements.length>50){const chunks=[];for(let i=0;i<replacements.length;i+=50)chunks.push(...compressionStatements(userId,poemId,replacements.slice(i,i+50)));return chunks;}
  const plan=JSON.stringify(replacements.map(({removed,retained})=>({id:removed.row.id,content:removed.row.content,sync:removed.row.sync_json,replacement:retained.row.version,replacementContent:retained.row.content,replacementSync:retained.row.sync_json})));
  return [
    {sql:`INSERT OR IGNORE INTO compressed_poem_versions(user_id,poem_id,version,client_id,replacement_version,version_json)
      SELECT ?,v.poem_id,v.version,v.client_id,json_extract(j.value,'$.replacement'),
        json_object('id',v.id,'poem_id',v.poem_id,'name',v.name,'content',v.content,'version',v.version,'created_at',v.created_at,'client_id',v.client_id,'sync_json',v.sync_json)
      FROM poem_versions v JOIN json_each(?) j ON v.id=json_extract(j.value,'$.id')
      WHERE v.poem_id=? AND v.content=json_extract(j.value,'$.content') AND v.sync_json=json_extract(j.value,'$.sync')
        AND EXISTS(SELECT 1 FROM poems WHERE id=v.poem_id AND user_id=?)
        AND EXISTS(SELECT 1 FROM poem_versions replacement WHERE replacement.poem_id=v.poem_id AND replacement.version=json_extract(j.value,'$.replacement') AND replacement.content=json_extract(j.value,'$.replacementContent') AND replacement.sync_json=json_extract(j.value,'$.replacementSync'))`,args:[userId,plan,poemId,userId]},
    {sql:`DELETE FROM poem_versions WHERE poem_id=? AND id IN(SELECT json_extract(value,'$.id') FROM json_each(?))
      AND EXISTS(SELECT 1 FROM compressed_poem_versions c WHERE c.poem_id=poem_versions.poem_id AND c.version=poem_versions.version AND c.user_id=? AND json_extract(c.version_json,'$.content')=poem_versions.content AND json_extract(c.version_json,'$.sync_json')=poem_versions.sync_json)`,args:[poemId,plan,userId]}
  ];
}

export async function compressServerPoem(db,userId,poemId,{dryRun=false}={}){
  const {results:rows}=await db.prepare('SELECT * FROM poem_versions WHERE poem_id=? ORDER BY version').bind(poemId).all();
  const {results:contests}=await db.prepare('SELECT data_json FROM contests WHERE user_id=?').bind(userId).all();
  const pins=new Set(contests.flatMap(c=>JSON.parse(c.data_json).selections||[]).map(s=>String(s.versionId)));
  const versions=rows.map(storedVersion);
  const protectedVersionIds=versions.filter(v=>pins.has(String(v.id))||pins.has(`cloud-${poemId}-${v.serverVersion}`)).map(v=>v.id);
  const result=compressPoemVersions(versions,{protectedVersionIds});
  if(!dryRun&&result.removed.length)await db.batch(compressionStatements(userId,poemId,result.replacements.slice(0,800)).map(s=>db.prepare(s.sql).bind(...s.args)));
  const count=await db.prepare('SELECT COUNT(*) AS count FROM poem_versions WHERE poem_id=?').bind(poemId).first();
  const {results:removedVersions}=await db.prepare('SELECT version,client_id AS clientId,replacement_version AS replacementVersion FROM compressed_poem_versions WHERE user_id=? AND poem_id=?').bind(userId,poemId).all();
  return {before:rows.length,after:dryRun?result.retained.length:count.count,removed:dryRun?result.removed.length:rows.length-count.count,more:!dryRun&&result.removed.length>800,removedVersions};
}

export async function compressedAliases(db,userId,poemId,ids){
  if(!ids.length)return new Map();
  const entries=ids.map(entry=>typeof entry==='string'?{id:entry}:entry);
  const legacyNumbers=entries.map(e=>Number(e.cloudVersion)).filter(n=>Number.isInteger(n)&&n>0);
  let legacy=new Map();
  if(poemId&&legacyNumbers.length){
    const {results}=await db.prepare('SELECT version,client_id FROM compressed_poem_versions WHERE user_id=? AND poem_id=? AND version IN(SELECT value FROM json_each(?))').bind(userId,poemId,JSON.stringify(legacyNumbers)).all();
    legacy=new Map(results.map(r=>[r.version,r.client_id]));
  }
  const lookup=[...new Set([...entries.map(e=>e.id),...legacy.values()])];
  const {results}=await db.prepare(`WITH RECURSIVE aliases(poem_id,root,version) AS (
      SELECT poem_id,client_id,replacement_version FROM compressed_poem_versions WHERE user_id=? AND (? IS NULL OR poem_id=?) AND client_id IN(SELECT value FROM json_each(?))
      UNION ALL SELECT a.poem_id,a.root,c.replacement_version FROM aliases a JOIN compressed_poem_versions c ON c.poem_id=a.poem_id AND c.version=a.version
    ) SELECT c.poem_id,c.client_id,c.version_json,v.version AS replacement_version FROM aliases a
      JOIN poem_versions v ON v.poem_id=a.poem_id AND v.version=a.version
      JOIN compressed_poem_versions c ON c.poem_id=a.poem_id AND c.client_id=a.root`)
    .bind(userId,poemId,poemId,JSON.stringify(lookup)).all();
  const aliases=new Map(results.map(row=>[row.client_id,row]));
  return new Map(entries.map(entry=>[entry.id,aliases.get(entry.id)||aliases.get(legacy.get(Number(entry.cloudVersion)))]).filter(([,alias])=>alias));
}

export function compressedVersionConflict(alias,content,settings){
  const archived=storedVersion(JSON.parse(alias.version_json));
  return poemVersionState(archived)===poemVersionState({poemText:content,settings})?null:
    errorResponse('Esta versión fue comprimida. Actualizá y guardá los cambios como una nueva versión; tu copia local se conserva.',409,{code:'version_compressed'});
}
