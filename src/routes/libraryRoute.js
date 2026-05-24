import { Router } from 'express';
import { readFile } from 'fs/promises';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getAllBooks } from '../vault/loader.js';
import { renderMarkdown } from '../render/markdown.js';
import { render } from '../render/template.js';
import { VAULT_PATH } from '../../config.js';

const router = Router();

const SYNC_FILE             = () => join(VAULT_PATH, 'Raw', 'readwise-sync-data.json');
const WEREAD_SYNC_FILE      = () => join(VAULT_PATH, 'Raw', 'weread-sync-data.json');
const APPLE_BOOKS_SYNC_FILE = () => join(VAULT_PATH, 'Raw', 'apple-books-sync-data.json');

function toDateStr(val) {
  if (!val) return '';
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val).slice(0, 10);
}

// ── Data loaders ───────────────────────────────────────────────────────────────

async function loadReadwiseBooks() {
  try {
    const raw = await readFile(SYNC_FILE(), 'utf8');
    const data = JSON.parse(raw);
    return (data.articles || [])
      .filter(a => a.category === 'epub')
      .map(a => ({
        id:          `rw-${a.id}`,
        title:       a.title,
        author:      a.author || '',
        cover:       a.imageUrl || '',
        progressPct: Math.round((a.progress || 0) * 100),
        source:      'readwise',
        noteCount:   0,
        reviewCount: 0,
        lastReadDate: (a.updatedAt || a.savedAt || '').slice(0, 10),
        url:         a.url,
        isFinished:  (a.progress || 0) >= 0.9,
        wordCount:   a.wordCount || 0,
        tags:        a.tags || [],
      }));
  } catch {
    return [];
  }
}

// Load optional weread-sync-data.json (from scripts/sync-weread.js)
function loadWeReadSyncData() {
  try {
    const raw = readFileSync(WEREAD_SYNC_FILE(), 'utf8');
    const data = JSON.parse(raw);
    const map = new Map();
    for (const b of (data.books || [])) {
      map.set(b.title?.toLowerCase().trim(), b);
    }
    return map;
  } catch {
    return new Map();
  }
}

function loadWeReadBooks() {
  const syncMap = loadWeReadSyncData(); // title → fresh API data

  return getAllBooks().map(book => {
    const m = book.meta;
    const progressStr = String(m.progress || '0%');
    const progressPct = parseInt(progressStr) || 0;
    const slug = book.slug.replace('reading-', '');
    const sync = syncMap.get(book.title?.toLowerCase().trim()); // fresh data if available

    return {
      id:          `wr-${book.slug}`,
      title:       book.title,
      author:      m.author instanceof Date ? '' : String(m.author || ''),
      cover:       (m.cover instanceof Date ? '' : String(m.cover || '')) || sync?.cover || '',
      progressPct: sync ? (sync.progress || progressPct) : progressPct,
      source:      'weread',
      noteCount:   sync?.noteCount  ?? (m.noteCount  || 0),
      reviewCount: sync?.reviewCount ?? (m.reviewCount || 0),
      readingTime: sync?.readingTime || String(m.readingTime || m.readingtime || ''),
      lastReadDate: sync?.lastReadDate || toDateStr(m.lastReadDate || m.lastreaddate || m.finishedDate || m.finisheddate || m.readingDate || m.readingdate || ''),
      url:         `/reading/${slug}`,
      isFinished:  (sync ? sync.isFinished : false) || progressPct >= 99 || !!m.finishedDate || !!m.finisheddate,
      isLocal:     true,
    };
  });
}

// ── Apple Books loader ─────────────────────────────────────────────────────────

function loadAppleBooksSyncData() {
  try {
    const raw = readFileSync(APPLE_BOOKS_SYNC_FILE(), 'utf8');
    const data = JSON.parse(raw);
    return data.books || [];
  } catch {
    return [];
  }
}

function loadAppleBooks() {
  return loadAppleBooksSyncData().map(b => ({
    id:          `ab-${b.bookId}`,
    title:       b.title,
    author:      b.author || '',
    cover:       b.cover  || '',
    progressPct: b.progress || 0,
    source:      'appleBooks',
    noteCount:   b.noteCount   || 0,
    reviewCount: 0,
    readingTime: '',
    lastReadDate: b.lastReadDate || '',
    url:         '',
    isFinished:  b.isFinished || false,
    isLocal:     false,
    category:    b.category || '',
  }));
}

const WEREAD_HIGHLIGHT_RE = /⏱ (\d{4}-\d{2}-\d{2})/g;

function extractHighlightDates(body) {
  const dates = [];
  if (!body) return dates;
  let m;
  while ((m = WEREAD_HIGHLIGHT_RE.exec(body)) !== null) dates.push(m[1]);
  return dates;
}

/** Daily book activity: WeRead highlight timestamps, Readwise epub updates, Apple Books lastReadDate. */
function buildReadingActivity(wereadRawBooks, readwiseBooks, appleBooks = []) {
  const countByDate = new Map();
  const highlightByDate = new Map();

  function add(date, n = 1) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    countByDate.set(date, (countByDate.get(date) || 0) + n);
  }

  function addHighlight(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    add(date);
    highlightByDate.set(date, (highlightByDate.get(date) || 0) + 1);
  }

  for (const book of wereadRawBooks) {
    const highlightDates = extractHighlightDates(book.body);
    if (highlightDates.length > 0) {
      for (const d of highlightDates) addHighlight(d);
    } else {
      const m = book.meta;
      add(toDateStr(m.lastReadDate || m.lastreaddate || m.finishedDate || m.finisheddate || ''));
    }
  }

  for (const b of readwiseBooks) {
    if (b.lastReadDate) add(b.lastReadDate);
  }

  for (const b of appleBooks) {
    if (b.lastReadDate) add(b.lastReadDate);
  }

  return { countByDate, highlightByDate };
}

// ── Heatmap: 52-week reading activity ─────────────────────────────────────────
function renderHeatmap({ countByDate, highlightByDate }) {
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const dayOfWeek = today.getDay();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + (6 - dayOfWeek));
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 52 * 7 + 1);

  const todayStr = today.toISOString().slice(0, 10);
  const startStr = startDate.toISOString().slice(0, 10);
  const inRange = [...countByDate.entries()].filter(([d]) => d >= startStr && d <= todayStr);
  const totalInYear = inRange.length;
  const highlightsInYear = [...highlightByDate.entries()]
    .filter(([d]) => d >= startStr && d <= todayStr)
    .reduce((sum, [, c]) => sum + c, 0);

  const CELL = 11, GAP = 2, STEP = CELL + GAP;
  const LEFT_PAD = 28, TOP_PAD = 20;
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const cells = [], monthLabels = [];
  let col = 0, lastMonth = -1;
  const d = new Date(startDate);

  while (d <= endDate) {
    const wd = d.getDay();
    if (wd === 0 && col > 0) col++;
    const dateStr = d.toISOString().slice(0, 10);
    const count = countByDate.get(dateStr) || 0;
    const level = count === 0 ? 0 : count <= 2 ? 1 : count <= 8 ? 2 : count <= 20 ? 3 : 4;
    const x = LEFT_PAD + col * STEP, y = TOP_PAD + wd * STEP;
    if (d.getMonth() !== lastMonth && col > 0) {
      monthLabels.push(`<text x="${x}" y="${TOP_PAD - 4}" class="hm-month">${MONTHS[d.getMonth()]}</text>`);
      lastMonth = d.getMonth();
    }
    cells.push(`<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" class="hm-cell hm-l${level}"><title>${dateStr}: ${count} reading activit${count !== 1 ? 'ies' : 'y'}</title></rect>`);
    d.setDate(d.getDate() + 1);
    if (d.getDay() === 0) col++;
  }

  const COLS = 52;
  const svgW = LEFT_PAD + COLS * STEP;
  const svgH = TOP_PAD + 7 * STEP;
  const dayLabels = [1,3,5].map(i =>
    `<text x="${LEFT_PAD - 4}" y="${TOP_PAD + i * STEP + CELL - 1}" class="hm-day" text-anchor="end">${['','Mon','','Wed','','Fri',''][i]}</text>`
  ).join('');
  const legend = [0,1,2,3,4].map(l =>
    `<svg width="${CELL}" height="${CELL}" style="display:inline-block"><rect width="${CELL}" height="${CELL}" rx="2" class="hm-cell hm-l${l}"/></svg>`
  ).join('');

  return `<div class="lib-heatmap-wrap">
    <div class="lib-heatmap-header">
      <span class="lib-heatmap-count"><strong>${totalInYear}</strong> days with book activity in the last year · <strong>${highlightsInYear}</strong> WeRead highlights</span>
    </div>
    <svg width="${svgW}" height="${svgH}" class="rw-heatmap-svg" style="max-width:100%">
      ${monthLabels.join('')}${dayLabels}${cells.join('')}
    </svg>
    <div class="rw-heatmap-legend"><span>Less</span>${legend}<span>More</span></div>
  </div>`;
}

// ── Horizontal book card ───────────────────────────────────────────────────────
function renderBookCard(book) {
  const coverHtml = book.cover
    ? `<img src="${book.cover}" alt="" class="bk-cover" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    : '';
  const phHtml = `<div class="bk-cover bk-cover-ph" style="${book.cover ? 'display:none' : ''}">${book.title.slice(0, 2)}</div>`;

  const syncBadge = book.isLocal
    ? `<span class="bk-badge bk-badge-sync">已同步</span>`
    : '';

  const srcBadge = !book.isLocal && book.source === 'readwise'
    ? `<span class="bk-badge bk-badge-rw">Readwise</span>`
    : !book.isLocal && book.source === 'appleBooks'
      ? `<span class="bk-badge bk-badge-ab">Apple Books</span>`
      : '';

  const typeBadge = `<span class="bk-badge bk-badge-type">图书</span>`;

  const statusBadge = book.isFinished
    ? `<span class="bk-badge bk-badge-done">已读</span>`
    : `<span class="bk-badge bk-badge-reading">在读</span>`;

  const statsHtml = `<div class="bk-stats">划线 ${book.noteCount || 0} · 想法 ${book.reviewCount || 0}</div>`;

  const dateHtml = book.lastReadDate
    ? `<div class="bk-date">最近阅读 ${book.lastReadDate}</div>`
    : '';

  const inner = `
    <div class="bk-cover-wrap">${coverHtml}${phHtml}</div>
    <div class="bk-body">
      <div class="bk-title">${book.title}</div>
      ${book.author ? `<div class="bk-author">${book.author}</div>` : ''}
      <div class="bk-badges">${syncBadge}${srcBadge}${typeBadge}${statusBadge}</div>
      ${statsHtml}${dateHtml}
    </div>`;

  // Cards without a URL (e.g. Apple Books local epubs) use a <div> — no navigation
  if (!book.url) {
    return `<div class="bk-card bk-card--static">${inner}</div>`;
  }

  const target = book.isLocal ? '' : ' target="_blank" rel="noopener"';
  return `<a href="${book.url}"${target} class="bk-card">${inner}</a>`;
}

// ── Year-grouped sections ──────────────────────────────────────────────────────
function renderGroups(books) {
  if (books.length === 0) return '<div class="bk-empty">No books found.</div>';

  const yearMap = new Map();
  for (const b of books) {
    const y = b.lastReadDate ? b.lastReadDate.slice(0, 4) : '其他';
    if (!yearMap.has(y)) yearMap.set(y, []);
    yearMap.get(y).push(b);
  }

  return [...yearMap.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([year, yearBooks]) => {
      yearBooks.sort((a, b) => (b.lastReadDate || '').localeCompare(a.lastReadDate || ''));
      return `
      <div class="bk-year-section">
        <div class="bk-year-heading">${year === '其他' ? '其他' : year + ' 年'}</div>
        <div class="bk-year-grid">${yearBooks.map(renderBookCard).join('')}</div>
      </div>`;
    }).join('');
}

// ── Routes ─────────────────────────────────────────────────────────────────────

router.get('/books', async (req, res) => {
  const sourceFilter = req.query.src || 'all';

  const [wereadRawBooks, readwiseBooks] = await Promise.all([
    Promise.resolve(getAllBooks()),
    loadReadwiseBooks(),
  ]);
  const wereadBooks  = loadWeReadBooks();
  const appleBooks   = loadAppleBooks();

  const allBooks = [
    ...wereadBooks.sort((a, b) => b.lastReadDate.localeCompare(a.lastReadDate)),
    ...readwiseBooks.sort((a, b) => b.lastReadDate.localeCompare(a.lastReadDate)),
    ...appleBooks.sort((a, b) => (b.lastReadDate || '').localeCompare(a.lastReadDate || '')),
  ];

  // Dedup by normalized title (sources may overlap)
  const seen = new Set();
  const dedupedBooks = allBooks.filter(b => {
    const key = b.title.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });

  let filtered = dedupedBooks;
  if (sourceFilter === 'weread')     filtered = dedupedBooks.filter(b => b.source === 'weread');
  if (sourceFilter === 'readwise')   filtered = dedupedBooks.filter(b => b.source === 'readwise');
  if (sourceFilter === 'appleBooks') filtered = dedupedBooks.filter(b => b.source === 'appleBooks');

  const totalFinished = dedupedBooks.filter(b => b.isFinished).length;
  const totalNotes    = dedupedBooks.reduce((s, b) => s + (b.noteCount || 0), 0);

  // Source tabs
  const tabsHtml = [
    ['all',        'All',          dedupedBooks.length],
    ['weread',     '微信读书',     wereadBooks.length],
    ['readwise',   'Readwise',     readwiseBooks.length],
    ['appleBooks', 'Apple Books',  appleBooks.length],
  ].map(([src, label, count]) =>
    `<a href="?src=${src}" class="lib-tab${sourceFilter === src ? ' active' : ''}">${label} <span class="lib-tab-count">${count}</span></a>`
  ).join('');

  const groupsHtml  = renderGroups(filtered);
  const heatmapHtml = renderHeatmap(buildReadingActivity(wereadRawBooks, readwiseBooks, appleBooks));

  res.send(await render('books.html', {
    pageTitle:       'Books — LLM KB',
    activeNav:       'books',
    totalBooks:      dedupedBooks.length,
    totalFinished,
    totalNotes,
    wereadCount:     wereadBooks.length,
    readwiseCount:   readwiseBooks.length,
    appleCount:      appleBooks.length,
    heatmapHtml,
    tabsHtml,
    groupsHtml,
  }));
});

// Backwards-compat redirects
router.get('/library', (req, res) => res.redirect('/books'));

// Individual book page at /reading/:slug
router.get('/reading/:slug', async (req, res) => {
  const { getAllBooks, getBook } = await import('../vault/loader.js');
  const book = getBook('reading-' + req.params.slug) || getBook(req.params.slug);
  if (!book) return res.status(404).send('Not found');

  const html = renderMarkdown(book.body, book.filepath);
  const m = book.meta;
  const rows = [];
  if (m.author)       rows.push(['Author', String(m.author)]);
  if (m.progress)     rows.push(['Progress', String(m.progress)]);
  if (m.readingTime || m.readingtime) rows.push(['Reading Time', String(m.readingTime || m.readingtime)]);
  if (m.readingDate || m.readingdate) rows.push(['Started', String(m.readingDate || m.readingdate)]);
  if (m.finishedDate || m.finisheddate) rows.push(['Finished', String(m.finishedDate || m.finisheddate)]);
  if (m.isbn)         rows.push(['ISBN', String(m.isbn)]);
  if (m.noteCount)    rows.push(['Highlights', `${m.noteCount}`]);
  const cover = m.cover || '';
  const coverRow = cover ? `<tr><td colspan="2" style="text-align:center;padding:.5rem"><img src="${cover}" alt="" style="max-width:140px;border-radius:4px"></td></tr>` : '';
  const infobox = `<table class="article-infobox"><tbody>${coverRow}${rows.map(([k,v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</tbody></table>`;

  res.send(await render('article.html', {
    pageTitle:    `${book.title} — LLM KB`,
    title:        book.title,
    sectionLabel: '微信读书',
    breadcrumb:   `<a href="/">Home</a> › <a href="/books">Books</a> › ${book.title}`,
    infobox,
    toc:          '',
    content:      html,
    backlinks:    '',
    tagBadges:    '',
    updatedAt:    String(m.lastReadDate || m.lastreaddate || ''),
    hideFlipbook: true,
    hideGraph:    true,
    activeNav:    'books',
  }));
});

export default router;
