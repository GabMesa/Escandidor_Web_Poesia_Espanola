import {jsonResponse,errorResponse,requireUser} from '../../_lib/helpers.js';
const reply=(data,status=200)=>jsonResponse(data,{status,headers:{'Cache-Control':'no-store','Vary':'Cookie'}});
const contestFields=['id','name','organizer','country','deadline','deadlineTime','timezone','resultsDate','resultsNote','resultsUrl','sourceUrl','originalUrl','status','delivery','rules','maxPoems','maxVerses','minTotal','maxTotal','selections','snapshots','profile','reminders','agendaEnabled','reviewed','lastPrepared','verseCounting','plicaRequired','aiPlacement','attachments','coverRequirements','provenance','extraction','extractedAt','pdfRead','aiRequirement','minPoemVerses'];
export async function onRequestGet({request,env}){
 const {user,error}=await requireUser(request,env);if(error)return error;
 const db=env.escandidor_db;
 await db.prepare('INSERT OR IGNORE INTO workshop_revisions(user_id) VALUES(?)').bind(user.id).run();
 const [rev,contests,tags,assignments,prefs]=await db.batch([
  db.prepare('SELECT revision FROM workshop_revisions WHERE user_id=?').bind(user.id),
  db.prepare('SELECT data_json FROM contests WHERE user_id=?').bind(user.id),
  db.prepare('SELECT name,color FROM poem_tags WHERE user_id=?').bind(user.id),
  db.prepare('SELECT poem_key,tag_name FROM poem_tag_assignments WHERE user_id=?').bind(user.id),
  db.prepare('SELECT data_json FROM workshop_preferences WHERE user_id=?').bind(user.id)
 ]);
 const localTags={};for(const row of assignments.results)(localTags[row.poem_key]??=[]).push(row.tag_name);
 return reply({ok:true,revision:rev.results[0].revision,data:{schemaVersion:1,poems:[],contests:contests.results.map(r=>JSON.parse(r.data_json)),tagCatalog:tags.results.map(r=>r.name),tagColors:Object.fromEntries(tags.results.map(r=>[r.name,r.color])),localTags,preferences:JSON.parse(prefs.results[0]?.data_json||'{}')}});
}
export async function onRequestPut({request,env}){
 const {user,error}=await requireUser(request,env);if(error)return error;
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return errorResponse('Origen no permitido.',403);
 const raw=await request.text();if(raw.length>2_000_000)return errorResponse('Datos demasiado grandes.',413);
 let body;try{body=JSON.parse(raw);}catch{return errorResponse('Solicitud inválida.',400);}
 const {data,revision}=body;
 if(!Number.isSafeInteger(revision)||revision<0||!data||!Array.isArray(data.contests)||data.contests.length>200||!Array.isArray(data.tagCatalog)||data.tagCatalog.length>200||data.poems?.length)return errorResponse('Datos del taller inválidos.',400);
 const tags=[...new Set(data.tagCatalog)];
 if(tags.some(t=>typeof t!=='string'||!t.trim()||t.length>60||!/^#[\da-f]{6}$/i.test(data.tagColors?.[t]||'')))return errorResponse('Etiquetas inválidas.',400);
 const contests=data.contests.map(c=>Object.fromEntries(contestFields.filter(k=>c[k]!==undefined).map(k=>[k,c[k]])));
 if(data.contests.some(c=>c.demo)||contests.some(c=>typeof c.id!=='string'||c.id.length>100||typeof c.name!=='string'||!c.name.trim()||!Array.isArray(c.selections)||!Array.isArray(c.snapshots)||!c.profile)||new Set(contests.map(c=>c.id)).size!==contests.length)return errorResponse('Concursos inválidos.',400);
 const assignments=Object.entries(data.localTags||{}).flatMap(([key,values])=>Array.isArray(values)?[...new Set(values)].map(tag=>({key,tag})):[]);
 if(assignments.length>3000||assignments.some(a=>a.key.length>200||!tags.includes(a.tag)))return errorResponse('Asignaciones inválidas.',400);
 const inputPrefs=data.preferences||{},poemColors=inputPrefs.poemColors||{},defaults=inputPrefs.defaults||{};if(Array.isArray(poemColors)||Object.entries(poemColors).some(([key,color])=>key.length>200||!/^#[\da-f]{6}$/i.test(color)))return errorResponse('Colores de poemas inválidos.',400);const cleanPrefs={poemColors};if(inputPrefs.defaults){if(typeof defaults.defaultFont!=='string'||defaults.defaultFont.length>80||!/^#[\da-f]{6}$/i.test(defaults.defaultColor||''))return errorResponse('Preferencias inválidas.',400);cleanPrefs.defaults={defaultFont:defaults.defaultFont,defaultColor:defaults.defaultColor,autoCompress:defaults.autoCompress!==false};}const prefs=JSON.stringify(cleanPrefs);if(prefs.length>200000)return errorResponse('Preferencias demasiado grandes.',400);
 const db=env.escandidor_db,token=crypto.randomUUID();
 await db.prepare('INSERT OR IGNORE INTO workshop_revisions(user_id) VALUES(?)').bind(user.id).run();
 const gate='EXISTS(SELECT 1 FROM workshop_revisions WHERE user_id=? AND mutation_token=?)';
 const commands=[db.prepare('UPDATE workshop_revisions SET revision=revision+1,mutation_token=? WHERE user_id=? AND revision=?').bind(token,user.id,revision)];
 for(const table of ['poem_tag_assignments','poem_tags','contests','workshop_preferences'])commands.push(db.prepare(`DELETE FROM ${table} WHERE user_id=? AND ${gate}`).bind(user.id,user.id,token));
 for(const c of contests)commands.push(db.prepare(`INSERT INTO contests SELECT ?,?,? WHERE ${gate}`).bind(user.id,c.id,JSON.stringify(c),user.id,token));
 for(const tag of tags)commands.push(db.prepare(`INSERT INTO poem_tags SELECT ?,?,? WHERE ${gate}`).bind(user.id,tag,data.tagColors[tag],user.id,token));
 for(const a of assignments)commands.push(db.prepare(`INSERT INTO poem_tag_assignments SELECT ?,?,? WHERE ${gate}`).bind(user.id,a.key,a.tag,user.id,token));
 commands.push(db.prepare(`INSERT INTO workshop_preferences SELECT ?,? WHERE ${gate}`).bind(user.id,prefs,user.id,token));
 const results=await db.batch(commands);
 if(!results[0].meta.changes)return reply({ok:false,error:'El taller cambió en otra pestaña. Recargá antes de guardar para conservar ambas versiones.'},409);
 return reply({ok:true,revision:revision+1});
}
