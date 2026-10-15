/* Runs before first paint so the page never flashes the wrong theme. */
(function () {
  try {
    var root = document.documentElement;
    var theme = JSON.parse(localStorage.getItem('theme') || '"system"');
    var dark = theme === 'dark' || (theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    root.dataset.theme = dark ? 'dark' : 'light';
    if (JSON.parse(localStorage.getItem('sidebarCollapsed') || 'false')) root.classList.add('sidebar-collapsed');
  } catch (e) { /* storage unavailable: keep defaults */ }
})();
