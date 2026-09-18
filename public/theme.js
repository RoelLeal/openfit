// Applies the theme and accent cached by the app (src/state/app.svelte.ts) before the first paint.
try {
  var theme = localStorage.getItem('openfit:theme');
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
  var accent = localStorage.getItem('openfit:accent');
  if (accent && /^[a-z]+$/.test(accent)) document.documentElement.dataset.accent = accent;
} catch {
  // Storage unavailable: the system theme and the default accent are used.
}
