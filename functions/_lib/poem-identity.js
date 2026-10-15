import {poemTitleKey} from '../../poem-policy.js';

export async function canonicalPoemId(db,userId,id){
  const alias=await db.prepare('SELECT target_id FROM merged_poems WHERE user_id=? AND source_id=?').bind(userId,id).first();
  return alias?.target_id??id;
}

export async function existingPoemTitle(db,userId,title){
  const key=poemTitleKey(title);
  const known=await db.prepare('SELECT id FROM poems WHERE user_id=? AND title_key=?').bind(userId,key).first();
  if(known)return known.id;
  // Older installations acquire their normalized identity without changing
  // the displayed title or assuming SQLite supports Unicode case folding.
  const {results}=await db.prepare('SELECT id,name FROM poems p WHERE user_id=? AND title_key IS NULL AND NOT EXISTS(SELECT 1 FROM merged_poems m WHERE m.source_id=p.id) ORDER BY id').bind(userId).all();
  return results.find(p=>poemTitleKey(p.name)===key)?.id??null;
}
