/* Article right-pane controller — tab switching + lazy local graph. */
(function () {
  const pane = document.getElementById('right-pane');
  if (!pane) return;

  const page = document.querySelector('.article-page');
  const slug = page?.getAttribute('data-slug');
  const tabs = pane.querySelectorAll('.pane-tab');
  const panels = pane.querySelectorAll('.pane-panel');
  const STORAGE_KEY = 'wipa-pane-tab';
  let graphLoaded = false;

  // Restore last tab (default: outline, or first available)
  let initial = null;
  try { initial = localStorage.getItem(STORAGE_KEY); } catch (e) {}
  const available = Array.from(tabs).map(t => t.dataset.tab);
  if (!available.includes(initial)) initial = available[0];
  if (initial) selectTab(initial);

  tabs.forEach(tab => {
    tab.addEventListener('click', () => selectTab(tab.dataset.tab));
  });

  function selectTab(name) {
    tabs.forEach(t => {
      const on = t.dataset.tab === name;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    panels.forEach(p => {
      const on = p.dataset.panel === name;
      if (on) p.removeAttribute('hidden'); else p.setAttribute('hidden', '');
    });
    try { localStorage.setItem(STORAGE_KEY, name); } catch (e) {}
    if (name === 'graph') renderGraph();
  }

  // ── Local graph ────────────────────────────────────────────────────────────
  async function renderGraph() {
    if (graphLoaded || !slug) return;
    graphLoaded = true;

    const host = document.getElementById('pane-graph');
    const legend = document.getElementById('pane-graph-legend');
    if (!host) return;

    try {
      const resp = await fetch('/api/local-graph/' + encodeURIComponent(slug));
      if (!resp.ok) throw new Error('graph ' + resp.status);
      const data = await resp.json();
      if (!window.d3) {
        host.innerHTML = '<div class="pane-graph-loading">D3 not loaded</div>';
        return;
      }
      draw(host, legend, data);
    } catch (e) {
      host.innerHTML = `<div class="pane-graph-loading">Could not load graph.</div>`;
      graphLoaded = false;
    }
  }

  function draw(host, legend, data) {
    host.innerHTML = '';
    const width = host.clientWidth || 260;
    const height = host.clientHeight || 260;

    const svg = d3.select(host).append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');
    const g = svg.append('g');

    // Pan/zoom
    svg.call(d3.zoom().scaleExtent([0.4, 4]).on('zoom', (ev) => g.attr('transform', ev.transform)));

    // Force sim
    const linkForce = d3.forceLink(data.links.map(l => ({...l}))).id(d => d.id).distance(48).strength(0.6);
    const nodes = data.nodes.map(n => ({...n}));
    const sim = d3.forceSimulation(nodes)
      .force('link', linkForce)
      .force('charge', d3.forceManyBody().strength(-120))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(16));

    const link = g.append('g').attr('class', 'pane-graph-edges')
      .selectAll('line').data(linkForce.links()).enter().append('line')
      .attr('class', 'pane-graph-edge').attr('stroke-width', 1);

    const nodeG = g.append('g').selectAll('g').data(nodes).enter().append('g')
      .style('cursor', 'pointer')
      .on('click', (_, d) => { if (!d.center) window.location.href = '/wiki/' + d.id; })
      .call(d3.drag()
        .on('start', (ev, d) => { if (!ev.active) sim.alphaTarget(0.25).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag',  (ev, d) => { d.fx = ev.x; d.fy = ev.y; })
        .on('end',   (ev, d) => { if (!ev.active) sim.alphaTarget(0); d.fx = null; d.fy = null; })
      );

    nodeG.append('circle')
      .attr('r', d => d.center ? 9 : 5)
      .attr('fill', d => d.color)
      .attr('class', d => d.center ? 'pane-graph-node-center' : '');

    nodeG.append('title').text(d => d.title);

    nodeG.append('text')
      .attr('class', 'pane-graph-node-label')
      .attr('dy', d => d.center ? -13 : -9)
      .attr('text-anchor', 'middle')
      .text(d => truncate(d.title, 16));

    sim.on('tick', () => {
      link
        .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      nodeG.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Legend
    if (legend) {
      const sections = Array.from(new Map(nodes.map(n => [n.section, n.color])).entries());
      legend.innerHTML = sections
        .map(([s, c]) => `<span><span class="pane-graph-legend-swatch" style="background:${c}"></span>${escapeHtml(s)}</span>`)
        .join('');
    }
  }

  function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  // ── Backlinks expand ───────────────────────────────────────────────────────
  pane.addEventListener('click', e => {
    const btn = e.target.closest('.backlinks-more');
    if (!btn) return;
    const extra = btn.nextElementSibling;
    if (!extra || !extra.classList.contains('backlinks-extra')) return;
    extra.removeAttribute('hidden');
    btn.remove();
  });
  pane.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      const btn = e.target.closest('.backlinks-more');
      if (btn) btn.click();
    }
  });
})();
