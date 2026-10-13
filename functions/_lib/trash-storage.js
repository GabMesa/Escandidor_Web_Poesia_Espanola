import { applyTrashPolicy, TRASH_MAX_BYTES, TRASH_MAX_COPIES, TRASH_RETENTION_DAYS } from '../../trash-policy.js';

export async function maintainUserTrash(env, userId) {
  const settings = await env.escandidor_db.prepare('SELECT auto_cleanup FROM user_trash_settings WHERE user_id = ?').bind(userId).first();
  const autoCleanup = settings?.auto_cleanup !== 0;
  const { results } = await env.escandidor_db.prepare("SELECT id, poem_id, title, versions_json, deleted_at FROM deleted_poems WHERE user_id = ? AND versions_json <> '[]' ORDER BY deleted_at DESC, id DESC").bind(userId).all();
  const entries = results.map(row => {
    let versions;
    try { versions = JSON.parse(row.versions_json); } catch { versions = row.versions_json; }
    return { id: row.id, poemId: row.poem_id, title: row.title, versions, deletedAt: row.deleted_at };
  });
  const result = applyTrashPolicy(entries, { autoCleanup });
  if (result.removed.length) {
    await env.escandidor_db.batch(result.removed.map(entry => entry.poemId !== null
      ? env.escandidor_db.prepare("UPDATE deleted_poems SET versions_json = '[]' WHERE id = ? AND user_id = ?").bind(entry.id, userId)
      : env.escandidor_db.prepare('DELETE FROM deleted_poems WHERE id = ? AND user_id = ?').bind(entry.id, userId)));
  }
  return { autoCleanup, maxBytes: TRASH_MAX_BYTES, maxCopies: TRASH_MAX_COPIES, retentionDays: TRASH_RETENTION_DAYS, usedBytes: result.usedBytes };
}
