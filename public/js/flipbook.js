// Vault-grounded Flipbook client.
// Renders deterministic SVG frames from vault data. AI/image providers are not
// part of the blocking UI path; every label and hotspot is generated locally.

(() => {
  const root = document.querySelector('.flipbook-page');
  if (!root) return;

  const slug = root.dataset.slug;

  const els = {
    svg: document.getElementById('flipbook-svg'),
    frame: document.getElementById('flipbook-frame'),
    loading: document.getElementById('flipbook-loading'),
    loadingText: document.getElementById('flipbook-loading-text'),
    error: document.getElementById('flipbook-error'),
    errorMsg: document.getElementById('flipbook-error-msg'),
    errorRetry: document.getElementById('flipbook-error-retry'),
    title: document.getElementById('flipbook-title'),
    backBtn: document.getElementById('flipbook-back-btn'),
    debugBtn: document.getElementById('flipbook-debug-btn'),
  };

  const state = {
    current: null,    // frame JSON
    history: [],      // stack of previous frames (most recent last)
    isLoading: false,
    debug: false,
  };

  function setLoading(text) {
    state.isLoading = true;
    els.error.hidden = true;
    els.loading.style.display = 'flex';
    els.loadingText.textContent = text || 'Building visual frame…';
  }

  function clearLoading() {
    state.isLoading = false;
    els.loading.style.display = 'none';
  }

  function showError(msg) {
    state.isLoading = false;
    els.loading.style.display = 'none';
    els.error.hidden = false;
    els.errorMsg.textContent = msg;
  }

  async function paint(frame) {
    state.current = frame;
    els.title.textContent = frame.title || frame.key;
    renderSvg(frame);
    clearLoading();
    els.backBtn.disabled = state.history.length === 0;
  }

  function renderSvg(frame) {
    const svg = els.svg;
    svg.innerHTML = '';
    const ns = 'http://www.w3.org/2000/svg';

    const defs = el(ns, 'defs');
    const marker = el(ns, 'marker', {
      id: 'fb-arrow',
      markerWidth: '10',
      markerHeight: '10',
      refX: '8',
      refY: '3',
      orient: 'auto',
      markerUnits: 'strokeWidth',
    });
    marker.appendChild(el(ns, 'path', { d: 'M0,0 L0,6 L9,3 z', fill: 'rgba(107,95,80,.45)' }));
    defs.appendChild(marker);
    svg.appendChild(defs);

    const nodeById = new Map((frame.nodes || []).map(n => [n.id, n]));
    for (const edge of frame.edges || []) {
      const a = nodeById.get(edge.source);
      const b = nodeById.get(edge.target);
      if (!a || !b) continue;
      svg.appendChild(el(ns, 'path', {
        class: 'fb-edge fb-edge-muted',
        d: bezierBetween(a, b),
      }));
    }

    for (const node of frame.nodes || []) {
      const group = el(ns, 'g', {
        class: `fb-card ${node.role === 'center' ? 'fb-card-center' : 'fb-card-open'}`,
        tabindex: '0',
        role: 'button',
        'aria-label': node.slug ? `Open ${node.title}` : `Explore ${node.title}`,
      });
      group.appendChild(el(ns, 'rect', {
        class: 'fb-card-rect',
        x: node.x,
        y: node.y,
        width: node.w,
        height: node.h,
        rx: node.role === 'center' ? 28 : 18,
      }));

      if (node.role !== 'center') {
        group.appendChild(el(ns, 'circle', {
          class: 'fb-node-index',
          cx: node.x + 30,
          cy: node.y + 28,
          r: 14,
        }));
        group.appendChild(textEl(ns, node.id.replace('n', ''), node.x + 30, node.y + 33, 'fb-node-index-text', 'middle'));
      }

      const isCenter = node.role === 'center';
      const titleX = node.x + (isCenter ? node.w / 2 : 58);
      const titleY = node.y + (isCenter ? 60 : 44);
      const titleLines = wrapText(node.title, isCenter ? 13.5 : 13, isCenter ? 2 : 2);
      for (const [i, line] of titleLines.entries()) {
        group.appendChild(textEl(
          ns,
          line,
          titleX,
          titleY + i * (isCenter ? 34 : 24),
          'fb-title',
          isCenter ? 'middle' : 'start',
        ));
      }

      group.appendChild(textEl(
        ns,
        node.slug ? 'OPEN ARTICLE' : 'EXPLORE',
        node.x + (node.role === 'center' ? node.w / 2 : 58),
        node.y + node.h - 24,
        'fb-kicker',
        node.role === 'center' ? 'middle' : 'start',
      ));
      group.appendChild(textEl(
        ns,
        node.subtitle || '',
        node.x + node.w - 18,
        node.y + node.h - 24,
        'fb-subtitle',
        'end',
      ));

      group.addEventListener('click', e => {
        e.stopPropagation();
        if (node.slug) {
          window.location.href = '/wiki/' + node.slug;
        } else {
          exploreNode(node);
        }
      });
      group.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          group.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
      });
      svg.appendChild(group);
    }

    drawBreadcrumb(svg, frame);
  }

  async function generateRoot() {
    setLoading('Building visual frame…');
    try {
      const r = await fetch('/api/flipbook/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${r.status}`);
      }
      const frame = await r.json();
      state.history = [];
      await paint(frame);
    } catch (err) {
      showError(`Failed to build frame:\n${err.message}`);
    }
  }

  async function exploreNode(node) {
    if (!state.current || state.isLoading) return;
    setLoading(`Exploring "${node.title}"…`);
    try {
      const r = await fetch('/api/flipbook/explore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          parentKey: state.current.key,
          nodeId: node.id,
          x: node.x + node.w / 2,
          y: node.y + node.h / 2,
          viewportW: 1024,
          viewportH: 1024,
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${r.status}`);
      }
      const frame = await r.json();
      if (frame.redirect) { window.location.href = frame.redirect; return; }
      state.history.push(state.current);
      await paint(frame);
    } catch (err) {
      showError(`Failed to explore:\n${err.message}`);
    }
  }

  function goBack() {
    if (state.history.length === 0) return;
    const prev = state.history.pop();
    paint(prev);
  }

  // ── Wiring ─────────────────────────────────────────────────────────────────
  els.errorRetry.addEventListener('click', () => {
    if (state.current) paint(state.current); else generateRoot();
  });
  els.backBtn.addEventListener('click', goBack);
  els.debugBtn.addEventListener('click', () => {
    state.debug = !state.debug;
    root.classList.toggle('flipbook-debug', state.debug);
    els.debugBtn.classList.toggle('active', state.debug);
  });

  generateRoot();

  function drawBreadcrumb(svg, frame) {
    const ns = 'http://www.w3.org/2000/svg';
    const items = (frame.breadcrumb || []).map(b => b.title).filter(Boolean);
    if (items.length <= 1) return;
    svg.appendChild(textEl(ns, items.join('  /  '), 38, 982, 'fb-subtitle', 'start'));
  }

  function bezierBetween(a, b) {
    const ax = a.x + a.w / 2;
    const ay = a.y + a.h / 2;
    const bx = b.x + b.w / 2;
    const by = b.y + b.h / 2;
    const mx = (ax + bx) / 2;
    return `M${ax},${ay} C${mx},${ay} ${mx},${by} ${bx},${by}`;
  }

  function el(ns, tag, attrs = {}) {
    const node = document.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  }

  function textEl(ns, value, x, y, className, anchor) {
    const node = el(ns, 'text', { x, y, class: className, 'text-anchor': anchor });
    node.textContent = value;
    return node;
  }

  function wrapText(text, maxUnits, maxLines = 2) {
    const s = String(text || '').trim();
    if (visualWidth(s) <= maxUnits) return [s];
    const words = tokenizeForWrap(s, maxUnits);
    const lines = [];
    let cur = '';
    for (const word of words) {
      const glue = cur && !/^[,.;:!?，。；：！？)]/.test(word) ? ' ' : '';
      const next = cur ? `${cur}${glue}${word}` : word;
      if (visualWidth(next) > maxUnits && cur) {
        lines.push(cur);
        if (lines.length === maxLines) break;
        cur = word;
      } else {
        cur = next;
      }
    }
    if (cur && lines.length < maxLines) lines.push(cur);
    if (lines.length === maxLines && words.join('') !== lines.join('').replace(/\s+/g, '')) {
      lines[lines.length - 1] = ellipsize(lines[lines.length - 1], maxUnits);
    }
    return lines;
  }

  function tokenizeForWrap(text, maxUnits) {
    const raw = text.split(/\s+/).filter(Boolean);
    const tokens = [];
    for (const token of raw) {
      if (visualWidth(token) <= maxUnits) {
        tokens.push(token);
        continue;
      }
      let cur = '';
      for (const ch of Array.from(token)) {
        if (visualWidth(cur + ch) > maxUnits && cur) {
          tokens.push(cur);
          cur = ch;
        } else {
          cur += ch;
        }
      }
      if (cur) tokens.push(cur);
    }
    return tokens;
  }

  function ellipsize(text, maxUnits) {
    let out = '';
    for (const ch of Array.from(text)) {
      if (visualWidth(out + ch + '…') > maxUnits) break;
      out += ch;
    }
    return out ? `${out}…` : '…';
  }

  function visualWidth(text) {
    let n = 0;
    for (const ch of Array.from(String(text || ''))) {
      if (/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(ch)) n += 1.85;
      else if (/[A-Z0-9]/.test(ch)) n += 0.95;
      else if (/[a-z]/.test(ch)) n += 0.78;
      else if (/\s/.test(ch)) n += 0.45;
      else n += 0.7;
    }
    return n;
  }
})();
