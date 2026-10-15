(() => {
  const key = 'mesa.colorTheme';
  const root = document.documentElement;
  const system = window.matchMedia?.('(prefers-color-scheme: dark)');
  let explicitPreference = false;
  try { explicitPreference = ['light', 'dark'].includes(localStorage.getItem(key)); } catch {}
  const moon = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M20 14a8 8 0 0 1-10-10 8.5 8.5 0 1 0 10 10Z"/></svg>';
  const sun = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>';
  let transitionFrame;
  function apply(theme) {
    if (!['light', 'dark'].includes(theme)) return;
    if (root.dataset.theme !== theme) {
      cancelAnimationFrame(transitionFrame);
      root.classList.add('theme-switching');
    }
    root.dataset.theme = theme;
    const dark = theme === 'dark';
    for (const button of document.querySelectorAll('[data-theme-toggle]')) {
      button.innerHTML = `${dark ? sun : moon}<span>${dark ? 'Modo claro' : 'Modo oscuro'}</span>`;
      button.setAttribute('aria-pressed', String(dark));
      button.setAttribute('aria-label', dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
      button.title = dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#100F0F' : '#E6E4D9');
    const editor = document.querySelector('#workshop-editor')?.contentWindow;
    if (typeof editor?.setMesaTheme === 'function') editor.setMesaTheme(theme);
    else editor?.postMessage({type:'workshop:appearance',theme},location.origin);
    if (root.classList.contains('theme-switching')) {
      // Commit both documents in the same task; restore hover transitions afterward.
      void root.offsetHeight;
      transitionFrame = requestAnimationFrame(() => {
        transitionFrame = requestAnimationFrame(() => root.classList.remove('theme-switching'));
      });
    }
  }
  window.setMesaTheme = apply;
  for (const button of document.querySelectorAll('[data-theme-toggle]')) {
    button.addEventListener('click', () => {
      const theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
      explicitPreference = true;
      try { localStorage.setItem(key, theme); } catch {}
      apply(theme);
    });
  }
  system?.addEventListener('change', event => {
    if (!explicitPreference) apply(event.matches ? 'dark' : 'light');
  });
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    const theme = event.key === null ? null : event.newValue;
    explicitPreference = ['light', 'dark'].includes(theme);
    apply(explicitPreference ? theme : system?.matches ? 'dark' : 'light');
  });
  apply(root.dataset.theme === 'dark' ? 'dark' : 'light');
})();
