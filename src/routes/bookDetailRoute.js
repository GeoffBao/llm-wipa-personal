/**
 * Book Detail Route — /books/:slug
 * Renders a rich detail page for a book, integrating:
 *  - Cover / meta hero
 *  - KB tabs (Overview, Chapters, Glossary, Patterns)  when .kb/ exists
 *  - WeRead highlights timeline                         when weread/ json exists
 *  - Raw vault notes (collapsible)
 *  - Full-screen overlay → /book-pages/<dir>/index.html
 */

import { Router }       from 'express';
import { readFile }     from 'fs/promises';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join }         from 'path';
import { marked }       from 'marked';
import { getAllBooks, getBook } from '../vault/loader.js';
import { renderMarkdown }      from '../render/markdown.js';
import { render }              from '../render/template.js';
import { VAULT_PATH }          from '../../config.js';

const router = Router();

const BOOKS_EXPORT = () => join(VAULT_PATH, 'AI-Generated', 'exports', 'books');

// ── KB discovery ───────────────────────────────────────────────────────────────

/**
 * Scan exports/books/ for KB directories whose name fuzzy-matches a book title.
 * Returns { dir, indexPath, chaptersDir, glossaryPath, patternsPath, cheatsheetPath,
 *           wereadDir, htmlFiles, slug }
 */
function findKBForTitle(title) {
  const base = BOOKS_EXPORT();
  if (!existsSync(base)) return null;

  const normalize = s => s.toLowerCase().replace(/[：:《》\s「」【】\-_·]/g, '').trim();
  const want = normalize(title);

  let bestDir = null;
  for (const entry of readdirSync(base, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (normalize(entry.name).includes(want) || want.includes(normalize(entry.name))) {
      bestDir = entry.name;
      break;
    }
  }
  if (!bestDir) return null;

  const dir     = join(base, bestDir);
  const indexPath     = join(dir, 'INDEX.md');
  const chaptersDir   = join(dir, 'chapters');
  const glossaryPath  = join(dir, 'glossary.md');
  const patternsPath  = join(dir, 'patterns.md');
  const cheatsheetPath = join(dir, 'cheatsheet.md');
  const wereadDir     = join(dir, 'weread');

  // Find HTML learning pages in this dir
  const htmlFiles = existsSync(dir)
    ? readdirSync(dir).filter(f => f.endsWith('.html')).map(f => ({
        name: f.replace(/\.html$/, ''),
        url:  `/book-pages/${encodeURIComponent(bestDir)}/${encodeURIComponent(f)}`,
      }))
    : [];

  return {
    dir, bestDir,
    indexPath:      existsSync(indexPath)      ? indexPath      : null,
    chaptersDir:    existsSync(chaptersDir)    ? chaptersDir    : null,
    glossaryPath:   existsSync(glossaryPath)   ? glossaryPath   : null,
    patternsPath:   existsSync(patternsPath)   ? patternsPath   : null,
    cheatsheetPath: existsSync(cheatsheetPath) ? cheatsheetPath : null,
    wereadDir:      existsSync(wereadDir)      ? wereadDir      : null,
    htmlFiles,
  };
}

// ── WeRead data loaders ────────────────────────────────────────────────────────

function loadWeReadData(wereadDir) {
  if (!wereadDir) return null;
  function j(name) {
    try { return JSON.parse(readFileSync(join(wereadDir, name), 'utf8')); }
    catch { return null; }
  }
  const bookInfo    = j('book_info.json');
  const progressRaw = j('progress.json');
  const bmRaw       = j('my_bookmarks.json');
  const reviewsRaw  = j('my_reviews.json');
  const hotRaw      = j('hot_bookmarks.json');

  const bookmarks = bmRaw
    ? (bmRaw.updated || bmRaw).sort((a, b) => (b.createTime || 0) - (a.createTime || 0))
    : [];
  const reviews   = reviewsRaw
    ? (reviewsRaw.reviews || reviewsRaw)
    : [];
  const hot       = hotRaw
    ? (hotRaw.reviews || hotRaw.items || (Array.isArray(hotRaw) ? hotRaw : []))
        .filter(h => h && h.markText)
        .sort((a, b) => (b.markCount || 0) - (a.markCount || 0)).slice(0, 10)
    : [];

  const progressPct  = progressRaw?.book?.progress ?? null;
  const chapterName  = progressRaw?.book?.summary  ?? '';
  const readingTimeSec = progressRaw?.book?.readingTime ?? 0;
  const readingTimeH = readingTimeSec ? Math.round(readingTimeSec / 3600 * 10) / 10 : 0;

  return {
    bookInfo,
    bookId:       bookInfo?.bookId || '',
    cover:        bookInfo?.cover  || '',
    rating:       bookInfo?.newRating ? (bookInfo.newRating / 100).toFixed(1) : null,
    ratingCount:  bookInfo?.newRatingCount || 0,
    intro:        bookInfo?.intro  || '',
    bookmarks,
    reviews,
    hot,
    progressPct,
    chapterName,
    readingTimeH,
    pencilNotes: reviews.filter(r => r.pencilNote?.imageUrl),
  };
}

// ── Chapter list loader ────────────────────────────────────────────────────────

function loadChapters(chaptersDir) {
  if (!chaptersDir) return [];
  return readdirSync(chaptersDir)
    .filter(f => f.endsWith('.md'))
    .sort()
    .map(f => {
      const raw  = readFileSync(join(chaptersDir, f), 'utf8');
      // Extract h1 title
      const titleMatch = raw.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1].trim() : f.replace(/\.md$/, '');
      // Extract Core Idea section
      const coreMatch = raw.match(/## Core Idea\n+([\s\S]*?)(?=\n##|\n---|\Z)/);
      const coreIdea  = coreMatch ? coreMatch[1].trim().slice(0, 220) : '';
      // Extract Key Takeaways bullets
      const takeawaysMatch = raw.match(/## Key Takeaways\n+([\s\S]*?)(?=\n##|\n---|\Z)/);
      const takeaways = takeawaysMatch
        ? takeawaysMatch[1].split('\n').filter(l => l.trim().startsWith('-')).slice(0, 4)
            .map(l => l.replace(/^-\s*/, '').trim())
        : [];
      return { filename: f, title, coreIdea, takeaways, raw };
    });
}

// ── HTML renderers ─────────────────────────────────────────────────────────────

function mdToHtml(text) {
  if (!text) return '';
  return marked.parse(text);
}

function escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatTs(ts) {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Tab: Overview ──────────────────────────────────────────────────────────────

function buildOverviewTab(indexMd, weread) {
  if (!indexMd) {
    return '<div class="bkd-empty">暂无知识库，运行 book-to-webpage skill 生成。</div>';
  }

  // Extract Core Frameworks section
  const frameworksMatch = indexMd.match(/## Core Frameworks\n+([\s\S]*?)(?=\n##|\Z)/);
  const frameworks = frameworksMatch
    ? frameworksMatch[1].trim().split('\n').filter(l => l.trim())
    : [];

  // Extract Chapter Index table
  const tableMatch = indexMd.match(/## Chapter Index\n+([\s\S]*?)(?=\n##|\Z)/);
  const tableRaw   = tableMatch ? tableMatch[1].trim() : '';

  const wereadBlock = weread ? `
    <div class="bkd-overview-stats">
      ${weread.rating ? `<div class="bkd-stat"><span class="bkd-stat-num">${weread.rating}</span><span class="bkd-stat-label">评分</span></div>` : ''}
      <div class="bkd-stat"><span class="bkd-stat-num">${weread.bookmarks.length}</span><span class="bkd-stat-label">我的划线</span></div>
      <div class="bkd-stat"><span class="bkd-stat-num">${weread.reviews.length}</span><span class="bkd-stat-label">我的想法</span></div>
      ${weread.progressPct !== null ? `<div class="bkd-stat"><span class="bkd-stat-num">${weread.progressPct}%</span><span class="bkd-stat-label">已读</span></div>` : ''}
      ${weread.readingTimeH ? `<div class="bkd-stat"><span class="bkd-stat-num">${weread.readingTimeH}h</span><span class="bkd-stat-label">阅读时长</span></div>` : ''}
    </div>` : '';

  const frameworksHtml = frameworks.length ? `
    <div class="bkd-section">
      <div class="bkd-section-title">核心框架</div>
      <ul class="bkd-framework-list">
        ${frameworks.map(f => `<li>${escHtml(f.replace(/^[-*]\s*/, '').replace(/\*\*/g, ''))}</li>`).join('')}
      </ul>
    </div>` : '';

  const tableHtml = tableRaw ? `
    <div class="bkd-section">
      <div class="bkd-section-title">章节索引</div>
      <div class="bkd-table-wrap">${mdToHtml(tableRaw)}</div>
    </div>` : '';

  return `${wereadBlock}${frameworksHtml}${tableHtml}`;
}

// ── Tab: Chapters ──────────────────────────────────────────────────────────────

function buildChaptersTab(chapters) {
  if (!chapters.length) return '<div class="bkd-empty">暂无章节摘要。</div>';

  return chapters.map((ch, i) => `
    <details class="bkd-chapter" ${i === 0 ? 'open' : ''}>
      <summary class="bkd-chapter-summary">
        <span class="bkd-chapter-num">${String(i + 1).padStart(2, '0')}</span>
        <span class="bkd-chapter-title">${escHtml(ch.title)}</span>
        ${ch.coreIdea ? `<span class="bkd-chapter-idea">${escHtml(ch.coreIdea.slice(0, 60))}…</span>` : ''}
      </summary>
      <div class="bkd-chapter-body">
        ${ch.coreIdea ? `<p class="bkd-core-idea">${escHtml(ch.coreIdea)}</p>` : ''}
        ${ch.takeaways.length ? `
          <div class="bkd-takeaways">
            <div class="bkd-takeaways-label">Key Takeaways</div>
            <ul>${ch.takeaways.map(t => `<li>${escHtml(t)}</li>`).join('')}</ul>
          </div>` : ''}
      </div>
    </details>`).join('');
}

// ── Tab: Glossary ──────────────────────────────────────────────────────────────

function buildGlossaryTab(glossaryMd) {
  if (!glossaryMd) return '<div class="bkd-empty">暂无词汇表。</div>';

  // Parse terms: **Term** — Definition
  const terms = [];
  for (const line of glossaryMd.split('\n')) {
    const m = line.match(/^\*\*(.+?)\*\*\s*[—–-]\s*(.+)$/);
    if (m) terms.push({ term: m[1].trim(), def: m[2].trim() });
  }

  if (!terms.length) return `<div class="bkd-glossary-raw">${mdToHtml(glossaryMd)}</div>`;

  return `
    <div class="bkd-glossary-search-wrap">
      <input type="search" id="bkd-glossary-search" class="bkd-search-input" placeholder="搜索术语…" oninput="filterGlossary(this.value)">
    </div>
    <div class="bkd-glossary-grid" id="bkd-glossary-grid">
      ${terms.map(t => `
        <div class="bkd-term" data-term="${escHtml(t.term.toLowerCase())}">
          <div class="bkd-term-name">${escHtml(t.term)}</div>
          <div class="bkd-term-def">${escHtml(t.def)}</div>
        </div>`).join('')}
    </div>`;
}

// ── Tab: Patterns ──────────────────────────────────────────────────────────────

function buildPatternsTab(patternsMd) {
  if (!patternsMd) return '<div class="bkd-empty">暂无模式库。</div>';
  return `<div class="bkd-patterns-body">${mdToHtml(patternsMd)}</div>`;
}

// ── Tab: My Highlights ────────────────────────────────────────────────────────

function buildHighlightsTab(weread) {
  if (!weread || (!weread.bookmarks.length && !weread.reviews.length)) {
    return '<div class="bkd-empty">暂无微信读书划线数据。</div>';
  }

  const bookId = weread.bookId;

  // Merge bookmarks + reviews by chapter for a timeline feel
  const bmHtml = weread.bookmarks.slice(0, 60).map(bm => {
    const review = weread.reviews.find(r => r.abstract === bm.markText && r.content);
    const deepLink = bookId && bm.chapterUid
      ? `<a href="weread://reading?bId=${bookId}&chapterUid=${bm.chapterUid}" class="bkd-wr-link">在微信读书中打开 →</a>`
      : '';
    return `
      <div class="bkd-highlight">
        <span class="bkd-hl-badge">✦ 我的划线</span>
        <p class="bkd-hl-text">"${escHtml(bm.markText)}"</p>
        ${review ? `<div class="bkd-review-bubble"><span class="bkd-review-label">💭 我的想法</span>${escHtml(review.content)}</div>` : ''}
        <div class="bkd-hl-meta">${formatTs(bm.createTime)}${deepLink}</div>
      </div>`;
  }).join('');

  // Pencil notes
  const pencilHtml = weread.pencilNotes.map(r => `
    <div class="bkd-pencil-note">
      <span class="bkd-pencil-badge">✏️ 手绘笔记</span>
      <img src="${escHtml(r.pencilNote.imageUrl)}" alt="手绘笔记"
           class="bkd-pencil-img"
           style="aspect-ratio:${r.pencilNote.imageWidth}/${r.pencilNote.imageHeight}"
           loading="lazy">
      ${r.abstract ? `<p class="bkd-pencil-abstract">"${escHtml(r.abstract)}"</p>` : ''}
    </div>`).join('');

  // Hot highlights
  const hotHtml = weread.hot.length ? `
    <div class="bkd-hot-section">
      <div class="bkd-section-title">🔥 社区热门划线</div>
      ${weread.hot.map(h => `
        <div class="bkd-hot-highlight">
          <span class="bkd-hot-badge">🔥 ${h.markCount} 人划线</span>
          <p class="bkd-hl-text">"${escHtml(h.markText)}"</p>
        </div>`).join('')}
    </div>` : '';

  return `
    <div class="bkd-highlights-wrap">
      ${pencilHtml ? `<div class="bkd-section"><div class="bkd-section-title">手绘笔记</div>${pencilHtml}</div>` : ''}
      <div class="bkd-section"><div class="bkd-section-title">我的划线 (${weread.bookmarks.length})</div>${bmHtml}</div>
      ${hotHtml}
    </div>`;
}

// ── Hero HTML ─────────────────────────────────────────────────────────────────

function buildHero(book, weread, kb) {
  const cover = (weread?.cover || book.cover || '');
  const coverHtml = cover
    ? `<img src="${escHtml(cover)}" alt="" class="bkd-cover-img" loading="lazy">`
    : `<div class="bkd-cover-ph">${escHtml(book.title.slice(0, 2))}</div>`;

  const kbBadge = kb
    ? `<span class="bk-badge bk-badge-kb">✦ KB</span>`
    : '';
  const srcBadge = `<span class="bk-badge bk-badge-wr">微信读书</span>`;
  const doneBadge = book.isFinished
    ? `<span class="bk-badge bk-badge-done">已读</span>`
    : `<span class="bk-badge bk-badge-reading">在读</span>`;

  const statsItems = [];
  if (weread?.rating)        statsItems.push(`⭐ ${weread.rating} 分 (${weread.ratingCount} 人评)`);
  if (weread?.bookmarks.length) statsItems.push(`✦ ${weread.bookmarks.length} 条划线`);
  if (weread?.reviews.length)   statsItems.push(`💭 ${weread.reviews.length} 条想法`);
  if (weread?.progressPct !== null && weread?.progressPct !== undefined)
    statsItems.push(`📖 已读 ${weread.progressPct}%`);
  if (weread?.readingTimeH)  statsItems.push(`⏱ ${weread.readingTimeH}h`);

  const intro = weread?.intro ? `<p class="bkd-intro">${escHtml(weread.intro.slice(0, 300))}${weread.intro.length > 300 ? '…' : ''}</p>` : '';

  return `
  <div class="bkd-hero">
    <div class="bkd-cover-wrap">${coverHtml}</div>
    <div class="bkd-hero-body">
      <div class="bkd-hero-title">${escHtml(book.title)}</div>
      ${book.author ? `<div class="bkd-hero-author">${escHtml(book.author)}</div>` : ''}
      <div class="bkd-hero-badges">${kbBadge}${srcBadge}${doneBadge}</div>
      ${statsItems.length ? `<div class="bkd-hero-stats">${statsItems.join(' · ')}</div>` : ''}
      ${intro}
    </div>
  </div>`;
}

// ── HTML files list (overlay launchers) ───────────────────────────────────────

function buildLearnBtns(htmlFiles) {
  if (!htmlFiles || !htmlFiles.length) return '';
  return `
    <div class="bkd-learn-bar">
      <span class="bkd-learn-label">交互学习页</span>
      ${htmlFiles.map(h => `
        <button class="bkd-learn-btn" onclick="openBookOverlay('${escHtml(h.url)}')">
          📖 ${escHtml(h.name)}
        </button>`).join('')}
    </div>`;
}

// ── Route ─────────────────────────────────────────────────────────────────────

router.get('/books/:slug', async (req, res) => {
  try {
  const slug = req.params.slug;

  // Load vault book (WeRead markdown)
  const book = getBook('reading-' + slug) || getBook(slug);
  if (!book) {
    // Fallback: try to find by title match across all weread books
    const all = getAllBooks();
    const found = all.find(b => b.slug === slug || b.slug === 'reading-' + slug);
    if (!found) return res.status(404).send('Book not found');
  }
  const bk = book || (() => { const all = getAllBooks(); return all.find(b => b.slug === slug || b.slug === 'reading-' + slug); })();

  // KB discovery
  const kb = findKBForTitle(bk.title);

  // WeRead data (from KB weread/ or from weread-sync-data.json)
  const weread = kb ? loadWeReadData(kb.wereadDir) : null;

  // Load KB content
  let indexMd    = null;
  let chapters   = [];
  let glossaryMd = null;
  let patternsMd = null;

  if (kb) {
    if (kb.indexPath)    indexMd    = await readFile(kb.indexPath, 'utf8').catch(() => null);
    if (kb.chaptersDir)  chapters   = loadChapters(kb.chaptersDir);
    if (kb.glossaryPath) glossaryMd = await readFile(kb.glossaryPath, 'utf8').catch(() => null);
    if (kb.patternsPath) patternsMd = await readFile(kb.patternsPath, 'utf8').catch(() => null);
  }

  // Vault notes (original markdown)
  const vaultNotesHtml = renderMarkdown(bk.body || '', bk.filepath);

  // Build tab contents
  const tabOverview    = buildOverviewTab(indexMd, weread);
  const tabChapters    = buildChaptersTab(chapters);
  const tabGlossary    = buildGlossaryTab(glossaryMd);
  const tabPatterns    = buildPatternsTab(patternsMd);
  const tabHighlights  = buildHighlightsTab(weread);

  const heroHtml      = buildHero(bk, weread, kb);
  const learnBtns     = buildLearnBtns(kb?.htmlFiles);

  // Determine which tabs to show
  const showKbTabs      = !!kb;
  const showHighlights  = !!(weread && (weread.bookmarks.length || weread.reviews.length));
  const hasVaultNotes   = !!(bk.body && bk.body.trim().length > 10);

  const tabsConfig = [
    { id: 'overview',   label: '📋 概述',   content: tabOverview,   show: showKbTabs },
    { id: 'chapters',   label: '📚 章节',   content: tabChapters,   show: showKbTabs && chapters.length > 0 },
    { id: 'glossary',   label: '📖 词汇',   content: tabGlossary,   show: showKbTabs && !!glossaryMd },
    { id: 'patterns',   label: '🔧 模式',   content: tabPatterns,   show: showKbTabs && !!patternsMd },
    { id: 'highlights', label: `✦ 我的划线${weread ? ' ('+weread.bookmarks.length+')' : ''}`,
                                             content: tabHighlights,  show: showHighlights },
    { id: 'notes',      label: '📝 原始笔记', content: vaultNotesHtml, show: hasVaultNotes },
  ].filter(t => t.show);

  // If no KB, default to first available tab
  const defaultTab = tabsConfig.length ? tabsConfig[0].id : 'notes';

  const tabBtnsHtml = tabsConfig.map((t, i) => `
    <button class="bkd-tab-btn${i === 0 ? ' active' : ''}"
            data-tab="${t.id}"
            onclick="switchBkdTab('${t.id}', this)">${t.label}</button>`
  ).join('');

  const tabPanelsHtml = tabsConfig.map((t, i) => `
    <div class="bkd-panel${i === 0 ? ' active' : ''}" id="bkd-panel-${t.id}">
      ${t.content}
    </div>`
  ).join('');

  const pageHtml = `
<div class="bkd-page">
  <div class="bkd-breadcrumb">
    <a href="/">Home</a> › <a href="/books">Books</a> › ${escHtml(bk.title)}
  </div>

  ${heroHtml}
  ${learnBtns}

  ${tabsConfig.length ? `
  <div class="bkd-tabs">
    <div class="bkd-tab-bar">${tabBtnsHtml}</div>
    <div class="bkd-tab-panels">${tabPanelsHtml}</div>
  </div>` : `<div class="bkd-panel active">${vaultNotesHtml}</div>`}
</div>

<!-- Full-screen overlay for interactive learning pages -->
<div id="book-overlay" class="book-overlay" hidden>
  <div class="book-overlay-bar">
    <button class="book-overlay-back" onclick="closeBookOverlay()">← 返回</button>
    <span id="book-overlay-title" class="book-overlay-title"></span>
    <a id="book-overlay-ext" href="#" target="_blank" rel="noopener" class="book-overlay-ext">↗ 新标签</a>
  </div>
  <iframe id="book-overlay-frame" class="book-overlay-frame" src="" title="交互学习页"></iframe>
</div>

<script>
(function () {
  // ── Tab switching ──────────────────────────────────────────────────────────
  window.switchBkdTab = function (id, btn) {
    document.querySelectorAll('.bkd-tab-btn').forEach(function (b) { b.classList.remove('active'); });
    document.querySelectorAll('.bkd-panel').forEach(function (p) { p.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    var panel = document.getElementById('bkd-panel-' + id);
    if (panel) panel.classList.add('active');
  };

  // ── Glossary search ────────────────────────────────────────────────────────
  window.filterGlossary = function (q) {
    var terms = document.querySelectorAll('.bkd-term');
    var lower = q.toLowerCase();
    terms.forEach(function (el) {
      var matches = !lower || el.dataset.term.includes(lower);
      el.style.display = matches ? '' : 'none';
    });
  };

  // ── Full-screen overlay ───────────────────────────────────────────────────
  window.openBookOverlay = function (url) {
    var overlay = document.getElementById('book-overlay');
    var frame   = document.getElementById('book-overlay-frame');
    var extLink = document.getElementById('book-overlay-ext');
    var title   = document.getElementById('book-overlay-title');
    if (!overlay || !frame) return;
    frame.src  = url;
    extLink.href = url;
    title.textContent = document.title.replace(' — LLM KB', '');
    overlay.hidden = false;
    requestAnimationFrame(function () { overlay.classList.add('book-overlay--visible'); });
    document.body.style.overflow = 'hidden';
  };

  window.closeBookOverlay = function () {
    var overlay = document.getElementById('book-overlay');
    var frame   = document.getElementById('book-overlay-frame');
    if (!overlay) return;
    overlay.classList.remove('book-overlay--visible');
    document.body.style.overflow = '';
    setTimeout(function () {
      overlay.hidden = true;
      if (frame) frame.src = '';
    }, 280);
  };

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') window.closeBookOverlay();
  });
})();
</script>`;

  res.send(await render('book-detail.html', {
    pageTitle:  `${bk.title} — LLM KB`,
    activeNav:  'books',
    bookDetailHtml: pageHtml,
  }));
  } catch (err) {
    console.error('[bookDetail] Error:', err);
    res.status(500).send(`<pre>${err.stack}</pre>`);
  }
});

export default router;
