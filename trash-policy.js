export const TRASH_MAX_BYTES = 512 * 1024;
export const TRASH_MAX_COPIES = 10;
export const TRASH_RETENTION_DAYS = 30;

export function trashTimestamp(value) {
  const date = String(value ?? '');
  return Date.parse(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(date) ? date.replace(' ', 'T') + 'Z' : date);
}

export function trashEntryBytes(entry) {
  return new TextEncoder().encode(JSON.stringify(entry)).byteLength;
}

export function applyTrashPolicy(entries, { autoCleanup = true, now = Date.now() } = {}) {
  const cutoff = now - TRASH_RETENTION_DAYS * 86400000;
  const ordered = [...entries].sort((a, b) => trashTimestamp(b.deletedAt) - trashTimestamp(a.deletedAt));
  const retained = [];
  const removed = [];
  for (const entry of ordered) {
    if (autoCleanup && trashTimestamp(entry.deletedAt) <= cutoff) removed.push(entry);
    else retained.push(entry);
  }
  let usedBytes = retained.reduce((sum, entry) => sum + trashEntryBytes(entry), 0);
  while (retained.length > TRASH_MAX_COPIES || usedBytes > TRASH_MAX_BYTES) {
    const entry = retained.pop();
    usedBytes -= trashEntryBytes(entry);
    removed.push(entry);
  }
  return { retained, removed, usedBytes };
}
