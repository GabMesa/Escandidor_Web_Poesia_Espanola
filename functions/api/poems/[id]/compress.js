import {requireUser,safeJson,jsonResponse,errorResponse} from '../../../_lib/helpers.js';
import {compressServerPoem} from '../../../_lib/poem-compression.js';
export async function onRequestPost({request,env,params}){
  const {user,error}=await requireUser(request,env);if(error)return error;
  const poem=await env.escandidor_db.prepare('SELECT id FROM poems WHERE id=? AND user_id=?').bind(params.id,user.id).first();
  if(!poem)return errorResponse('Poema no encontrado.',404);
  const body=await safeJson(request);
  return jsonResponse({ok:true,...await compressServerPoem(env.escandidor_db,user.id,poem.id,{dryRun:body.dryRun===true})});
}
