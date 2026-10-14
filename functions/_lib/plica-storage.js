import {encryptPlica,validatePlicaKey} from '../../plica-crypto.js';
import {mergePlicaProfiles} from '../../plica-policy.js';
const fields=['full_name','identity_document','postal_address','email','phone','biography','include_ai','ai_statement','signature_name','signature_date'];
const names=['fullName','identityDocument','postalAddress','email','phone','biography','includeAi','aiStatement','signatureName','signatureDate'];
export function plicaSecret(env){const secret=env.PLICA_ENCRYPTION_KEY;if(!secret)throw Error('Falta la clave de cifrado de plicas.');validatePlicaKey(secret);return secret;}
export async function encryptLegacyPlicas(env,secret=plicaSecret(env)){
  const db=env.escandidor_db;
  const {results}=await db.prepare('SELECT DISTINCT user_id FROM user_contest_plicas LIMIT 10').all();
  for(const {user_id} of results){
    const legacy=await db.prepare('SELECT * FROM user_contest_plicas WHERE user_id=? ORDER BY updated_at DESC,contest_key').bind(user_id).all();
    const p=mergePlicaProfiles(legacy.results.map(row=>Object.fromEntries(names.map((name,i)=>[name,name==='includeAi'?row[fields[i]]===1:row[fields[i]]||'']))));
    const payload=await encryptPlica(p,secret,user_id);
    await db.batch([
      db.prepare(`INSERT INTO user_plica_profiles(user_id,encrypted_sensitive,include_ai,ai_statement,signature_date,updated_at)
        VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO NOTHING`).bind(user_id,payload,+p.includeAi,p.aiStatement,p.signatureDate,legacy.results[0].updated_at),
      db.prepare('DELETE FROM user_contest_plicas WHERE user_id=?').bind(user_id),
    ]);
  }
  const pending=await db.prepare('SELECT count(*) AS count FROM user_contest_plicas').first();
  return {migrated:results.length,pending:pending.count};
}
