import {readFile,writeFile} from 'node:fs/promises';
import {poemTitleKey} from '../poem-policy.js';
import {poemVersionState} from '../poem-compression.js';
import {storedVersion} from '../functions/_lib/poem-compression.js';

// Input is a private D1 backup: poems, versions, compressed versions,
// contests, tag assignments and preferences (six SELECT result sets).
const [input,output]=process.argv.slice(2);
if(!input||!output)throw Error('Usage: plan-poem-deduplication.mjs backup.json plan.sql');
const dump=JSON.parse((await readFile(input,'utf8')).replace(/^\uFEFF/,''));
const [poems,versions,compressed,contests,tags,prefs]=dump.map(r=>r.results);
const owners=new Set(poems.map(p=>p.user_id));
if(owners.size!==1)throw Error('El respaldo debe contener exactamente una cuenta.');
const owner=[...owners][0],sql=[],aliases=new Map(),references=new Map();
const q=v=>v==null?'NULL':typeof v==='number'?String(v):"'"+String(v).replaceAll("'","''")+"'";
const groups=new Map();
for(const poem of poems){const key=poemTitleKey(poem.name);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(poem);}
let copied=0,merged=0;
for(const [key,group] of groups){
 group.sort((a,b)=>a.id-b.id);const target=group[0];
 const kept=versions.filter(v=>v.poem_id===target.id).sort((a,b)=>a.version-b.version);
 let high=Math.max(0,...kept.map(v=>v.version),...compressed.filter(v=>v.poem_id===target.id).map(v=>v.version));
 const identities=new Map(kept.map(v=>[v.client_id||`cloud-${target.id}-${v.version}`,v]));
 const current=kept.at(-1);let latest=current;
 for(const source of group.slice(1)){
  merged++;aliases.set(source.id,target.id);references.set('poem:'+source.id,'poem:'+target.id);
  sql.push(`UPDATE poems SET title_key=NULL WHERE id=${source.id} AND user_id=${owner};`);
  for(const original of versions.filter(v=>v.poem_id===source.id).sort((a,b)=>a.version-b.version)){
   let clientId=original.client_id||`cloud-${source.id}-${original.version}`;
   const previous=identities.get(clientId);
   if(previous&&poemVersionState(storedVersion(previous))===poemVersionState(storedVersion(original))){
    references.set(`cloud-${source.id}-${original.version}`,`cloud-${target.id}-${previous.version}`);continue;
   }
   if(previous)clientId=`merged-${source.id}-${clientId}`;
   high++;copied++;
   const sync={...JSON.parse(original.sync_json||'{}'),id:clientId};
   sync.savedAt ||= original.created_at;sync.versionNumber ||= original.version;
   sql.push(`INSERT INTO poem_versions(poem_id,name,content,version,created_at,client_id,sync_json) SELECT ${target.id},name,content,${high},created_at,${q(clientId)},${q(JSON.stringify(sync))} FROM poem_versions WHERE id=${original.id} AND poem_id=${source.id};`);
   const row={...original,poem_id:target.id,version:high,client_id:clientId};identities.set(clientId,row);latest=row;
   references.set(`cloud-${source.id}-${original.version}`,`cloud-${target.id}-${high}`);
  }
  sql.push(`INSERT OR IGNORE INTO merged_poems(user_id,source_id,target_id) VALUES(${owner},${source.id},${target.id});`);
 }
 // Appending an older history must not replace a more recent working text.
 if(current&&latest!==current&&current.created_at>latest.created_at&&poemVersionState(storedVersion(current))!==poemVersionState(storedVersion(latest))){
  const sync={...JSON.parse(current.sync_json||'{}'),id:`merge-current-${target.id}`};
  sql.push(`INSERT INTO poem_versions(poem_id,name,content,version,created_at,client_id,sync_json) SELECT poem_id,name,content,${++high},created_at,${q(sync.id)},${q(JSON.stringify(sync))} FROM poem_versions WHERE id=${current.id};`);
 }
 sql.push(`UPDATE poems SET title_key=${q(key)} WHERE id=${target.id} AND user_id=${owner};`);
}
function remap(value){
 if(typeof value==='string')return references.get(value)||value;
 if(Array.isArray(value))return value.map(remap);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[references.get(k)||k,remap(v)]));
 return value;
}
for(const row of contests){const next=JSON.stringify(remap(JSON.parse(row.data_json)));if(next!==row.data_json)sql.push(`UPDATE contests SET data_json=${q(next)} WHERE user_id=${owner} AND contest_key=${q(row.contest_key)} AND data_json=${q(row.data_json)};`);}
for(const row of prefs){const next=JSON.stringify(remap(JSON.parse(row.data_json)));if(next!==row.data_json)sql.push(`UPDATE workshop_preferences SET data_json=${q(next)} WHERE user_id=${owner} AND data_json=${q(row.data_json)};`);}
for(const tag of tags){const key=references.get(tag.poem_key);if(key)sql.push(`INSERT OR IGNORE INTO poem_tag_assignments(user_id,poem_key,tag_name) VALUES(${owner},${q(key)},${q(tag.tag_name)});`);}
if(merged)sql.push(`UPDATE workshop_revisions SET revision=revision+1 WHERE user_id=${owner};`);
await writeFile(output,sql.join('\n')+'\n');
console.log(JSON.stringify({before:poems.length,after:groups.size,merged,copiedVersions:copied,originalRowsPreserved:true}));
