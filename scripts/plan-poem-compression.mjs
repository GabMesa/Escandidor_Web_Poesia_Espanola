import {readFile,writeFile} from 'node:fs/promises';
import {compressPoemVersions,poemVersionState} from '../poem-compression.js';
import {storedVersion,compressionStatements} from '../functions/_lib/poem-compression.js';
const [input,output]=process.argv.slice(2);
if(!input||!output)throw Error('Usage: node scripts/plan-poem-compression.mjs private-snapshot.json private-plan.sql');
const rows=JSON.parse((await readFile(input,'utf8')).replace(/^\uFEFF/,''))[0].results;
if(!rows?.length||new Set(rows.map(r=>r.poem_id)).size!==1||new Set(rows.map(r=>r.user_id)).size!==1)throw Error('Expected a snapshot of one owned poem.');
const versions=rows.map(storedVersion),result=compressPoemVersions(versions);
const beforeStates=new Set(versions.map(poemVersionState)),afterStates=new Set(result.retained.map(poemVersionState));
if([...beforeStates].some(key=>!afterStates.has(key)))throw Error('The plan removes a distinct state; review it before applying.');
if(!result.retained.includes(versions.at(-1)))throw Error('The current server version must remain unchanged.');
const quote=value=>typeof value==='number'?String(value):value===null?'NULL':"'"+String(value).replaceAll("'","''")+"'";
const sql=[];
for(let offset=0;offset<result.replacements.length;offset+=20){
  for(const statement of compressionStatements(rows[0].user_id,rows[0].poem_id,result.replacements.slice(offset,offset+20))){
    let index=0;const bound=statement.sql.replace(/\?/g,()=>quote(statement.args[index++]));
    if(Buffer.byteLength(bound)>95000)throw Error('Statement exceeds the conservative SQL size limit.');
    sql.push(bound+';');
  }
}
await writeFile(output,sql.join('\n'),'utf8');
console.log(JSON.stringify({poemId:rows[0].poem_id,before:rows.length,after:result.retained.length,removed:result.removed.length,distinctStates:beforeStates.size,keepsEveryState:true,keepsLatest:true,latestVersion:rows.at(-1).version,statements:sql.length}));
