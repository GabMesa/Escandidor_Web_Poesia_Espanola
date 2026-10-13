// Run before stylesheets so a saved dark preference never flashes a light page.
(() => {
  let preference = null;
  try { preference = localStorage.getItem('mesa.colorTheme'); } catch {}
  const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  document.documentElement.dataset.theme = preference === 'light' || preference === 'dark'
    ? preference : systemDark ? 'dark' : 'light';
})();
