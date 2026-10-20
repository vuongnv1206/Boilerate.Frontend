(function () {
  var mode = 'system';
  try {
    var stored = localStorage.getItem('boilerate.ui.theme');
    if (stored === 'light' || stored === 'dark' || stored === 'system') mode = stored;
  } catch (_) {
    /* Appearance still works when browser storage is unavailable. */
  }
  var dark =
    mode === 'dark' ||
    (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  var root = document.documentElement;
  root.dataset.theme = dark ? 'dark' : 'light';
  root.classList.toggle('app-dark', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
})();
