function compareAge(left, right) {
  const a = Date.parse(left.savedAt);
  const b = Date.parse(right.savedAt);
  if (Number.isFinite(a) && Number.isFinite(b) && a !== b) return a - b;
  return (Number(left.versionNumber) || 0) - (Number(right.versionNumber) || 0);
}

export function compressPoemVersions(versions) {
  const ordered = [...versions];
  // Saved histories are chronological. Only legacy histories need reordering.
  if (ordered.some((entry, index) => index > 0 && compareAge(ordered[index - 1], entry) > 0)) ordered.sort(compareAge);
  const retained = [];
  const removed = [];
  for (let index = 0; index < ordered.length; index += 1) {
    const current = ordered[index];
    const previous = ordered[index - 1];
    // Compare adjacent ORIGINAL versions, never scan earlier surviving versions.
    if (previous && String(current.poemText ?? '').includes(String(previous.poemText ?? ''))) {
      retained.pop();
      removed.push(previous);
    }
    retained.push(current);
  }
  return { retained, removed };
}
