import { Router } from 'express';
import { getFilesBySection, getFilesByTag } from '../vault/loader.js';
import { render } from '../render/template.js';
import { SECTION_LABELS } from '../../config.js';

const router = Router();

// IMPORTANT: specific route must come before /:section wildcard
router.get('/browse/tags/:tag', async (req, res) => {
  const { tag } = req.params;
  const files = getFilesByTag(tag).sort((a, b) => getBestDate(b) - getBestDate(a));

  const itemsHtml = files.map(f => renderCard(f)).join('');

  res.send(await render('browse.html', {
    pageTitle: `#${tag} — LLM KB`,
    sectionLabel: `Tag: #${tag}`,
    section: 'tags',
    count: files.length,
    items: itemsHtml || '<p class="search-empty">No articles with this tag.</p>',
    containerClass: 'browse-grid',
    breadcrumb: `<a href="/">Home</a> › Tags › ${tag}`,
    activeNav: '',
  }));
});

router.get('/browse/:section', async (req, res) => {
  const { section } = req.params;
  const files = getFilesBySection(section).sort((a, b) => getBestDate(b) - getBestDate(a));

  const label = SECTION_LABELS[section] || section;

  if (!files.length && !SECTION_LABELS[section]) {
    return res.status(404).send('Not found');
  }

  const itemsHtml = files.map(f => renderCard(f)).join('')
    || '<p class="search-empty">No articles in this section.</p>';

  res.send(await render('browse.html', {
    pageTitle: `${label} — LLM KB`,
    sectionLabel: label,
    section,
    count: files.length,
    items: itemsHtml,
    containerClass: 'browse-grid',
    breadcrumb: `<a href="/">Home</a> › ${label}`,
    activeNav: section,
  }));
});

export default router;

// ── Helpers ────────────────────────────────────────────────────────────────

function getBestDate(f) {
  const raw = f.meta?.updated || f.meta?.created || f.meta?.lastreaddate || '';
  if (raw) { const d = new Date(raw); if (!isNaN(d)) return d; }
  return f.mtime ? new Date(f.mtime) : new Date(0);
}

function renderCard(f) {
  const tags = (f.meta?.tags || []).slice(0, 3)
    .map(t => `<a href="/browse/tags/${encodeURIComponent(t)}" class="tag">${escHtml(t)}</a>`)
    .join('');
  const dateObj = getBestDate(f);
  const dateIso = dateObj.toISOString().slice(0, 10);
  const dateDisplay = f.meta?.updated || f.meta?.created || f.meta?.lastreaddate || dateIso;
  const sectionLabel = SECTION_LABELS[f.section] || f.section;
  return `<div class="browse-card" data-date="${dateIso}" data-title="${escHtml(f.title)}">
    <a href="/wiki/${f.slug}" class="browse-card-title">${escHtml(f.title)}</a>
    <div class="browse-card-meta">
      <span class="tag">${escHtml(sectionLabel)}</span>
      <span class="browse-card-date">${escHtml(dateDisplay)}</span>
    </div>
    ${tags ? `<div class="browse-card-tags">${tags}</div>` : ''}
  </div>`;
}

function escHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}
