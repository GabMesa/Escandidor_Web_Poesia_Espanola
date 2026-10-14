import {poemTimestamp} from './poem-exports.js';

export function sortPoemsByLastUpdate(poems) {
  const updatedAt = poem => [poem.updatedAt, ...(poem.versions || []).map(v => v.savedAt)]
    .reduce((latest, value) => {
      const timestamp = poemTimestamp(value);
      return Number.isFinite(timestamp) ? Math.max(latest, timestamp) : latest;
    }, -Infinity);
  return poems.map(poem => ({poem, timestamp: updatedAt(poem)}))
    .sort((a, b) => a.timestamp === b.timestamp ? 0 : a.timestamp > b.timestamp ? -1 : 1)
    .map(entry => entry.poem);
}
