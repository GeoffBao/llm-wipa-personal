import { Router } from 'express';
import { readFile } from 'fs/promises';
import { getAllVisualizations, getVisualization } from '../vault/visualizations.js';
import { render } from '../render/template.js';

const router = Router();

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Gallery ────────────────────────────────────────────────────────────────
router.get('/visualizations', async (req, res) => {
  const items = getAllVisualizations();

  const cardsHtml = items.map(v => `
    <div class="browse-card viz-card" data-title="${esc(v.title)}" data-date="${v.date}">
      <a href="/visualizations/${v.slug}" class="viz-card-thumb">
        <iframe src="/visualizations/${v.slug}/raw" title="${esc(v.title)}" tabindex="-1"
          sandbox="allow-scripts allow-same-origin" scrolling="no" loading="lazy"></iframe>
        <span class="viz-card-overlay"></span>
      </a>
      <a href="/visualizations/${v.slug}" class="browse-card-title">${esc(v.title)}</a>
      <div class="browse-card-meta">
        <span class="browse-card-date">${v.date}</span>
        <span class="browse-card-date">· ${fmtSize(v.size)}</span>
      </div>
    </div>`).join('');

  const body = items.length
    ? `<div class="viz-gallery">${cardsHtml}</div>`
    : `<p class="empty-hint">还没有可视化文件。把每天和 AI 生成的 HTML 放到 vault 的 <code>Visualizations/</code> 目录即可在此显示。</p>`;

  res.send(await render('browse.html', {
    pageTitle: 'Visualizations — LLM KB',
    sectionLabel: 'Visualizations',
    section: 'visualizations',
    count: items.length,
    items: body,
    containerClass: 'browse-list',
    breadcrumb: `<a href="/">Home</a> › Visualizations`,
    activeNav: 'visualizations',
  }));
});

// ── Raw HTML (served into iframes) ──────────────────────────────────────────
router.get('/visualizations/:slug/raw', async (req, res) => {
  const v = getVisualization(req.params.slug);
  if (!v) return res.status(404).send('Not found');
  try {
    const html = await readFile(v.filepath, 'utf8');
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'no-cache');
    res.send(html);
  } catch {
    res.status(404).send('Not found');
  }
});

// ── Viewer ──────────────────────────────────────────────────────────────────
router.get('/visualizations/:slug', async (req, res) => {
  const v = getVisualization(req.params.slug);
  if (!v) return res.status(404).send('Visualization not found');

  res.send(await render('visualization.html', {
    pageTitle: `${v.title} — LLM KB`,
    title: v.title,
    slug: v.slug,
    date: v.date,
    size: fmtSize(v.size),
    breadcrumb: `<a href="/">Home</a> › <a href="/visualizations">Visualizations</a> › ${esc(v.title)}`,
    activeNav: 'visualizations',
  }));
});

export default router;
