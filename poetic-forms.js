export const POETIC_FORM_PRESETS = Object.freeze({
  custom: { label: 'Personalizada' },
  pareado: { label: 'Pareado', verseCount: 2, rhymeScheme: 'AA', rhymeMode: 'asonante' },
  terceto: { label: 'Terceto', verseCount: 3, rhymeScheme: 'A-A', rhymeMode: 'consonante' },
  tercetillo: { label: 'Tercetillo', verseCount: 3, rhymeScheme: 'a-a', rhymeMode: 'consonante' },
  cuarteto: { label: 'Cuarteto', verseCount: 4, rhymeScheme: 'ABBA', rhymeMode: 'consonante' },
  serventesio: { label: 'Serventesio', verseCount: 4, rhymeScheme: 'ABAB', rhymeMode: 'consonante' },
  redondilla: { label: 'Redondilla', verseCount: 4, syllablePattern: '8', stressPatterns: { 8: '3-7' }, rhymeScheme: 'abba', rhymeMode: 'consonante' },
  cuarteta: { label: 'Cuarteta', verseCount: 4, syllablePattern: '8', stressPatterns: { 8: '3-7' }, rhymeScheme: 'abab', rhymeMode: 'consonante' },
  copla: { label: 'Copla', verseCount: 4, syllablePattern: '8', stressPatterns: { 8: '3-7' }, rhymeScheme: '-a-a', rhymeMode: 'asonante' },
  seguidilla: { label: 'Seguidilla', verseCount: 4, syllablePattern: '7-5-7-5', stressPatterns: { 7: '3-6', 5: '2-4' }, rhymeScheme: 'abab', rhymeMode: 'asonante' },
  cuadernaVia: { label: 'Cuaderna vía', verseCount: 4, syllablePattern: '14', stressPatterns: { 14: '6-13' }, hemistichSplit: '7', rhymeScheme: 'AAAA', rhymeMode: 'consonante' },
  quinteto: { label: 'Quinteto', verseCount: 5, rhymeMode: 'consonante' },
  quintilla: { label: 'Quintilla', verseCount: 5, syllablePattern: '8', stressPatterns: { 8: '3-7' }, rhymeMode: 'consonante' },
  lira: { label: 'Lira', verseCount: 5, syllablePattern: '7-11-7-7-11', stressPatterns: { 7: '3-6', 11: '6-10' }, rhymeScheme: 'aBabB', rhymeMode: 'consonante' },
  pieQuebrado: { label: 'Estrofa de pie quebrado', verseCount: 6, syllablePattern: '8-8-4-8-8-4', stressPatterns: { 8: '3-7', 4: '3' }, rhymeScheme: 'abcabc', rhymeMode: 'consonante' },
  octavaReal: { label: 'Octava real', verseCount: 8, syllablePattern: '11', stressPatterns: { 11: '6-10' }, rhymeScheme: 'ABABABCC', rhymeMode: 'consonante' },
  octavilla: { label: 'Octavilla', verseCount: 8, syllablePattern: '8', stressPatterns: { 8: '3-7' }, rhymeMode: 'consonante' },
  decima: { label: 'Décima o espinela', verseCount: 10, syllablePattern: '8', stressPatterns: { 8: '3-7' }, rhymeScheme: 'abbaaccddc', rhymeMode: 'consonante' },
  soneto: { label: 'Soneto', verseCount: 14, syllablePattern: '11', stressPatterns: { 11: '6-10' }, rhymeScheme: 'ABBA ABBA CDC DCD', rhymeMode: 'consonante' },
  romance: { label: 'Romance', syllablePattern: '8', stressPatterns: { 8: '3-7' }, rhymeScheme: '-a', rhymeMode: 'asonante', repeatRhymeScheme: true },
  sextina: { label: 'Sextina', verseCount: 39, syllablePattern: '11', stressPatterns: { 11: '6-10' }, rhymeScheme: 'ABCDEF FAEBDC CFDABE ECBFAD DEACFB BDFECA AB DE CF', rhymeMode: 'sextina' },
  silva: { label: 'Silva', syllablePattern: '7 11', stressPatterns: { 7: '3-6', 11: '6-10' }, rhymeMode: 'consonante' },
  silvaArromanzada: { label: 'Silva arromanzada', syllablePattern: '7 11', stressPatterns: { 7: '3-6', 11: '6-10' }, rhymeScheme: '-a', rhymeMode: 'asonante', repeatRhymeScheme: true },
});

export function parseSyllablePattern(value) {
  return String(value ?? '')
    .trim()
    .split(/\s*-\s*/)
    .map((slot) => (slot.match(/\d+/g) ?? [])
      .map(Number)
      .filter((count) => Number.isInteger(count) && count > 0 && count <= 20))
    .filter((slot) => slot.length > 0);
}

export function getExpectedSyllableCounts(pattern, verseIndex) {
  const slots = parseSyllablePattern(pattern);
  if (!slots.length) return [];
  return [...new Set(slots[verseIndex % slots.length])];
}

export function matchesSyllablePattern(actualCount, pattern, verseIndex) {
  return getExpectedSyllableCounts(pattern, verseIndex).includes(Number(actualCount));
}

export function getRhymeSchemeArtRequirement(token) {
  const letter = String(token ?? '').match(/[A-Za-z]/)?.[0] ?? '';
  if (!letter) return '';
  return letter === letter.toLowerCase() ? 'minor' : 'major';
}

export function matchesRhymeSchemeArt(token, metricCount) {
  const requirement = getRhymeSchemeArtRequirement(token);
  if (!requirement) return true;
  const count = Number(metricCount);
  if (!Number.isFinite(count)) return false;
  return requirement === 'minor' ? count <= 8 : count > 8;
}