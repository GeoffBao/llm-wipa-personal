import { Router } from 'express';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { render } from '../render/template.js';
import { VAULT_PATH, READWISE_CHAT_URL } from '../../config.js';
import yaml from 'js-yaml';

const router = Router();

const READWISE_TOKEN = () => process.env.READWISE_TOKEN || '';
const READWISE_DIR   = () => join(VAULT_PATH, 'Raw', 'readwise');

// ── In-memory cache ───────────────────────────────────────────────────────────
let _cache = null;
let _cacheAt = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 min

// ── Constants ─────────────────────────────────────────────────────────────────
const CAT_LABELS = {
  rss: 'RSS', article: 'Article', tweet: 'Tweet',
  email: 'Email', epub: 'Book', pdf: 'PDF',
  video: 'Video', podcast: 'Podcast',
};

const CAT_ICONS = {
  rss:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:11px;height:11px"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg>`,
  article: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:11px;height:11px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  tweet:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:11px;height:11px"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>`,
  email:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:11px;height:11px"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
  epub:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:11px;height:11px"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 0 3-3h7z"/></svg>`,
  pdf:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:11px;height:11px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/></svg>`,
  video:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:11px;height:11px"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>`,
  podcast: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:11px;height:11px"><circle cx="12" cy="11" r="1"/><path d="M11 17.93A8.01 8.01 0 0 1 4.07 11"/><path d="M12.97 17.93A8.01 8.01 0 0 0 19.93 11"/><circle cx="12" cy="11" r="4"/></svg>`,
};

const LOC_META = {
  inbox:   { label: 'Inbox',   css: 'loc-inbox' },
  later:   { label: 'Later',   css: 'loc-later' },
  archive: { label: 'Archive', css: 'loc-archive' },
  feed:    { label: 'Feed',    css: 'loc-feed' },
  new:     { label: 'New',     css: 'loc-inbox' },
  shortlist:{ label: 'Shortlist', css: 'loc-later' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function extractDomain(url) {
  if (!url) return '';
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return '';
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function progressBar(pct) {
  if (!pct || pct <= 0) return '';
  const w = Math.round(pct * 100);
  return `<div class="rw-progress-wrap"><div class="rw-progress-bar" style="width:${w}%"></div></div>`;
}

// ── API loader ────────────────────────────────────────────────────────────────
async function fetchFromAPI() {
  if (_cache && Date.now() - _cacheAt < CACHE_TTL) return _cache;

  const articles = [];
  let cursor = null;

  do {
    const url = new URL('https://readwise.io/api/v3/list/');
    url.searchParams.set('withHtmlContent', 'false');
    if (cursor) url.searchParams.set('pageCursor', cursor);

    const resp = await fetch(url.toString(), {
      headers: { Authorization: `Token ${READWISE_TOKEN()}` },
    });
    if (!resp.ok) throw new Error(`Readwise API responded ${resp.status}`);
    const data = await resp.json();
    articles.push(...data.results);
    cursor = data.nextPageCursor || null;
  } while (cursor);

  _cache = articles
    .map(d => ({
      id:       d.id,
      title:    d.title || '(untitled)',
      author:   d.author || '',
      url:      `https://read.readwise.io/read/${d.id}`,
      sourceUrl: d.source_url || d.url || '',
      category: (d.category || 'article').toLowerCase(),
      location: (d.location || 'inbox').toLowerCase(),
      savedAt:  d.saved_at || d.created_at || '',
      tags:     (d.tags || []).map(t => t.name),
      domain:   extractDomain(d.source_url || d.url || ''),
      progress: typeof d.reading_progress === 'number' ? d.reading_progress : 0,
      wordCount: d.word_count || 0,
      summary:  d.summary || '',
      imageUrl: d.image_url || '',
      source:   'api',
    }))
    .sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));

  _cacheAt = Date.now();
  return _cache;
}

// ── Vault fallback ────────────────────────────────────────────────────────────
function parseFrontmatter(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  try { return yaml.load(m[1]) || {}; } catch { return {}; }
}

async function fetchFromVault() {
  const dir = READWISE_DIR();
  let files;
  try { files = await readdir(dir); } catch { return []; }

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
      location: (meta.location || 'later').toLowerCase(),
      savedAt:  meta.saved_at || '',
      tags:     Array.isArray(meta.tags) ? meta.tags : [],
      domain:   extractDomain(meta.source_url || meta.url || ''),
      progress: 0,
      wordCount: meta.word_count || 0,
      summary:  '',
      imageUrl: '',
      source:   'vault',
    });
  }
  return articles.sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
}

// ── Card renderer ─────────────────────────────────────────────────────────────
function renderCard(a) {
  const catLabel = CAT_LABELS[a.category] || a.category;
  const catIcon  = CAT_ICONS[a.category]  || CAT_ICONS.article;
  const locMeta  = LOC_META[a.location]   || LOC_META.inbox;
  const date     = formatDate(a.savedAt);
  const domain   = a.domain ? `<span class="rw-card-domain">${a.domain}</span>` : '';
  const tags     = a.tags.length
    ? `<div class="rw-card-tags">${a.tags.map(t => `<span class="rw-tag">${t}</span>`).join('')}</div>`
    : '';
  const bar      = progressBar(a.progress);
  const pctLabel = a.progress > 0 ? `<span class="rw-progress-pct">${Math.round(a.progress * 100)}%</span>` : '';
  const wc       = a.wordCount > 0
    ? `<span class="rw-card-wc">${Math.round(a.wordCount / 200)} min</span>`
    : '';

  return `
    <a href="${a.url}" target="_blank" rel="noopener" class="rw-card" data-category="${a.category}" data-location="${a.location}">
      <div class="rw-card-meta">
        <span class="rw-cat-badge rw-cat-${a.category}">${catIcon}${catLabel}</span>
        <span class="rw-loc-badge ${locMeta.css}">${locMeta.label}</span>
        ${domain}
        ${wc}
        <span class="rw-card-date">${date}</span>
      </div>
      <div class="rw-card-title">${a.title}</div>
      ${a.author ? `<div class="rw-card-author">${a.author}</div>` : ''}
      ${a.summary ? `<div class="rw-card-summary">${a.summary}</div>` : ''}
      ${tags}
      ${bar ? `<div class="rw-card-progress">${bar}${pctLabel}</div>` : ''}
    </a>`;
}

// ── Readwise Chat (in LLM KB shell; Readwise itself blocks iframe — see view) ─
router.get('/readwise/chat', async (_req, res) => {
  res.send(await render('readwise-chat-embed.html', {
    pageTitle: 'Readwise Chat — LLM KB',
    activeNav: 'readwise',
    readwiseChatUrl: READWISE_CHAT_URL,
  }));
});

// ── Route ─────────────────────────────────────────────────────────────────────
router.get('/readwise', async (req, res) => {
  const catFilter = req.query.cat || 'all';
  const locFilter = req.query.loc || 'all';

  let articles, usingAPI = false, apiError = '';

  if (READWISE_TOKEN()) {
    try {
      articles = await fetchFromAPI();
      usingAPI = true;
    } catch (err) {
      apiError = err.message;
      articles = await fetchFromVault();
    }
  } else {
    articles = await fetchFromVault();
  }

  // Build unique categories/locations present
  const cats = [...new Set(articles.map(a => a.category))].sort();
  const locs = [...new Set(articles.map(a => a.location))].sort();

  // Filter
  let filtered = articles;
  if (catFilter !== 'all') filtered = filtered.filter(a => a.category === catFilter);
  if (locFilter !== 'all') filtered = filtered.filter(a => a.location === locFilter);

  // Tab builders
  const catCount = c => articles.filter(a => a.category === c && (locFilter === 'all' || a.location === locFilter)).length;
  const locCount = l => articles.filter(a => a.location === l && (catFilter === 'all' || a.category === catFilter)).length;

  const catTabsHtml = [
    `<a href="?cat=all${locFilter !== 'all' ? '&loc=' + locFilter : ''}" class="rw-tab ${catFilter === 'all' ? 'active' : ''}">All <span class="rw-tab-count">${catFilter === 'all' ? filtered.length : articles.filter(a => locFilter === 'all' || a.location === locFilter).length}</span></a>`,
    ...cats.map(c => `<a href="?cat=${c}${locFilter !== 'all' ? '&loc=' + locFilter : ''}" class="rw-tab ${catFilter === c ? 'active' : ''}">${CAT_LABELS[c] || c} <span class="rw-tab-count">${catCount(c)}</span></a>`),
  ].join('');

  const locTabsHtml = locs.length > 1 ? [
    `<a href="?${catFilter !== 'all' ? 'cat=' + catFilter + '&' : ''}loc=all" class="rw-loc-tab ${locFilter === 'all' ? 'active' : ''}">All</a>`,
    ...locs.map(l => {
      const m = LOC_META[l] || { label: l, css: 'loc-inbox' };
      return `<a href="?${catFilter !== 'all' ? 'cat=' + catFilter + '&' : ''}loc=${l}" class="rw-loc-tab ${locFilter === l ? 'active' : ''} ${m.css}">${m.label} <span class="rw-tab-count">${locCount(l)}</span></a>`;
    }),
  ].join('') : '';

  const cacheAge = usingAPI && _cacheAt
    ? Math.round((Date.now() - _cacheAt) / 1000)
    : null;

  const statusHtml = apiError
    ? `<div class="rw-api-warn">⚠ API error: ${apiError} — showing vault data</div>`
    : usingAPI
      ? `<div class="rw-api-status">Live via Readwise API${cacheAge !== null ? ` · cached ${cacheAge}s ago` : ''} <button class="rw-refresh-btn" onclick="location.href='/readwise/refresh'">Refresh</button></div>`
      : `<div class="rw-api-status rw-api-vault">Reading from vault · <a href="#setup">Add READWISE_TOKEN to .env</a> for live data</div>`;

  const inboxCount   = articles.filter(a => a.location === 'inbox' || a.location === 'new').length;
  const laterCount   = articles.filter(a => a.location === 'later' || a.location === 'shortlist').length;
  const archiveCount = articles.filter(a => a.location === 'archive').length;
  const readPct      = articles.length
    ? Math.round(articles.filter(a => a.progress >= 0.9).length / articles.length * 100)
    : 0;

  const statsHtml = `
    <div class="rw-stats">
      <div class="rw-stat"><span class="rw-stat-num">${articles.length}</span><span class="rw-stat-label">Saved</span></div>
      <div class="rw-stat"><span class="rw-stat-num">${inboxCount}</span><span class="rw-stat-label">Inbox</span></div>
      <div class="rw-stat"><span class="rw-stat-num">${laterCount}</span><span class="rw-stat-label">Later</span></div>
      <div class="rw-stat"><span class="rw-stat-num">${archiveCount}</span><span class="rw-stat-label">Archive</span></div>
      <div class="rw-stat"><span class="rw-stat-num">${readPct}%</span><span class="rw-stat-label">Completed</span></div>
    </div>`;

  const cardsHtml = filtered.map(renderCard).join('');
  const emptyHtml = filtered.length === 0
    ? `<div class="rw-empty">No articles match this filter.</div>`
    : '';

  res.send(await render('readwise.html', {
    pageTitle:    'Readwise — LLM KB',
    activeNav:    'readwise',
    totalCount:   articles.length,
    filteredCount: filtered.length,
    catTabsHtml,
    locTabsHtml,
    statusHtml,
    statsHtml,
    cardsHtml,
    emptyHtml,
    hasLocTabs:   locs.length > 1,
  }));
});

// Bust cache and redirect
router.get('/readwise/refresh', (req, res) => {
  _cache = null;
  _cacheAt = 0;
  res.redirect('/readwise');
});

export default router;
