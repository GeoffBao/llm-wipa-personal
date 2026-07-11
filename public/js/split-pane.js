/* Resizable split pane — article + graph/Agent side by side. */
(function () {
  const STORAGE_KEY = 'wipa-split-mode';
  const STORAGE_RATIO = 'wipa-split-ratio';

  function isArticlePage() {
    return !!document.querySelector('.article-page');
  }

  function getSlug() {
    return document.querySelector('.article-page')?.dataset?.slug || '';
  }

  function buildSplitUI() {
    const main = document.getElementById('main-content');
    if (!main || main.querySelector('.split-container')) return;

    const original = main.innerHTML;
    const ratio = parseFloat(localStorage.getItem(STORAGE_RATIO) || '0.55') || 0.55;

    main.innerHTML = `
      <div class="split-container single-pane" id="split-container">
        <div class="split-primary" id="split-primary">${original}</div>
        <div class="split-divider" id="split-divider" hidden aria-hidden="true"></div>
        <div class="split-secondary" id="split-secondary" hidden>
          <div class="split-toolbar" id="split-toolbar">
            <button type="button" class="split-toolbar-btn active" data-pane="graph">Local Graph</button>
            <button type="button" class="split-toolbar-btn" data-pane="agent">Reading Agent</button>
            <button type="button" class="split-toolbar-btn" data-pane="close" style="margin-left:auto">✕</button>
          </div>
          <iframe class="split-pane-frame" id="split-frame" title="Split pane"></iframe>
        </div>
      </div>`;

    applyRatio(ratio);
    bindSplitEvents();
    window.dispatchEvent(new Event('wipa:split-built'));

    if (localStorage.getItem(STORAGE_KEY) === 'open') {
      openSplit('graph');
    }
  }

  function applyRatio(ratio) {
    const primary = document.getElementById('split-primary');
    const secondary = document.getElementById('split-secondary');
    if (!primary || !secondary) return;
    primary.style.flex = `1 1 ${Math.round(ratio * 100)}%`;
    secondary.style.flex = `1 1 ${Math.round((1 - ratio) * 100)}%`;
  }

  function openSplit(pane) {
    const container = document.getElementById('split-container');
    const secondary = document.getElementById('split-secondary');
    const divider = document.getElementById('split-divider');
    const frame = document.getElementById('split-frame');
    if (!container || !secondary || !frame) return;

    container.classList.remove('single-pane');
    secondary.hidden = false;
    divider.hidden = false;

    const slug = getSlug();
    const title = document.querySelector('.article-title')?.textContent?.trim() || '';

    if (pane === 'agent') {
      frame.src = `/agent?slug=${encodeURIComponent(slug)}&q=${encodeURIComponent(title)}`;
    } else {
      frame.src = `/embed/local-graph/${encodeURIComponent(slug)}`;
    }

    document.querySelectorAll('.split-toolbar-btn[data-pane]').forEach(btn => {
      if (btn.dataset.pane === 'close') return;
      btn.classList.toggle('active', btn.dataset.pane === pane);
    });

    try { localStorage.setItem(STORAGE_KEY, 'open'); } catch (_) {}
  }

  function closeSplit() {
    const container = document.getElementById('split-container');
    const secondary = document.getElementById('split-secondary');
    const divider = document.getElementById('split-divider');
    const frame = document.getElementById('split-frame');
    if (!container) return;

    container.classList.add('single-pane');
    if (secondary) secondary.hidden = true;
    if (divider) divider.hidden = true;
    if (frame) frame.src = 'about:blank';
    try { localStorage.setItem(STORAGE_KEY, 'closed'); } catch (_) {}
  }

  function bindSplitEvents() {
    document.getElementById('split-toolbar')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.split-toolbar-btn');
      if (!btn) return;
      const pane = btn.dataset.pane;
      if (pane === 'close') closeSplit();
      else if (pane) openSplit(pane);
    });

    const divider = document.getElementById('split-divider');
    if (!divider) return;

    let dragging = false;
    divider.addEventListener('mousedown', (e) => {
      dragging = true;
      divider.classList.add('dragging');
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const container = document.getElementById('split-container');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const ratio = Math.min(0.75, Math.max(0.25, (e.clientX - rect.left) / rect.width));
      applyRatio(ratio);
      try { localStorage.setItem(STORAGE_RATIO, String(ratio)); } catch (_) {}
    });

    document.addEventListener('mouseup', () => {
      if (dragging) {
        dragging = false;
        divider.classList.remove('dragging');
      }
    });
  }

  function injectSplitButton() {
    const meta = document.querySelector('.article-subtitle-meta');
    if (!meta || meta.querySelector('.split-open-btn')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'article-flipbook-btn split-open-btn';
    btn.title = 'Split view (graph or chat)';
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" width="13" height="13"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/></svg> Split`;
    btn.addEventListener('click', () => {
      if (!document.getElementById('split-container')) buildSplitUI();
      openSplit('graph');
    });
    meta.appendChild(btn);
  }

  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
  document.addEventListener('keydown', (e) => {
    if (!isArticlePage()) return;
    if ((isMac ? e.metaKey && e.altKey : e.ctrlKey && e.altKey)) {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        document.getElementById('split-secondary')?.querySelector('iframe')?.contentWindow?.focus();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        document.getElementById('split-primary')?.focus();
      }
    }
  });

  function init() {
    if (!isArticlePage()) return;
    buildSplitUI();
    injectSplitButton();
  }

  document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('wipa:navigate', () => {
    setTimeout(init, 50);
  });
  window.addEventListener('message', (e) => {
    if (e.data?.type === 'wipa-navigate' && e.data.url) {
      window.__wipaTabs?.navigateTab(e.data.url);
    }
  });
})();
