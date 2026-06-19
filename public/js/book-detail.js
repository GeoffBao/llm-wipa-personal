/**
 * Book detail page interactivity — tabs, glossary search, and the full-screen
 * learning-page overlay.
 *
 * Loaded once from layout.html and built on document-level event delegation so
 * it keeps working after the workspace tab system swaps `.main-content` via
 * innerHTML (inline <script> tags in swapped content do NOT execute). The overlay
 * markup lives body-level in layout.html for correct position:fixed coverage.
 */
(function () {
  // ── Tab switching ──────────────────────────────────────────────────────────
  function switchTab(id, btn) {
    document.querySelectorAll('.bkd-tab-btn').forEach(function (b) { b.classList.remove('active'); });
    document.querySelectorAll('.bkd-panel').forEach(function (p) { p.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    var panel = document.getElementById('bkd-panel-' + id);
    if (panel) panel.classList.add('active');
  }

  // ── Glossary search ────────────────────────────────────────────────────────
  function filterGlossary(q) {
    var lower = (q || '').toLowerCase();
    document.querySelectorAll('.bkd-term').forEach(function (el) {
      el.style.display = (!lower || el.dataset.term.includes(lower)) ? '' : 'none';
    });
  }

  // ── Full-screen overlay ──────────────────────────────────────────────────────
  function hideOverlay() {
    var overlay = document.getElementById('book-overlay');
    var frame   = document.getElementById('book-overlay-frame');
    if (!overlay || overlay.hidden) return;
    overlay.classList.remove('book-overlay--visible');
    document.body.style.overflow = '';
    setTimeout(function () {
      overlay.hidden = true;
      if (frame) frame.src = '';
    }, 280);
  }

  function openOverlay(url, name) {
    var overlay = document.getElementById('book-overlay');
    var frame   = document.getElementById('book-overlay-frame');
    var extLink = document.getElementById('book-overlay-ext');
    var title   = document.getElementById('book-overlay-title');
    var loading = document.getElementById('book-overlay-loading');
    if (!overlay || !frame || !url) return;
    var wasHidden = overlay.hidden;
    if (loading) loading.hidden = false;
    frame.src = url;
    if (extLink) extLink.href = url;
    if (title) title.textContent = name || document.title.replace(' — LLM KB', '');
    overlay.hidden = false;
    requestAnimationFrame(function () { overlay.classList.add('book-overlay--visible'); });
    document.body.style.overflow = 'hidden';
    // Push a history entry so the browser / phone Back button closes the overlay
    // instead of navigating away from the book page.
    if (wasHidden) history.pushState({ bookOverlay: true }, '');
  }

  function closeOverlay() {
    var overlay = document.getElementById('book-overlay');
    if (!overlay || overlay.hidden) return;
    if (history.state && history.state.bookOverlay) history.back(); // popstate → hide
    else hideOverlay();
  }

  // ── WeRead links: weread:// only resolves with the app (mobile). On desktop,
  //    point them at the WeRead web search by title so the click isn't a dead end.
  function initWeReadLinks() {
    if (/Android|iPhone|iPad|iPod|HarmonyOS/i.test(navigator.userAgent)) return;
    document.querySelectorAll('.bkd-wr-link[data-wr-title]').forEach(function (a) {
      if (a.dataset.wrBound) return;
      var t = a.getAttribute('data-wr-title');
      if (!t) return;
      a.href = 'https://weread.qq.com/web/search/global?keyword=' + encodeURIComponent(t);
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = '在微信读书网页版查找 →';
      a.dataset.wrBound = '1';
    });
  }

  // ── Delegated events (survive main-content swaps) ─────────────────────────────
  document.addEventListener('click', function (e) {
    var tabBtn = e.target.closest('.bkd-tab-btn');
    if (tabBtn) { switchTab(tabBtn.dataset.tab, tabBtn); return; }
    var card = e.target.closest('.bkd-learn-card');
    if (card) { openOverlay(card.dataset.url, card.dataset.name); return; }
    if (e.target.closest('.book-overlay-back')) { closeOverlay(); return; }
  });

  document.addEventListener('input', function (e) {
    if (e.target.id === 'bkd-glossary-search') filterGlossary(e.target.value);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeOverlay();
  });

  // Back button (or closeOverlay's history.back()) → close the overlay.
  window.addEventListener('popstate', hideOverlay);

  // Hide the loading indicator once the learning page finishes loading.
  var frame = document.getElementById('book-overlay-frame');
  if (frame) frame.addEventListener('load', function () {
    if (!frame.src) return; // ignore the reset to '' on close
    var loading = document.getElementById('book-overlay-loading');
    if (loading) loading.hidden = true;
  });

  // Run once now and re-run after each SPA navigation.
  initWeReadLinks();
  window.addEventListener('wipa:navigate', initWeReadLinks);
})();
