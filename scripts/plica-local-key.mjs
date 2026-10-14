import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {validatePlicaKey} from '../plica-crypto.js';
const file=fileURLToPath(new URL('../.wrangler/prototype-plica-key.dpapi',import.meta.url));
const helper=fileURLToPath(new URL('./plica-local-key.ps1',import.meta.url));
function protect(operation,input){return new Promise((ok,fail)=>{
  const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',helper,'-Operation',operation],{windowsHide:true,stdio:['pipe','pipe','pipe']});let output='';
  const timeout=setTimeout(()=>{child.kill();fail(Error('No se pudo acceder a la clave local.'));},10000);
  child.stdout.on('data',c=>output+=c);child.stderr.resume();child.on('error',()=>{clearTimeout(timeout);fail(Error('No se pudo acceder a la clave local.'));});
  child.on('close',code=>{clearTimeout(timeout);if(code!==0){fail(Error('No se pudo proteger o recuperar la clave local con Windows.'));return;}ok(output.trim());});child.stdin.on('error',()=>{});child.stdin.end(input);
});}
export async function localPlicaKey({allowCreate=true}={}){
  if(process.env.PLICA_ENCRYPTION_KEY){validatePlicaKey(process.env.PLICA_ENCRYPTION_KEY);return process.env.PLICA_ENCRYPTION_KEY;}
  if(process.platform!=='win32')throw Error('Configurá PLICA_ENCRYPTION_KEY para el servidor local.');
  let wrapped;try{wrapped=await readFile(file,'utf8');}catch(e){if(e.code!=='ENOENT')throw Error('No se pudo leer la clave protegida.');}
  if(wrapped){const secret=await protect('unprotect',wrapped);validatePlicaKey(secret);return secret;}
  if(!allowCreate)throw Error('Falta la clave original de la base cifrada. No se generará otra.');
  const secret=randomBytes(32).toString('base64');wrapped=await protect('protect',secret);
  await mkdir(fileURLToPath(new URL('../.wrangler/',import.meta.url)),{recursive:true});
  try{await writeFile(file,wrapped,{flag:'wx',mode:0o600});return secret;}catch(e){if(e.code==='EEXIST'){const current=await protect('unprotect',await readFile(file,'utf8'));validatePlicaKey(current);return current;}throw Error('No se pudo guardar la clave protegida.');}
}
