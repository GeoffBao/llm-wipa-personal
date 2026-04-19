// Highlight the current TOC entry based on scroll position
(function () {
  const toc = document.getElementById('toc');
  if (!toc) return;

  const headings = Array.from(document.querySelectorAll('.article-body h2, .article-body h3, .article-body h4'));
  const tocLinks = Array.from(toc.querySelectorAll('a'));
  if (!headings.length || !tocLinks.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        tocLinks.forEach(link => {
          link.classList.toggle('toc-active', link.getAttribute('href') === `#${id}`);
        });
      }
    });
  }, { rootMargin: '-56px 0px -60% 0px', threshold: 0 });

  headings.forEach(h => observer.observe(h));
})();
