// Optional remote fonts must not hold up the editor or the Workshop bridge.
const editorFontSheet = document.getElementById('editorFontSheet');
editorFontSheet?.addEventListener('load', () => {
  editorFontSheet.rel = 'stylesheet';
  editorFontSheet.removeAttribute('as');
}, { once: true });

// Fetch a font's stylesheet only when the poem actually uses that family.
const poemFontFamilies = {
  alegreya: 'Alegreya:wght@400;700',
  lora: 'Lora:wght@400;600;700',
  cormorant: 'Cormorant+Garamond:wght@400;600;700',
  'eb-garamond': 'EB+Garamond:wght@400;600;700',
  playfair: 'Playfair+Display:wght@400;600;700',
  'libre-baskerville': 'Libre+Baskerville:wght@400;700',
  merriweather: 'Merriweather:wght@400;700',
  montserrat: 'Montserrat:wght@400;600;700',
  nunito: 'Nunito:wght@400;600;700',
  'source-sans': 'Source+Sans+3:wght@400;600;700',
  lexend: 'Lexend:wght@400;600;700',
  josefin: 'Josefin+Sans:wght@400;600;700',
  cinzel: 'Cinzel:wght@400;600;700',
  'bebas-neue': 'Bebas+Neue',
  caveat: 'Caveat:wght@400;700',
  pacifico: 'Pacifico',
  'permanent-marker': 'Permanent+Marker',
  bungee: 'Bungee',
  unifraktur: 'UnifrakturCook:wght@700'
};
const loadedPoemFonts = new Set();
window.addEventListener('escandidor:poem-font', ({ detail: font }) => {
  const family = poemFontFamilies[font];
  if (!family || loadedPoemFonts.has(font)) return;
  const sheet = document.createElement('link');
  sheet.rel = 'stylesheet';
  sheet.href = `https://fonts.googleapis.com/css2?family=${family}&display=swap`;
  sheet.addEventListener('error', () => { loadedPoemFonts.delete(font); sheet.remove(); }, { once: true });
  loadedPoemFonts.add(font);
  document.head.append(sheet);
});
