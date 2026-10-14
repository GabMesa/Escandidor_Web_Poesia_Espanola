// Optional remote fonts must not hold up the editor or the Workshop bridge.
const editorFontSheet = document.getElementById('editorFontSheet');
editorFontSheet?.addEventListener('load', () => {
  editorFontSheet.rel = 'stylesheet';
  editorFontSheet.removeAttribute('as');
}, { once: true });
