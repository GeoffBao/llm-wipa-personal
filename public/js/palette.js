/* Command palette — ⌘K / Ctrl+K.
   Fuzzy switcher over vault notes + built-in commands. */
(function () {
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
  const modKey = isMac ? 'metaKey' : 'ctrlKey';

  const ICONS = {
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>',
    note:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    cmd:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/></svg>',
    graph:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',
    dice:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.2"/><circle cx="16" cy="16" r="1.2"/><circle cx="16" cy="8" r="1.2"/><circle cx="8" cy="16" r="1.2"/></svg>',
    moon:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    book:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 0 3-3h7z"/></svg>',
    canvas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>',
  };

  const COMMANDS = [
    { id: 'go-home',       title: 'Go to Home',               icon: 'cmd',    action: () => nav('/') },
    { id: 'go-graph',      title: 'Open Knowledge Graph',     icon: 'graph',  action: () => nav('/graph') },
    { id: 'go-canvas',     title: 'Open Canvas Diagrams',     icon: 'canvas', action: () => nav('/diagrams') },
    { id: 'go-excalidraw', title: 'Open Excalidraw',          icon: 'canvas', action: () => nav('/excalidraw') },
    { id: 'go-readwise',   title: 'Open Readwise Dashboard',  icon: 'book',   action: () => nav('/readwise') },
    { id: 'go-readwise-chat', title: 'Open Readwise Chat', icon: 'book', action: () => nav('/readwise/chat') },
    { id: 'go-books',      title: 'Open Books',               icon: 'book',   action: () => nav('/books') },
    { id: 'go-concepts',   title: 'Browse Concepts',          icon: 'note',   action: () => nav('/browse/concepts') },
    { id: 'go-sources',    title: 'Browse Sources',           icon: 'note',   action: () => nav('/browse/sources') },
    { id: 'random',        title: 'Random Concept',           icon: 'dice',   action: async () => {
        const r = await fetch('/api/random').then(r => r.json()).catch(() => null);
        if (r && r.slug) nav('/wiki/' + r.slug);
    }},
    { id: 'toggle-theme',  title: 'Toggle Dark / Light Mode', icon: 'moon',   action: () => window.__toggleTheme?.() },
  ];

  function nav(href) { window.location.href = href; }

  let root, input, list, backdrop;
  let items = [];
  let active = 0;
  let lastQuery = '';
  let searchAbort = null;

  function open() {
    if (!root) return;
    backdrop.setAttribute('data-open', 'true');
    input.value = '';
    lastQuery = '';
    render([]);
    // Default view: show commands
    setTimeout(() => input.focus(), 20);
  }
  function close() {
    if (!root) return;
    backdrop.setAttribute('data-open', 'false');
  }
  function isOpen() { return backdrop?.getAttribute('data-open') === 'true'; }

  function render(results) {
    const q = input.value.trim();
    const matchingCmds = filterCommands(q);
    items = [];
    let html = '';

    if (matchingCmds.length) {
      html += `<div class="cmdp-group-label">Commands</div>`;
      matchingCmds.forEach(c => {
        items.push({ type: 'cmd', cmd: c });
        html += itemHtml({ title: c.title, icon: c.icon, tag: null });
      });
    }

    if (results.length) {
      html += `<div class="cmdp-group-label">Notes</div>`;
      results.forEach(r => {
        items.push({ type: 'note', slug: r.slug });
        html += itemHtml({ title: r.title, icon: 'note', tag: r.section });
      });
    }

    if (!items.length) {
      html = `<div class="cmdp-empty">${q ? 'No matches.' : 'Type to search notes or pick a command.'}</div>`;
    }

    list.innerHTML = html;
    active = 0;
    updateActive();
  }

  function itemHtml({ title, icon, tag }) {
    const ico = ICONS[icon] || ICONS.note;
    const tagHtml = tag ? `<span class="cmdp-item-tag">${escapeHtml(tag)}</span>` : '';
    return `<div class="cmdp-item" data-active="false">
      <span class="cmdp-item-icon">${ico}</span>
      <span class="cmdp-item-title">${escapeHtml(title)}</span>
      ${tagHtml}
    </div>`;
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function updateActive() {
    const nodes = list.querySelectorAll('.cmdp-item');
    nodes.forEach((n, i) => n.setAttribute('data-active', i === active ? 'true' : 'false'));
    const el = nodes[active];
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  function filterCommands(q) {
    if (!q) return COMMANDS;
    const ql = q.toLowerCase();
    return COMMANDS.filter(c => c.title.toLowerCase().includes(ql));
  }

  async function handleInput() {
    const q = input.value.trim();
    lastQuery = q;
    if (!q) { render([]); return; }

    if (searchAbort) searchAbort.abort();
    searchAbort = new AbortController();
    try {
      const resp = await fetch('/api/search?q=' + encodeURIComponent(q), { signal: searchAbort.signal });
      const data = await resp.json();
      if (q !== lastQuery) return;
      render(Array.isArray(data) ? data.slice(0, 8) : []);
    } catch (e) {
      if (e.name !== 'AbortError') render([]);
    }
  }

  function activateCurrent() {
    const it = items[active];
    if (!it) return;
    if (it.type === 'cmd') { close(); it.cmd.action(); }
    else if (it.type === 'note') { close(); nav('/wiki/' + it.slug); }
  }

  function build() {
    root = document.createElement('div');
    root.innerHTML = `
      <div class="cmdp-backdrop" data-open="false" role="dialog" aria-modal="true" aria-label="Command palette">
        <div class="cmdp" role="combobox" aria-expanded="true">
          <div class="cmdp-input-wrap">
            <span class="cmdp-input-icon">${ICONS.search}</span>
            <input class="cmdp-input" type="text" placeholder="Search notes or run a command…" autocomplete="off" spellcheck="false" aria-label="Command palette input">
            <span class="cmdp-hint">ESC</span>
          </div>
          <div class="cmdp-list" role="listbox"></div>
          <div class="cmdp-footer">
            <span class="cmdp-footer-left"><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
            <span class="cmdp-footer-right"><kbd>↵</kbd> open · <kbd>${isMac ? '⌘' : 'Ctrl'}</kbd><kbd>K</kbd> toggle</span>
          </div>
        </div>
      </div>`;
    document.body.appendChild(root.firstElementChild);
    backdrop = document.querySelector('.cmdp-backdrop');
    input = backdrop.querySelector('.cmdp-input');
    list = backdrop.querySelector('.cmdp-list');

    input.addEventListener('input', handleInput);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); if (items.length) { active = (active + 1) % items.length; updateActive(); } }
      else if (e.key === 'ArrowUp')   { e.preventDefault(); if (items.length) { active = (active - 1 + items.length) % items.length; updateActive(); } }
      else if (e.key === 'Enter')     { e.preventDefault(); activateCurrent(); }
    });
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
    list.addEventListener('click', (e) => {
      const el = e.target.closest('.cmdp-item');
      if (!el) return;
      active = Array.from(list.querySelectorAll('.cmdp-item')).indexOf(el);
      activateCurrent();
    });
  }

  document.addEventListener('keydown', (e) => {
    // ⌘K / Ctrl+K toggles palette
    if (e[modKey] && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      if (!root) build();
      isOpen() ? close() : open();
      return;
    }
    // "/" focuses palette if not in an input
    if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) {
      e.preventDefault();
      if (!root) build();
      if (!isOpen()) open();
    }
  });

  // Expose a manual opener for a button trigger if ever needed
  window.__openPalette = () => { if (!root) build(); open(); };
})();
