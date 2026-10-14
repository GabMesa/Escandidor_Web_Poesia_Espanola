import {jsonResponse,errorResponse,safeJson,requireUser} from '../../_lib/helpers.js';
import {normalizePlica} from '../../../plica-policy.js';
import {encryptPlica,decryptPlica} from '../../../plica-crypto.js';
import {plicaSecret,encryptLegacyPlicas} from '../../_lib/plica-storage.js';
const privateJson=(value,status=200)=>jsonResponse(value,{status,headers:{'Cache-Control':'no-store','Vary':'Cookie'}});
const unavailable=()=>privateJson({ok:false,error:'No se pudo acceder a la plica cifrada. Revisá la configuración del servidor.'},503);
async function prepare(env){const secret=plicaSecret(env);const migration=await encryptLegacyPlicas(env,secret);if(migration.pending)throw Error('Migración de plicas pendiente.');return secret;}
export async function onRequestGet({request,env}){
  const {user,error}=await requireUser(request,env);if(error)return error;
  try{
    const secret=await prepare(env);
    const row=await env.escandidor_db.prepare('SELECT * FROM user_plica_profiles WHERE user_id=?').bind(user.id).first();
    const plica=row?{...normalizePlica({...await decryptPlica(row.encrypted_sensitive,secret,user.id),includeAi:row.include_ai===1,aiStatement:row.ai_statement,signatureDate:row.signature_date}),updatedAt:row.updated_at}:null;
    return privateJson({ok:true,plica});
  }catch{return unavailable();}
}
export async function onRequestPut({request,env}){
  const {user,error}=await requireUser(request,env);if(error)return error;
  const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return errorResponse('Origen no permitido.',403);
  const body=await safeJson(request);let p;try{p=normalizePlica(body.plica);}catch(e){return errorResponse(e.message,400);}
  try{
    const secret=await prepare(env),payload=await encryptPlica(p,secret,user.id);
    await env.escandidor_db.prepare(`INSERT INTO user_plica_profiles(user_id,encrypted_sensitive,include_ai,ai_statement,signature_date)
      VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET encrypted_sensitive=excluded.encrypted_sensitive,
      include_ai=excluded.include_ai,ai_statement=excluded.ai_statement,signature_date=excluded.signature_date,updated_at=datetime('now')`)
      .bind(user.id,payload,+p.includeAi,p.aiStatement,p.signatureDate).run();
    return privateJson({ok:true,plica:p});
  }catch{return unavailable();}
}
