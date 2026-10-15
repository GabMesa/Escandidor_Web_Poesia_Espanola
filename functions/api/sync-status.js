import {jsonResponse,requireUser} from '../_lib/helpers.js';

export async function onRequestGet({request,env}) {
  const {user,error}=await requireUser(request,env);
  if(error)return error;
  const row=await env.escandidor_db.prepare('SELECT revision FROM library_revisions WHERE user_id=?').bind(user.id).first();
  // The day also invalidates snapshots so trash retention is checked regularly.
  return jsonResponse({ok:true,revision:`${user.id}:${row?.revision??0}:${new Date().toISOString().slice(0,10)}`},
    {headers:{'Cache-Control':'no-store','Vary':'Cookie'}});
}
