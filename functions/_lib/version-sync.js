export function versionSyncMetadata(body, settings) {
  const source = body.sync;
  if (!source || typeof source.id !== 'string' || !source.id || source.id.length > 160) return null;
  const date = new Date(source.savedAt);
  return {
    id: source.id,
    kind: source.kind === 'autosave' ? 'autosave' : 'manual',
    versionNumber: Number.isSafeInteger(source.versionNumber) && source.versionNumber > 0 ? source.versionNumber : null,
    savedAt: Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString(),
    settings,
  };
}
