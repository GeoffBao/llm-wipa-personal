import { Router } from 'express';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { render } from '../render/template.js';
import { VAULT_PATH } from '../../config.js';
import yaml from 'js-yaml';

const router = Router();

const READWISE_DIR = () => join(VAULT_PATH, 'Raw', 'readwise');

const CATEGORY_LABELS = {
  rss:     'RSS',
  article: 'Article',
  tweet:   'Tweet',
  email:   'Email',
  epub:    'Book',
  pdf:     'PDF',
  video:   'Video',
  podcast: 'Podcast',
};

const CATEGORY_ICONS = {
  rss:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:11px;height:11px"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg>',
  article: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:11px;height:11px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  tweet:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:11px;height:11px"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>',
  email:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:11px;height:11px"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
  epub:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:11px;height:11px"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 0 3-3h7z"/></svg>',
};

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  try {
    return yaml.load(match[1]) || {};
  } catch {
    return {};
  }
}

function extractDomain(url) {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

async function loadReadwiseArticles() {
  const dir = READWISE_DIR();
  let files;
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }
  const articles = [];
  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    const content = await readFile(join(dir, file), 'utf8');
    const meta = parseFrontmatter(content);
    if (!meta.title) continue;
    const cat = (meta.category || 'article').replace(/['"]/g, '').toLowerCase();
    articles.push({
      id:       meta.id || file,
      title:    meta.title,
      author:   meta.author || '',
      url:      meta.url || '',
      sourceUrl: meta.source_url || '',
      category: cat,
      savedAt:  meta.saved_at || '',
      tags:     Array.isArray(meta.tags) ? meta.tags : [],
      domain:   extractDomain(meta.source_url || meta.url || ''),
      slug:     file.replace(/\.md$/, ''),
      content,
    });
  }
  return articles.sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
}

function renderArticleCard(a) {
  const catLabel = CATEGORY_LABELS[a.category] || a.category;
  const catIcon  = CATEGORY_ICONS[a.category] || CATEGORY_ICONS.article;
  const date     = formatDate(a.savedAt);
  const href     = a.url || a.sourceUrl || '#';
  const domain   = a.domain ? `<span class="rw-card-domain">${a.domain}</span>` : '';
  const tags     = a.tags.length ? `<div class="rw-card-tags">${a.tags.map(t => `<span class="rw-tag">${t}</span>`).join('')}</div>` : '';

  return `
    <a href="${href}" target="_blank" rel="noopener" class="rw-card" data-category="${a.category}">
      <div class="rw-card-meta">
        <span class="rw-cat-badge rw-cat-${a.category}">${catIcon}${catLabel}</span>
        ${domain}
        <span class="rw-card-date">${date}</span>
      </div>
      <div class="rw-card-title">${a.title}</div>
      ${a.author ? `<div class="rw-card-author">${a.author}</div>` : ''}
      ${tags}
    </a>`;
}

router.get('/readwise', async (req, res) => {
  const filter = req.query.cat || 'all';
  const allArticles = await loadReadwiseArticles();

  const cats = [...new Set(allArticles.map(a => a.category))].sort();
  const filtered = filter === 'all' ? allArticles : allArticles.filter(a => a.category === filter);

  const tabsHtml = [
    `<a href="/readwise" class="rw-tab ${filter === 'all' ? 'active' : ''}">All <span class="rw-tab-count">${allArticles.length}</span></a>`,
    ...cats.map(c => {
      const count = allArticles.filter(a => a.category === c).length;
      return `<a href="/readwise?cat=${c}" class="rw-tab ${filter === c ? 'active' : ''}">${CATEGORY_LABELS[c] || c} <span class="rw-tab-count">${count}</span></a>`;
    }),
  ].join('');

  const cardsHtml = filtered.map(renderArticleCard).join('');
  const emptyHtml = filtered.length === 0
    ? `<div class="rw-empty">No articles saved yet. Sync Readwise to your vault to see them here.</div>`
    : '';

  res.send(await render('readwise.html', {
    pageTitle: 'Readwise — LLM KB',
    activeNav: 'readwise',
    totalCount: allArticles.length,
    filteredCount: filtered.length,
    tabsHtml,
    cardsHtml,
    emptyHtml,
    currentFilter: filter,
  }));
});

export default router;
