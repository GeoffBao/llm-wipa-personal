// Mobile sidebar toggle
(function () {
  const btn = document.getElementById('mobile-menu-btn');
  const sidebar = document.getElementById('sidebar');
  if (!btn || !sidebar) return;

  btn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });

  // Close sidebar when clicking a link
  sidebar.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => sidebar.classList.remove('open'));
  });

  // Close on overlay click
  document.addEventListener('click', (e) => {
    if (!sidebar.contains(e.target) && !btn.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  });
})();
