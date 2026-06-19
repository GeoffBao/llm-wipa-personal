/* Vertical workspace tabs — session-persisted navigation without losing context. */
(function () {
  const STORAGE_KEY = 'wipa-tabs';
  const ACTIVE_KEY = 'wipa-active-tab';
  const MAX_TABS = 12;
  /** Routes that need full page load (inline scripts / special layouts). */
  const FULL_PAGE_PREFIXES = ['/chat', '/graph', '/flipbook', '/excalidraw/new'];

  function needsFullPage(url) {
    const path = url.split('?')[0];
    return FULL_PAGE_PREFIXES.some(p => path === p || path.startsWith(p + '/'));
  }

  function loadTabs() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveTabs(tabs) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs.slice(-MAX_TABS)));
    } catch (_) {}
  }

  function tabTitleFromPath(path) {
    const clean = path.split('?')[0];
    if (clean === '/' || clean === '') return 'Home';
    if (clean.startsWith('/wiki/')) return decodeURIComponent(clean.slice(6)).replace(/-/g, ' ');
    if (path.startsWith('/chat')) return 'Chat';
    if (path.startsWith('/graph')) return 'Graph';
    if (path.startsWith('/books')) return 'Books';
    if (path.startsWith('/search')) return 'Search';
    const seg = path.split('/').filter(Boolean).pop() || 'Page';
    return decodeURIComponent(seg).replace(/-/g, ' ');
  }

  function ensureCurrentTab() {
    const path = window.location.pathname + window.location.search;
    let tabs = loadTabs();
    const existing = tabs.find(t => t.url === path);
    if (!existing) {
      tabs.push({ id: Date.now().toString(36), url: path, title: tabTitleFromPath(path) });
      saveTabs(tabs);
    }
    try { localStorage.setItem(ACTIVE_KEY, path); } catch (_) {}
    return tabs;
  }

  function renderTabs() {
    const container = document.getElementById('workspace-tabs');
    if (!container) return;

    const tabs = ensureCurrentTab();
    const activePath = window.location.pathname + window.location.search;

    container.innerHTML = tabs.map(t => {
      const active = t.url === activePath ? ' active' : '';
      const title = t.title || tabTitleFromPath(t.url);
      return `<button type="button" class="workspace-tab${active}" data-url="${escapeAttr(t.url)}" role="tab" aria-selected="${active ? 'true' : 'false'}">
        <span class="workspace-tab-title">${escapeHtml(title)}</span>
        <span class="workspace-tab-close" data-close="${escapeAttr(t.url)}" aria-label="Close tab">&times;</span>
      </button>`;
    }).join('');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
  }

  let currentContentUrl = window.location.pathname + window.location.search;

  async function navigateTab(url, pushState) {
    if (url === currentContentUrl) return;

    if (needsFullPage(url)) {
      window.location.href = url;
      return;
    }

    try {
      const resp = await fetch(url, { headers: { 'X-Requested-With': 'WIPA-SPA' } });
      const html = await resp.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const newMain = doc.querySelector('.main-content');
      const main = document.getElementById('main-content');
      if (newMain && main) {
        main.innerHTML = newMain.innerHTML;
        const newTitle = doc.querySelector('title')?.textContent;
        if (newTitle) document.title = newTitle;
        if (pushState !== false) history.pushState({ wipaTab: url }, '', url);
        currentContentUrl = url;
        try { localStorage.setItem(ACTIVE_KEY, url); } catch (_) {}
        renderTabs();
        window.dispatchEvent(new CustomEvent('wipa:navigate', { detail: { url } }));
        // Re-run mermaid if present
        if (window.mermaid) {
          const theme = document.documentElement.getAttribute('data-theme');
          const dark = theme === 'dark' || theme === 'surf-dark';
          mermaid.initialize({ startOnLoad: false, theme: dark ? 'dark' : 'default', securityLevel: 'loose' });
          const nodes = main.querySelectorAll('.mermaid');
          if (nodes.length) await mermaid.run({ nodes: [...nodes] });
        }
        return;
      }
    } catch (_) {}

    window.location.href = url;
  }

  function closeTab(url) {
    let tabs = loadTabs().filter(t => t.url !== url);
    if (!tabs.length) tabs = [{ id: 'home', url: '/', title: 'Home' }];
    saveTabs(tabs);
    const activePath = window.location.pathname + window.location.search;
    if (url === activePath) {
      const last = tabs[tabs.length - 1];
      if (last.url === activePath) renderTabs();
      else navigateTab(last.url);
    } else {
      renderTabs();
    }
  }

  function bindEvents() {
    const container = document.getElementById('workspace-tabs');
    if (!container) return;

    container.addEventListener('click', (e) => {
      const closeEl = e.target.closest('.workspace-tab-close');
      if (closeEl) {
        e.stopPropagation();
        closeTab(closeEl.dataset.close);
        return;
      }
      const tab = e.target.closest('.workspace-tab');
      if (tab?.dataset.url) navigateTab(tab.dataset.url);
    });

    document.getElementById('workspace-new-tab')?.addEventListener('click', () => {
      window.__openPalette?.();
    });

    // Intercept same-origin nav links for SPA-style tab loads
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (!a || a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto:')) return;
      if (a.closest('.notebook-scribble-btn') || a.closest('.notebook-card')) return;
      e.preventDefault();
      // Resolve against the current URL and keep the query string, so e.g.
      // "?src=kb" on /books → "/books?src=kb" (not "/" via origin + pathname-only).
      const resolved = new URL(href, window.location.href);
      const url = resolved.pathname + resolved.search;
      let tabs = loadTabs();
      if (!tabs.find(t => t.url === url)) {
        tabs.push({ id: Date.now().toString(36), url, title: a.textContent?.trim() || tabTitleFromPath(url) });
        saveTabs(tabs);
      }
      navigateTab(url);
    });

    window.addEventListener('popstate', () => {
      const url = history.state?.wipaTab ?? (window.location.pathname + window.location.search);
      navigateTab(url, false);
    });
  }

  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
  document.addEventListener('keydown', (e) => {
    if (isMac ? e.metaKey : e.ctrlKey) {
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        window.__openPalette?.();
      } else if (e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        closeTab(window.location.pathname + window.location.search);
      }
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname + window.location.search;
    currentContentUrl = path;
    if (!history.state?.wipaTab) {
      history.replaceState({ wipaTab: path }, '', path);
    }
    renderTabs();
    bindEvents();
  });

  window.__wipaTabs = { renderTabs, navigateTab, closeTab, loadTabs };

  if (window.llmKbDesktop?.onShortcut) {
    window.llmKbDesktop.onShortcut((action) => {
      if (action === 'new-tab') window.__openPalette?.();
      if (action === 'close-tab') closeTab(window.location.pathname + window.location.search);
    });
  }
})();
