import {requireUser,safeJson,jsonResponse,errorResponse,normalizeFontFamily} from '../../../_lib/helpers.js';
import {versionSyncMetadata} from '../../../_lib/version-sync.js';
import {poemValidationError} from '../../../../poem-policy.js';
import {compressedAliases,compressedVersionConflict} from '../../../_lib/poem-compression.js';

export async function onRequestPost({request,env,params}) {
  const {user,error}=await requireUser(request,env);if(error)return error;
  const poem=await env.escandidor_db.prepare('SELECT * FROM poems WHERE id=? AND user_id=?').bind(params.id,user.id).first();
  if(!poem)return errorResponse('Poema no encontrado.',404);
  const body=await safeJson(request),title=String(body.title||poem.name).trim().slice(0,200);
  if(!Array.isArray(body.versions)||!body.versions.length||body.versions.length>20)return errorResponse('Enviá entre 1 y 20 versiones por bloque.',400);
  const versions=[];
  for(const input of body.versions){
    const validation=poemValidationError(title,input.content);if(validation)return errorResponse(validation,400);
    const settings={...input.settings};settings.poemFont=normalizeFontFamily(settings.poemFont);
    const sync=versionSyncMetadata(input,settings);if(!sync)return errorResponse('La versión necesita una identidad estable.',400);
    versions.push({content:input.content,name:String(input.versionName||'Versión').slice(0,60),sync});
  }
  const aliases=await compressedAliases(env.escandidor_db,user.id,poem.id,versions.map(v=>v.sync.id));
  for(const v of versions){const alias=aliases.get(v.sync.id);if(alias){const conflict=compressedVersionConflict(alias,v.content,v.sync.settings);if(conflict)return conflict;}}
  const active=versions.filter(v=>!aliases.has(v.sync.id));
  const statements=active.map(v=>env.escandidor_db.prepare(`INSERT INTO poem_versions (poem_id,name,content,version,client_id,sync_json)
    SELECT ?,?,?,COALESCE(MAX(version),0)+1,?,? FROM (SELECT version FROM poem_versions WHERE poem_id=? UNION ALL SELECT version FROM compressed_poem_versions WHERE poem_id=?) WHERE true
    ON CONFLICT(poem_id,client_id) DO UPDATE SET name=excluded.name,content=excluded.content,sync_json=excluded.sync_json`)
    .bind(poem.id,v.name,v.content,v.sync.id,JSON.stringify(v.sync),poem.id,poem.id));
  const latest=active.at(-1);
  if(latest)statements.push(env.escandidor_db.prepare("UPDATE poems SET name=?,configurations=?,font_family=?,updated_at=datetime('now') WHERE id=? AND user_id=?")
    .bind(title,JSON.stringify(latest.sync.settings),latest.sync.settings.poemFont,poem.id,user.id));
  if(statements.length)await env.escandidor_db.batch(statements);
  const ids=versions.map(v=>v.sync.id);
  const {results}=await env.escandidor_db.prepare(`SELECT client_id AS id,version AS cloudVersion FROM poem_versions WHERE poem_id=? AND client_id IN (${ids.map(()=>'?').join(',')})`).bind(poem.id,...ids).all();
  return jsonResponse({ok:true,uploaded:[...results,...[...aliases].map(([id,row])=>({id,cloudVersion:row.replacement_version}))]});
}
