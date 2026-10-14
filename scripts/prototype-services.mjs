import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {webcrypto} from 'node:crypto';
import {localPlicaKey} from './plica-local-key.mjs';
import {encryptPlica,decryptPlica} from '../plica-crypto.js';
import {normalizePlica,mergePlicaProfiles} from '../plica-policy.js';
const script=fileURLToPath(new URL('./prototype-storage.py',import.meta.url));
function python(args,input){return new Promise((ok,fail)=>{const child=spawn('python',[script,...args],{windowsHide:true,stdio:['pipe','pipe','pipe'],env:{...process.env,PYTHONIOENCODING:'utf-8'}});let output='',errors='';const timeout=setTimeout(()=>{child.kill();fail(Error('La operación local demoró demasiado.'));},15000);child.stdout.on('data',c=>output+=c);child.stderr.on('data',c=>errors+=c);child.on('error',e=>{clearTimeout(timeout);fail(e);});child.on('close',code=>{clearTimeout(timeout);if(code!==0){fail(Error(args[0]==='pdf'?'No se pudo leer el texto del PDF.':'No se pudo guardar o cargar la plica local.'));return;}try{ok(JSON.parse(output));}catch{fail(Error('Respuesta local inválida.'));}});child.stdin.on('error',()=>{});child.stdin.end(input);});}
let initialization;
export function initializeLocalPlicas(){
  initialization??=(async()=>{
    const status=await python([],JSON.stringify({operation:'status'}));
    const secret=await localPlicaKey({allowCreate:status.profiles.length===0});
    if(status.profiles.length){const row=status.profiles[0];await decryptPlica(row.encrypted_sensitive,secret,row.owner,webcrypto);}
    if(status.legacy){
      const owners=new Map();for(const row of status.rows){if(!owners.has(row.owner))owners.set(row.owner,[]);owners.get(row.owner).push(row);}
      const rows=await Promise.all([...owners].map(async([owner,items])=>{
        const p=mergePlicaProfiles(items.map(row=>({...row,includeAi:!!row.includeAi})));
        return {owner,encrypted_sensitive:await encryptPlica(p,secret,owner,webcrypto),includeAi:+p.includeAi,aiStatement:p.aiStatement,signatureDate:p.signatureDate,updatedAt:items[0].updatedAt};
      }));
      await python([],JSON.stringify({operation:'migrate',expected:status.rows,rows}));
    }
    return secret;
  })();return initialization;
}
export async function localPlica(data){
  const secret=await initializeLocalPlicas();
  const input={operation:data.operation,owner:data.owner};
  if(data.operation==='put'){const p=normalizePlica(data.plica);Object.assign(input,{encryptedSensitive:await encryptPlica(p,secret,data.owner,webcrypto),includeAi:+p.includeAi,aiStatement:p.aiStatement,signatureDate:p.signatureDate});}
  const result=await python([],JSON.stringify(input));
  const plica=result.row?{...normalizePlica({...await decryptPlica(result.row.encrypted_sensitive,secret,data.owner,webcrypto),includeAi:!!result.row.includeAi,aiStatement:result.row.aiStatement,signatureDate:result.row.signatureDate}),updatedAt:result.row.updatedAt}:null;
  return {ok:true,plica};
}
export const extractPdf=bytes=>python(['pdf'],bytes);
