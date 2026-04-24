import { Router } from 'express';
import { getAllBooks, getBook } from '../vault/loader.js';
import { renderMarkdown } from '../render/markdown.js';
import { render } from '../render/template.js';

const router = Router();

router.get('/reading', async (req, res) => {
  const books = getAllBooks().sort((a, b) => {
    const da = String(a.meta.lastreaddate || '');
    const db = String(b.meta.lastreaddate || '');
    return db.localeCompare(da);
  });

  // Group by category
  const byCategory = new Map();
  for (const book of books) {
    const cat = book.category || 'Uncategorized';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push(book);
  }

  const categoriesHtml = [...byCategory.entries()].map(([cat, catBooks]) => {
    const cards = catBooks.map(b => renderBookCard(b)).join('');
    return `
      <div class="reading-category">
        <h2 class="reading-category-title">${cat}</h2>
        <div class="book-grid">${cards}</div>
      </div>`;
  }).join('');

  const stats = getReadingStats(books);

  res.send(await render('reading.html', {
    pageTitle: 'Reading Shelf — LLM KB',
    totalBooks: books.length,
    totalNotes: stats.totalNotes,
    categoriesHtml,
    activeNav: 'reading',
  }));
});

router.get('/reading/:slug', async (req, res) => {
  const book = getBook('reading-' + req.params.slug) || getBook(req.params.slug);
  if (!book) return res.status(404).send('Not found');

  const html = renderMarkdown(book.body, book.filepath);
  res.send(await render('article.html', {
    pageTitle: `${book.title} — LLM KB`,
    title: book.title,
    sectionLabel: 'Reading',
    breadcrumb: `<a href="/">Home</a> › <a href="/reading">Reading</a> › ${book.title}`,
    infobox: renderBookInfobox(book.meta),
    toc: '',
    content: html,
    backlinks: '',
    tagBadges: '',
    updatedAt: book.meta.lastreaddate || book.meta.lastReadDate || '',
    activeNav: 'reading',
  }));
});

function renderBookCard(book) {
  const cover = book.meta.cover || '';
  const progress = String(book.meta.progress || '');
  const author = String(book.meta.author || '');
  const noteCount = Number(book.meta.notecount || 0);
  const lastRead = String(book.meta.lastreaddate || '').slice(0, 10);
  const finished = book.meta.finisheddate;
  const progressNum = parseInt(progress) || 0;
  const slug = book.slug.replace('reading-', '');

  const coverHtml = cover
    ? `<img src="${cover}" alt="${book.title}" class="book-cover" loading="lazy" onerror="this.style.display='none'">`
    : `<div class="book-cover book-cover-placeholder">${book.title.slice(0, 2)}</div>`;

  return `
    <a href="/reading/${slug}" class="book-card">
      <div class="book-cover-wrap">
        ${coverHtml}
        ${finished ? '<span class="book-badge-done">✓ Done</span>' : ''}
      </div>
      <div class="book-info">
        <div class="book-title">${book.title}</div>
        <div class="book-author">${author}</div>
        <div class="book-meta">
          <div class="book-progress-bar"><div class="book-progress-fill" style="width:${progressNum}%"></div></div>
          <span class="book-progress-text">${progress}</span>
        </div>
        ${noteCount > 0 ? `<div class="book-notes">📝 ${noteCount} notes</div>` : ''}
        ${lastRead ? `<div class="book-date">Last read: ${lastRead}</div>` : ''}
      </div>
    </a>`;
}

function renderBookInfobox(meta) {
  const rows = [];
  if (meta.author) rows.push(['Author', String(meta.author)]);
  if (meta.progress) rows.push(['Progress', String(meta.progress)]);
  if (meta.readingtime) rows.push(['Reading Time', String(meta.readingtime)]);
  if (meta.readingdate) rows.push(['Started', String(meta.readingdate)]);
  if (meta.finisheddate) rows.push(['Finished', String(meta.finisheddate)]);
  if (meta.isbn) rows.push(['ISBN', String(meta.isbn)]);
  const noteCount = Number(meta.notecount || 0);
  if (noteCount) rows.push(['Notes', `${noteCount}`]);

  const rowsHtml = rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('');
  const cover = meta.cover || '';
  const coverHtml = cover
    ? `<tr><td colspan="2" style="text-align:center;padding:.5rem"><img src="${cover}" alt="" style="max-width:140px;border-radius:4px"></td></tr>`
    : '';

  return `<table class="article-infobox"><tbody>${coverHtml}${rowsHtml}</tbody></table>`;
}

function getReadingStats(books) {
  return {
    totalNotes: books.reduce((sum, b) => sum + Number(b.meta.notecount || 0), 0),
  };
}

export default router;
