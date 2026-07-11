import { Router } from 'express';
import { getFile } from '../vault/loader.js';
import { getBacklinks } from '../vault/backlinks.js';

const router = Router();

/** Minimal local graph for split-pane iframe embed */
router.get('/embed/local-graph/:slug', async (req, res) => {
  const file = getFile(req.params.slug);
  if (!file) return res.status(404).send('Not found');

  const backlinks = getBacklinks(file.title);
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Local Graph — ${escapeHtml(file.title)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #c8e3ff; font-family: Inter, -apple-system, sans-serif; }
    #graph { width: 100%; height: 100%; }
    .embed-title { position: fixed; top: 8px; left: 10px; z-index: 2; font-size: 0.72rem; color: #5B6882; background: rgba(255,255,255,0.85); padding: 4px 8px; border-radius: 6px; }
  </style>
  <script src="/public/vendor/d3.min.js"></script>
</head>
<body>
  <div class="embed-title">${escapeHtml(file.title)} — local graph</div>
  <svg id="graph"></svg>
  <script>
    fetch('/api/local-graph/${encodeURIComponent(req.params.slug)}')
      .then(r => r.json())
      .then(data => {
        const w = window.innerWidth, h = window.innerHeight;
        const svg = d3.select('#graph').attr('width', w).attr('height', h);
        const g = svg.append('g');
        svg.call(d3.zoom().scaleExtent([0.2, 3]).on('zoom', e => g.attr('transform', e.transform)));
        const sim = d3.forceSimulation(data.nodes)
          .force('link', d3.forceLink(data.links).id(d => d.id).distance(80))
          .force('charge', d3.forceManyBody().strength(-200))
          .force('center', d3.forceCenter(w / 2, h / 2));
        const link = g.append('g').selectAll('line').data(data.links).join('line').attr('stroke', '#94A3B8').attr('stroke-opacity', 0.5);
        const node = g.append('g').selectAll('circle').data(data.nodes).join('circle')
          .attr('r', d => d.id === '${escapeJs(req.params.slug)}' ? 10 : 6)
          .attr('fill', d => d.color || '#6D82FF')
          .style('cursor', 'pointer')
          .on('click', (_, d) => { if (d.id) window.parent.postMessage({ type: 'wipa-navigate', url: '/wiki/' + d.id }, '*'); });
        const label = g.append('g').selectAll('text').data(data.nodes).join('text')
          .text(d => d.title?.slice(0, 20) || d.id)
          .attr('font-size', 9).attr('fill', '#333').attr('dx', 10).attr('dy', 3);
        sim.on('tick', () => {
          link.attr('x1', d => d.source.x).attr('y1', d => d.source.y).attr('x2', d => d.target.x).attr('y2', d => d.target.y);
          node.attr('cx', d => d.x).attr('cy', d => d.y);
          label.attr('x', d => d.x).attr('y', d => d.y);
        });
      });
  </script>
</body>
</html>`;
  res.type('html').send(html);
});

/** Compatibility redirect for old split-pane callers. */
router.get('/embed/chat', async (req, res) => {
  const q = req.query.q ? String(req.query.q) : '';
  res.redirect(`/agent${q ? '?q=' + encodeURIComponent(q) : ''}`);
});

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeJs(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export default router;
