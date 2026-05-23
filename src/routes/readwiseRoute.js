import { Router } from 'express';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { spawn } from 'child_process';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { render } from '../render/template.js';
import { VAULT_PATH } from '../../config.js';
import yaml from 'js-yaml';

const router = Router();
const __dirname = dirname(fileURLToPath(import.meta.url));

const READWISE_DIR  = () => join(VAULT_PATH, 'Raw', 'readwise');
const SYNC_FILE     = () => join(VAULT_PATH, 'Raw', 'readwise-sync-data.json');
const SYNC_SCRIPT   = join(__dirname, '../../scripts/sync-readwise.js');

// Track in-progress sync so the UI can show spinner
let _syncRunning = false;

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

// ── Primary data source: sync file written by scripts/sync-readwise.js ────────
async function loadSyncFile() {
  try {
    const raw = await readFile(SYNC_FILE(), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ── Fallback: Obsidian-synced vault .md files ─────────────────────────────────
function parseFrontmatter(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  try { return yaml.load(m[1]) || {}; } catch { return {}; }
}

async function loadFromVaultFiles() {
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
      id:        meta.id || file,
      title:     meta.title,
      author:    meta.author || '',
      url:       meta.url || `https://read.readwise.io/read/${meta.id}`,
      sourceUrl: meta.source_url || '',
      category:  cat,
      location:  (meta.location || 'later').toLowerCase(),
      savedAt:   meta.saved_at || '',
      tags:      Array.isArray(meta.tags) ? meta.tags : [],
      domain:    extractDomain(meta.source_url || meta.url || ''),
      progress:  0,
      wordCount: meta.word_count || 0,
      summary:   '',
      imageUrl:  '',
    });
  }
  return articles.sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
}

// ── Sync trigger (non-blocking) ───────────────────────────────────────────────
function triggerSync(incremental = false) {
  if (_syncRunning) return { started: false, reason: 'already running' };
  _syncRunning = true;
  const args = ['--env-file=.env', SYNC_SCRIPT];
  if (incremental) args.push('--incremental');
  const child = spawn(process.execPath, args, {
    cwd: join(__dirname, '../..'),
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', d => process.stdout.write(`[sync-readwise] ${d}`));
  child.stderr.on('data', d => process.stderr.write(`[sync-readwise] ${d}`));
  child.on('close', code => {
    _syncRunning = false;
    console.log(`[sync-readwise] exited with code ${code}`);
  });
  return { started: true };
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

// ── Heatmap: 52-week article-saving activity ──────────────────────────────────
function renderHeatmap(articles) {
  const countByDate = new Map();
  for (const a of articles) {
    if (!a.savedAt) continue;
    const d = String(a.savedAt).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    countByDate.set(d, (countByDate.get(d) || 0) + 1);
  }

  const today = new Date(); today.setHours(12, 0, 0, 0);
  const dayOfWeek = today.getDay();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + (6 - dayOfWeek));
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 52 * 7 + 1);

  const CELL = 11, GAP = 2, LABEL_H = 18, LABEL_W = 26;
  const COLS = 52;
  const width = LABEL_W + COLS * (CELL + GAP);
  const height = LABEL_H + 7 * (CELL + GAP);
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const cells = [], monthLabels = [];
  let col = 0, lastMonth = -1;
  const d = new Date(startDate);

  while (d <= endDate) {
    const wd = d.getDay();
    if (wd === 0 && col > 0) col++;
    const dateStr = d.toISOString().slice(0, 10);
    const count = countByDate.get(dateStr) || 0;
    const level = count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 6 ? 3 : 4;
    const x = LABEL_W + col * (CELL + GAP);
    const y = LABEL_H + wd * (CELL + GAP);
    if (d.getMonth() !== lastMonth && col > 0) {
      monthLabels.push(`<text x="${x}" y="${LABEL_H - 4}" class="hm-month">${MONTHS[d.getMonth()]}</text>`);
      lastMonth = d.getMonth();
    }
    cells.push(`<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" class="hm-cell hm-l${level}"><title>${dateStr}: ${count} saved</title></rect>`);
    d.setDate(d.getDate() + 1);
    if (d.getDay() === 0) col++;
  }

  const dayLabels = ['','Mon','','Wed','','Fri',''].map((l, i) =>
    l ? `<text x="${LABEL_W - 4}" y="${LABEL_H + i * (CELL + GAP) + CELL - 1}" class="hm-day" text-anchor="end">${l}</text>` : ''
  ).join('');

  const legend = [0,1,2,3,4].map(l =>
    `<svg width="${CELL}" height="${CELL}" style="display:inline-block"><rect width="${CELL}" height="${CELL}" rx="2" class="hm-cell hm-l${l}"/></svg>`
  ).join('');

  return `<div class="rw-heatmap-wrap">
    <svg width="${width}" height="${height}" class="rw-heatmap-svg" style="max-width:100%">
      ${monthLabels.join('')}${dayLabels}${cells.join('')}
    </svg>
    <div class="rw-heatmap-legend"><span>Less</span>${legend}<span>More</span></div>
  </div>`;
}

// ── Top sources bar list ───────────────────────────────────────────────────────
function renderTopSources(articles) {
  const counts = new Map();
  for (const a of articles) {
    if (!a.domain) continue;
    counts.set(a.domain, (counts.get(a.domain) || 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!top.length) return '';
  const max = top[0][1];
  const rows = top.map(([domain, count]) => {
    const pct = Math.round(count / max * 100);
    return `<div class="rw-src-row">
      <span class="rw-src-domain">${domain}</span>
      <div class="rw-src-bar-wrap"><div class="rw-src-bar" style="width:${pct}%"></div></div>
      <span class="rw-src-count">${count}</span>
    </div>`;
  }).join('');
  return `<div class="rw-top-sources"><div class="rw-top-sources-title">Top Sources</div>${rows}</div>`;
}

// ── Sync API endpoint ──────────────────────────────────────────────────────────
router.post('/api/readwise/sync', (req, res) => {
  const incremental = req.query.mode === 'incremental';
  const result = triggerSync(incremental);
  res.json({ ...result, incremental });
});

// ── Route ─────────────────────────────────────────────────────────────────────
router.get('/readwise', async (req, res) => {
  const catFilter = req.query.cat || 'all';
  const locFilter = req.query.loc || 'all';

  // Primary: sync JSON file; fallback: vault .md files
  const syncData = await loadSyncFile();
  const articles = syncData?.articles ?? await loadFromVaultFiles();
  const syncedAt  = syncData?.syncedAt ?? null;
  const syncMode  = syncData?.mode ?? 'vault';

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

  function timeAgoLabel(iso) {
    if (!iso) return '';
    const secs = Math.round((Date.now() - new Date(iso)) / 1000);
    if (secs < 60) return 'just now';
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
    return `${Math.floor(secs / 86400)}d ago`;
  }

  const inboxCount   = articles.filter(a => a.location === 'inbox' || a.location === 'new').length;
  const laterCount   = articles.filter(a => a.location === 'later' || a.location === 'shortlist').length;
  const archiveCount = articles.filter(a => a.location === 'archive').length;
  const readPct      = articles.length
    ? Math.round(articles.filter(a => a.progress >= 0.9).length / articles.length * 100)
    : 0;

  const syncLabel = syncedAt ? `synced ${timeAgoLabel(syncedAt)}` : 'vault fallback';
  const syncingClass = _syncRunning ? ' rw-syncing' : '';

  const cardsHtml = filtered.map(renderCard).join('');
  const emptyHtml = filtered.length === 0
    ? `<div class="rw-empty">No articles match this filter.</div>`
    : '';

  res.send(await render('readwise.html', {
    pageTitle:      'Readwise — LLM KB',
    activeNav:      'readwise',
    totalCount:     articles.length,
    inboxCount,
    laterCount,
    archiveCount,
    readPct,
    filteredCount:  filtered.length,
    catTabsHtml,
    locTabsHtml,
    heatmapHtml:    renderHeatmap(articles),
    topSourcesHtml: renderTopSources(articles),
    syncLabel,
    syncingClass,
    hasSyncData:    !!syncData,
    cardsHtml,
    emptyHtml,
    hasLocTabs:     locs.length > 1,
  }));
});

router.get('/readwise/refresh', (req, res) => {
  res.redirect('/readwise');
});

export default router;
