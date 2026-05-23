import { Router } from 'express';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { getAllBooks } from '../vault/loader.js';
import { renderMarkdown } from '../render/markdown.js';
import { render } from '../render/template.js';
import { VAULT_PATH } from '../../config.js';

const router = Router();

const SYNC_FILE = () => join(VAULT_PATH, 'Raw', 'readwise-sync-data.json');

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
        category:    'Readwise',
        noteCount:   0,
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

function loadWeReadBooks() {
  return getAllBooks().map(book => {
    const m = book.meta;
    const progressStr = String(m.progress || '0%');
    const progressPct = parseInt(progressStr) || 0;
    const slug = book.slug.replace('reading-', '');
    return {
      id:          `wr-${book.slug}`,
      title:       book.title,
      author:      m.author instanceof Date ? '' : String(m.author || ''),
      cover:       m.cover instanceof Date ? '' : String(m.cover || ''),
      progressPct,
      source:      'weread',
      category:    book.category || '未分类',
      noteCount:   m.noteCount || 0,
      reviewCount: m.reviewCount || 0,
      readingTime: String(m.readingTime || m.readingtime || ''),
      lastReadDate: toDateStr(m.lastReadDate || m.lastreaddate || m.finishedDate || m.finisheddate || m.readingDate || m.readingdate || ''),
      url:         `/reading/${slug}`,
      isFinished:  progressPct >= 99 || !!m.finishedDate || !!m.finisheddate,
      isLocal:     true,
    };
  });
}

// ── Heatmap: 52-week reading activity ─────────────────────────────────────────
function renderHeatmap(books) {
  const countByDate = new Map();
  for (const b of books) {
    const d = b.lastReadDate;
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      countByDate.set(d, (countByDate.get(d) || 0) + 1);
    }
  }

  const today = new Date(); today.setHours(12, 0, 0, 0);
  const dayOfWeek = today.getDay();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + (6 - dayOfWeek));
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 52 * 7 + 1);

  const todayStr = today.toISOString().slice(0, 10);
  const startStr = startDate.toISOString().slice(0, 10);
  const totalInYear = [...countByDate.keys()].filter(d => d >= startStr && d <= todayStr).length;

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
    const level = count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 5 ? 3 : 4;
    const x = LEFT_PAD + col * STEP, y = TOP_PAD + wd * STEP;
    if (d.getMonth() !== lastMonth && col > 0) {
      monthLabels.push(`<text x="${x}" y="${TOP_PAD - 4}" class="hm-month">${MONTHS[d.getMonth()]}</text>`);
      lastMonth = d.getMonth();
    }
    cells.push(`<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" class="hm-cell hm-l${level}"><title>${dateStr}: ${count} book${count !== 1 ? 's' : ''} read</title></rect>`);
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
      <span class="lib-heatmap-count"><strong>${totalInYear}</strong> active reading days in the last year</span>
    </div>
    <svg width="${svgW}" height="${svgH}" class="rw-heatmap-svg" style="max-width:100%">
      ${monthLabels.join('')}${dayLabels}${cells.join('')}
    </svg>
    <div class="rw-heatmap-legend"><span>Less</span>${legend}<span>More</span></div>
  </div>`;
}

// ── Book card renderer ─────────────────────────────────────────────────────────
function renderBookCard(book) {
  const coverHtml = book.cover
    ? `<img src="${book.cover}" alt="${book.title}" class="lib-book-cover" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    : '';
  const placeholderHtml = `<div class="lib-book-cover lib-book-cover-placeholder" style="${book.cover ? 'display:none' : ''}">${book.title.slice(0, 2)}</div>`;

  const sourceBadge = book.source === 'weread'
    ? `<span class="lib-source-badge lib-source-weread">微信读书</span>`
    : `<span class="lib-source-badge lib-source-readwise">Readwise</span>`;

  const finishedBadge = book.isFinished
    ? `<span class="lib-done-badge">✓</span>` : '';

  const progressBar = book.progressPct > 0
    ? `<div class="lib-progress-wrap"><div class="lib-progress-bar" style="width:${book.progressPct}%"></div></div>
       <span class="lib-progress-text">${book.progressPct}%</span>`
    : '';

  const notesHtml = book.noteCount > 0
    ? `<span class="lib-notes-count">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:10px;height:10px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        ${book.noteCount}
       </span>` : '';

  const timeHtml = book.readingTime
    ? `<span class="lib-read-time">${book.readingTime}</span>` : '';

  const target = book.isLocal ? '' : ' target="_blank" rel="noopener"';

  return `<a href="${book.url}"${target} class="lib-book-card">
    <div class="lib-book-cover-wrap">
      ${coverHtml}${placeholderHtml}
      ${finishedBadge}
      ${sourceBadge}
    </div>
    <div class="lib-book-info">
      <div class="lib-book-title">${book.title}</div>
      <div class="lib-book-author">${book.author}</div>
      <div class="lib-book-progress">${progressBar}</div>
      <div class="lib-book-foot">${notesHtml}${timeHtml}</div>
    </div>
  </a>`;
}

// ── Routes ─────────────────────────────────────────────────────────────────────

router.get('/library', async (req, res) => {
  const sourceFilter = req.query.src || 'all';

  const [wereadBooks, readwiseBooks] = await Promise.all([
    Promise.resolve(loadWeReadBooks()),
    loadReadwiseBooks(),
  ]);

  const allBooks = [
    ...wereadBooks.sort((a, b) => b.lastReadDate.localeCompare(a.lastReadDate)),
    ...readwiseBooks.sort((a, b) => b.lastReadDate.localeCompare(a.lastReadDate)),
  ];

  // Dedup by normalized title (Readwise may overlap with WeRead)
  const seen = new Set();
  const dedupedBooks = allBooks.filter(b => {
    const key = b.title.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });

  let filtered = dedupedBooks;
  if (sourceFilter === 'weread') filtered = dedupedBooks.filter(b => b.source === 'weread');
  if (sourceFilter === 'readwise') filtered = dedupedBooks.filter(b => b.source === 'readwise');

  const totalFinished = dedupedBooks.filter(b => b.isFinished).length;
  const totalNotes = dedupedBooks.reduce((s, b) => s + (b.noteCount || 0), 0);

  // Source tabs
  const tabsHtml = [
    ['all', `All`, dedupedBooks.length],
    ['weread', `微信读书`, wereadBooks.length],
    ['readwise', `Readwise`, readwiseBooks.length],
  ].map(([src, label, count]) =>
    `<a href="?src=${src}" class="lib-tab${sourceFilter === src ? ' active' : ''}">${label} <span class="lib-tab-count">${count}</span></a>`
  ).join('');

  const booksHtml = filtered.map(renderBookCard).join('');
  const heatmapHtml = renderHeatmap(wereadBooks); // WeRead has more accurate lastReadDate

  res.send(await render('library.html', {
    pageTitle:      'Library — LLM KB',
    activeNav:      'library',
    totalBooks:     dedupedBooks.length,
    totalFinished,
    totalNotes,
    wereadCount:    wereadBooks.length,
    readwiseCount:  readwiseBooks.length,
    heatmapHtml,
    tabsHtml,
    booksHtml,
    emptyHtml:      filtered.length === 0 ? '<div class="lib-empty">No books found.</div>' : '',
  }));
});

// Keep /reading redirect for backwards compat
router.get('/reading', (req, res) => res.redirect('/library'));

// Individual book page (unchanged, keep at /reading/:slug)
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
    breadcrumb:   `<a href="/">Home</a> › <a href="/library">Library</a> › ${book.title}`,
    infobox,
    toc:          '',
    content:      html,
    backlinks:    '',
    tagBadges:    '',
    updatedAt:    String(m.lastReadDate || m.lastreaddate || ''),
    hideFlipbook: true,
    hideGraph:    true,
    activeNav:    'library',
  }));
});

export default router;
