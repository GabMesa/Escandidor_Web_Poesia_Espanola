import {jsonResponse,errorResponse,requireUser,serializePoem} from '../../_lib/helpers.js';

export async function onRequestGet({request,env}) {
 const {user,error}=await requireUser(request,env);if(error)return error;
 const query=new URL(request.url).searchParams;
 const after=Number(query.get('after')),through=Number(query.get('through'));
 if(!query.has('after')||!query.has('through')||![after,through].every(n=>Number.isSafeInteger(n)&&n>=0)||after>through)return errorResponse('Cursor de sincronización inválido.',400);
 const {results}=await env.escandidor_db.prepare(`
   SELECT c.revision,c.poem_id,c.version AS changed_version,
     p.id,p.name AS title,p.configurations AS settings_json,p.font_family,p.color_index,p.created_at,p.updated_at,
     v.version,v.name AS version_name,v.content,v.created_at AS version_created_at,v.sync_json
   FROM library_changes c
   LEFT JOIN poems p ON p.id=c.poem_id AND p.user_id=c.user_id
     AND NOT EXISTS(SELECT 1 FROM deleted_poems d WHERE d.user_id=p.user_id AND d.poem_id=p.id)
     AND NOT EXISTS(SELECT 1 FROM merged_poems m WHERE m.source_id=p.id)
   LEFT JOIN poem_versions v ON v.poem_id=p.id AND v.version=c.version
   WHERE c.user_id=? AND c.revision>? AND c.revision<=?
   ORDER BY c.revision LIMIT 201`).bind(user.id,after,through).all();
 const rows=results.slice(0,200);
 return jsonResponse({ok:true,changes:rows.map(row=>({
   poemId:row.poem_id,version:row.changed_version,
   poem:row.id?serializePoem(row):null,
   versionData:row.version==null?null:{version:row.version,versionName:row.version_name,content:row.content,createdAt:row.version_created_at,sync:JSON.parse(row.sync_json||'{}')}
 })),nextCursor:results.length>200?rows.at(-1).revision:null},
 {headers:{'Cache-Control':'no-store','Vary':'Cookie'}});
}
