import { poemValidationError,poemTitleKey } from '../../../poem-policy.js';
import {existingPoemTitle,canonicalPoemId} from '../../_lib/poem-identity.js';
import {onRequestPut} from './[id].js';
import { versionSyncMetadata } from '../../_lib/version-sync.js';
import {compressedAliases,compressedVersionConflict} from '../../_lib/poem-compression.js';
import {
  jsonResponse, errorResponse, safeJson, requireUser, serializePoem, normalizeFontFamily,
} from '../../_lib/helpers.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const { user, error } = await requireUser(request, env);
  if (error) return error;
  const query = new URL(request.url).searchParams;
  const paged = query.has('limit');
  const limit = Math.max(1,Math.min(200,Number(query.get('limit'))||100));
  const afterPoem = Math.max(0,Number(query.get('afterPoem'))||0);
  const afterVersion = Math.max(0,Number(query.get('afterVersion'))||0);

  const { results } = await env.escandidor_db
    .prepare(
      `SELECT p.id, p.name AS title, p.configurations AS settings_json, p.font_family, p.color_index,
              p.created_at, p.updated_at, pv.name AS version_name, pv.content,
              pv.version, pv.created_at AS version_created_at, pv.sync_json
       FROM poems p JOIN poem_versions pv ON pv.poem_id = p.id
       WHERE p.user_id = ?
         AND NOT EXISTS(SELECT 1 FROM merged_poems m WHERE m.source_id=p.id)
         ${paged ? 'AND (p.id > ? OR (p.id = ? AND pv.version > ?))' : ''}
         AND NOT EXISTS (
           SELECT 1 FROM deleted_poems dp
           WHERE dp.user_id = p.user_id AND dp.poem_id = p.id
         )
       ${paged ? 'ORDER BY p.id ASC,pv.version ASC LIMIT ?' : 'ORDER BY p.updated_at DESC,pv.version ASC'}`
    )
    .bind(...(paged ? [user.id,afterPoem,afterPoem,afterVersion,limit] : [user.id]))
    .all();

  const poemsById = new Map();
  for (const row of results) {
    let poem = poemsById.get(row.id);
    if (!poem) {
      poem = { ...serializePoem(row), versions: [] };
      poemsById.set(row.id, poem);
    }
    poem.versions.push({
      version: row.version,
      versionName: row.version_name,
      content: row.content,
      createdAt: row.version_created_at,
      sync: JSON.parse(row.sync_json || '{}'),
    });
    poem.version = row.version;
    poem.versionName = row.version_name;
    poem.content = row.content;
  }

  const last = results.at(-1);
  return jsonResponse({ ok: true, poems: [...poemsById.values()], ...(paged ? {
    nextCursor: results.length === limit ? {poemId:last.id,version:last.version} : null
  } : {}) });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const { user, error } = await requireUser(request, env);
  if (error) return error;

  const body = await safeJson(request);
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 200) : '';
  const versionName = (body.versionName || 'v1').trim().slice(0, 60);
  const content = typeof body.content === 'string' ? body.content : '';
  const validationError = poemValidationError(title, content);
  if (validationError) return errorResponse(validationError, 400);
  const settings = body.settings && typeof body.settings === 'object' ? body.settings : {};
  const fontFamily = normalizeFontFamily(body.fontFamily ?? settings.poemFont);
  settings.poemFont = fontFamily;
  const colorIndex = Number.isInteger(body.colorIndex) ? body.colorIndex : null;
  const sync = versionSyncMetadata(body, settings);
  // A lost POST response must not create a second poem when the device retries.
  if (sync) {
    const uploaded = await env.escandidor_db.prepare(`SELECT cp.*,pv.version AS synced_version FROM current_poems cp
      JOIN poem_versions pv ON pv.poem_id=cp.id WHERE cp.user_id=? AND pv.client_id=? AND NOT EXISTS(SELECT 1 FROM merged_poems m WHERE m.source_id=cp.id)`)
      .bind(user.id, sync.id).first();
    if (uploaded) return jsonResponse({ ok: true, poem: serializePoem(uploaded), syncedVersion: uploaded.synced_version });
    const alias=(await compressedAliases(env.escandidor_db,user.id,Number(body.sourcePoemId)||null,[{id:sync.id,cloudVersion:body.sync?.cloudVersion}])).get(sync.id);
    if(alias){
      const conflict=compressedVersionConflict(alias,content,settings);if(conflict)return conflict;
      const current=await env.escandidor_db.prepare('SELECT * FROM current_poems WHERE id=? AND user_id=?').bind(alias.poem_id,user.id).first();
      return jsonResponse({ok:true,poem:serializePoem(current),syncedVersion:alias.replacement_version,compressed:true});
    }
  }

  const sourcePoemId = await canonicalPoemId(env.escandidor_db,user.id,Number(body.sourcePoemId));
  const deletion = Number.isInteger(sourcePoemId) && sourcePoemId > 0
    ? await env.escandidor_db
      .prepare('SELECT deleted_at FROM deleted_poems WHERE user_id = ? AND poem_id = ?')
      .bind(user.id, sourcePoemId)
      .first()
    : null;
  if (deletion && body.restoreDeleted !== true) {
    return errorResponse('Este poema fue eliminado. Restáuralo explícitamente para volver a subirlo.', 409, {
      code: 'poem_deleted',
      deletedAt: deletion.deleted_at,
    });
  }
  if (deletion) {
    await env.escandidor_db
      .prepare('DELETE FROM deleted_poems WHERE user_id = ? AND poem_id = ?')
      .bind(user.id, sourcePoemId)
      .run();
  }

  const existingId=await existingPoemTitle(env.escandidor_db,user.id,title);
  if(existingId)return onRequestPut({...context,params:{id:existingId},request:new Request(request.url,{method:'PUT',headers:request.headers,body:JSON.stringify(body)})});
  const titleKey=poemTitleKey(title),clientId=sync?.id??crypto.randomUUID();
  // Claim the title and save its first version in one transaction. Concurrent
  // imports and background reconciliation therefore share the same poem ID.
  await env.escandidor_db.batch([
    env.escandidor_db.prepare(`INSERT INTO poems(user_id,name,title_key,configurations,font_family,color_index) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,title_key) DO NOTHING`)
      .bind(user.id,title,titleKey,JSON.stringify(settings),fontFamily,colorIndex),
    env.escandidor_db.prepare(`INSERT INTO poem_versions(poem_id,name,content,version,client_id,sync_json)
      SELECT p.id,?,?,COALESCE((SELECT MAX(version) FROM (SELECT version FROM poem_versions WHERE poem_id=p.id UNION ALL SELECT version FROM compressed_poem_versions WHERE poem_id=p.id)),0)+1,?,?
      FROM poems p WHERE p.user_id=? AND p.title_key=?
      ON CONFLICT(poem_id,client_id) DO NOTHING`)
      .bind(versionName,content,clientId,JSON.stringify(sync??{settings}),user.id,titleKey)
  ]);
  const poem=await env.escandidor_db.prepare('SELECT id FROM poems WHERE user_id=? AND title_key=?').bind(user.id,titleKey).first();

  const row = await env.escandidor_db
    .prepare('SELECT * FROM current_poems WHERE id = ?')
    .bind(poem.id)
    .first();

  const saved=await env.escandidor_db.prepare('SELECT version FROM poem_versions WHERE poem_id=? AND client_id=?').bind(poem.id,clientId).first();
  return jsonResponse({ ok: true, poem: serializePoem(row),syncedVersion:saved.version }, { status: 201 });
}
