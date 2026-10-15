import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,access,symlink} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn,spawnSync} from 'node:child_process';
import {fetchContest} from '../taller/importer.js';
import {extractPdf} from './prototype-services.mjs';
import {localPlicaKey} from './plica-local-key.mjs';
import {decryptPlica} from '../plica-crypto.js';
import {webcrypto} from 'node:crypto';
const root=resolve(fileURLToPath(new URL('..',import.meta.url))),port=Number(process.env.LOCAL_PORT)||8794,apiPort=Number(process.env.LOCAL_API_PORT)||8795;
const storage=resolve(root,'.wrangler/real-local'),wrangler=resolve(root,'node_modules/wrangler/bin/wrangler.js');
const env={...process.env,CLOUDFLARE_SEND_METRICS:'false',WRANGLER_SEND_METRICS:'false'};
await mkdir(storage,{recursive:true});
function migrate(file){const r=spawnSync(process.execPath,[wrangler,'d1','execute','escandidor-local','--config','wrangler.local.jsonc','--local','--persist-to',storage,'--file',file],{cwd:root,env,windowsHide:true,encoding:'utf8'});if(r.status!==0)throw Error('No se pudo preparar la base local. No se ejecutó ninguna migración remota.');}
try{await access(resolve(storage,'initialized'));}catch{migrate('schema.sql');await writeFile(resolve(storage,'initialized'),'schema.sql\n');}
migrate('migrations/0016_workshop.sql');
const syncProbe=spawnSync(process.execPath,[wrangler,'d1','execute','escandidor-local','--config','wrangler.local.jsonc','--local','--persist-to',storage,'--command','SELECT client_id,sync_json FROM poem_versions LIMIT 0'],{cwd:root,env,windowsHide:true,encoding:'utf8'});
if(syncProbe.status!==0)migrate('migrations/0017_poem_version_sync.sql');
migrate('migrations/0018_compressed_versions.sql');
const identityProbe=spawnSync(process.execPath,[wrangler,'d1','execute','escandidor-local','--config','wrangler.local.jsonc','--local','--persist-to',storage,'--command','SELECT title_key FROM poems LIMIT 0'],{cwd:root,env,windowsHide:true,encoding:'utf8'});
if(identityProbe.status!==0)migrate('migrations/0019_poem_identity.sql');
migrate('migrations/0020_library_revisions.sql');
const runtime=resolve(storage,'runtime');await mkdir(runtime,{recursive:true});const config=JSON.parse(await readFile(resolve(root,'wrangler.local.jsonc'),'utf8'));config.pages_build_output_dir=root;await writeFile(resolve(runtime,'wrangler.jsonc'),JSON.stringify(config));try{await access(resolve(runtime,'functions'));}catch{await symlink(resolve(root,'functions'),resolve(runtime,'functions'),'junction');}
const probe=spawnSync('python',[resolve(root,'scripts/local-database-profile.py'),resolve(storage,'v3/d1/miniflare-D1DatabaseObject')],{windowsHide:true,encoding:'utf8'});if(probe.status!==0)throw Error('No se pudo verificar la base cifrada local.');const profileStatus=JSON.parse(probe.stdout);
const secret=await localPlicaKey({allowCreate:profileStatus.count===0});if(profileStatus.profile)await decryptPlica(profileStatus.profile.encrypted,secret,profileStatus.profile.owner,webcrypto);
const backend=spawn(process.execPath,[wrangler,'pages','dev',root,'--d1','escandidor_db=00000000-0000-0000-0000-000000000001','--port',String(apiPort),'--ip','127.0.0.1','--persist-to',storage,'--log-level','error','--show-interactive-dev-session=false','--binding',`PLICA_ENCRYPTION_KEY=${secret}`],{cwd:runtime,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
let startupError='';for(const stream of [backend.stdout,backend.stderr])stream.on('data',chunk=>{startupError=(startupError+String(chunk).replaceAll(secret,'[redacted]')).slice(-4000);});
let up=false;for(let i=0;i<400;i++){if(backend.exitCode!==null)break;try{const r=await fetch(`http://127.0.0.1:${apiPort}/api/auth/me`);if(r.ok){up=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
if(!up){backend.kill();throw Error('No se pudo iniciar la API local. '+startupError);}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2','.ttf':'font/ttf','.otf':'font/otf','.json':'application/json','.pdf':'application/pdf','.webm':'video/webm','.txt':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8'};
const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
const server=createServer(async(req,res)=>{
 try{
  if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host)){json(res,403,{error:'Host no permitido.'});return;}
  const url=new URL(req.url,`http://127.0.0.1:${port}`);
  if(url.pathname.startsWith('/api/')){
   if(!['GET','HEAD'].includes(req.method)&&req.headers.origin&&!['http://localhost:'+port,'http://127.0.0.1:'+port].includes(req.headers.origin)){json(res,403,{error:'Origen no permitido.'});return;}
   let body; if(!['GET','HEAD'].includes(req.method)){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>2_000_000){json(res,413,{error:'Solicitud demasiado grande.'});return;}chunks.push(chunk);}body=Buffer.concat(chunks);}
   if(url.pathname==='/api/contests/import'){
    if(req.method!=='POST'){json(res,405,{error:'Usá POST.'});return;}
    const session=await fetch(`http://127.0.0.1:${apiPort}/api/auth/me`,{headers:{Cookie:req.headers.cookie||''}}).then(r=>r.json());
    if(!session.user){json(res,401,{error:'Ingresá a tu cuenta local para guardar concursos.'});return;}
    try{const input=JSON.parse(body.toString());json(res,200,{ok:true,contest:await fetchContest(input.url,{extractPdf})});}catch(e){json(res,422,{error:e.message});}return;
   }
   const headers={...req.headers,host:`127.0.0.1:${apiPort}`};delete headers.connection;delete headers['content-length'];if(headers.origin)headers.origin=`http://127.0.0.1:${apiPort}`;
   const response=await fetch(`http://127.0.0.1:${apiPort}${url.pathname}${url.search}`,{method:req.method,headers,body,redirect:'manual'});
   const outgoing=Object.fromEntries(response.headers);delete outgoing['content-encoding'];delete outgoing['content-length'];delete outgoing['transfer-encoding'];outgoing['cache-control']='no-store';
   res.writeHead(response.status,outgoing);res.end(Buffer.from(await response.arrayBuffer()));return;
  }
  if(!['GET','HEAD'].includes(req.method)){json(res,405,{error:'Método no permitido.'});return;}
  let pathname=decodeURIComponent(url.pathname);
  // Legacy entry points open the workshop editor only on this local server.
  // The iframe keeps loading the original editor document with ?taller=1.
  if(['/escandidor','/escandidor/','/escandidor.html'].includes(pathname)&&url.searchParams.get('taller')!=='1'){
   const query=new URLSearchParams(url.searchParams);query.set('view','editor');
   res.writeHead(302,{Location:'/taller/?'+query.toString(),'Cache-Control':'no-store'});res.end();return;
  }
  if(pathname==='/')pathname='/index.html';
  if(pathname.endsWith('/'))pathname+='index.html';
  const file=resolve(root,'.'+pathname),extension=extname(file);
  if(!file.startsWith(root+sep)||!types[extension]||pathname.split('/').some(p=>p.startsWith('.')||['node_modules','functions','migrations','scripts','tests','workers'].includes(p.toLowerCase()))){res.writeHead(403);res.end('No disponible');return;}
  try{const data=await readFile(file);res.writeHead(200,{'Content-Type':types[extension],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data);}catch{res.writeHead(404);res.end('Archivo no encontrado');}
 }catch{json(res,500,{error:'No se pudo procesar la solicitud local.'});}
});
let stopping=false;function stop(){if(stopping)return;stopping=true;server.close();if(backend.exitCode===null){if(process.platform==='win32')spawnSync('taskkill',['/pid',String(backend.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});else backend.kill();}}
process.on('SIGINT',()=>{stop();process.exit(0);});process.on('SIGTERM',()=>{stop();process.exit(0);});process.on('exit',stop);
server.listen(port,'127.0.0.1',()=>console.log(`Aplicación real local: http://localhost:${port}/taller/\nBase y API locales. No se desplegó ni se migró Cloudflare.`));
