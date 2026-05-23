import { Router } from 'express';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { getAllFiles, getFilesBySection, getAllBooks } from '../vault/loader.js';
import { getBacklinks } from '../vault/backlinks.js';
import { renderMarkdown } from '../render/markdown.js';
import { render } from '../render/template.js';
import { DOMAIN_PORTALS, VAULT_PATH } from '../../config.js';

const router = Router();

router.get('/', async (req, res) => {
  const allFiles = getAllFiles();
  const concepts = getFilesBySection('concepts');
  const mocs = getFilesBySection('mocs');

  const featured = getFeaturedConcept(concepts);
  const recentUpdates = getRecentUpdates(allFiles, 8);
  const didYouKnow = getDidYouKnow(concepts, 5);
  const mocGrid = renderMocGrid(mocs);
  const portals = renderPortals(allFiles);
  const stats = getStats(allFiles);
  const orphans = getOrphans(allFiles, 5);

  const featuredHtml = featured ? renderFeatured(featured) : '';
  const recentHtml = renderRecent(recentUpdates);
  const dykHtml = renderDYK(didYouKnow);
  const indexNav = renderIndexNav(allFiles);
  const orphanNudge = orphans.length ? renderOrphanNudge(orphans) : '';
  const journeyHeatmap = await renderJourneyHeatmap();

  res.send(await render('home.html', {
    pageTitle: "LLM KB — Eason's Knowledge Base",
    featuredConcept: featuredHtml,
    recentUpdates: recentHtml,
    didYouKnow: dykHtml,
    mocGrid,
    portals,
    indexNav,
    orphanNudge,
    journeyHeatmap,
    totalFiles: stats.total,
    totalConcepts: stats.concepts,
    totalSources: stats.sources,
    totalBooks: stats.books,
    lastUpdated: stats.lastUpdated,
    activeNav: 'home',
  }));
});

function getFeaturedConcept(concepts) {
  if (!concepts.length) return null;
  // Stable daily pick: seed by day number
  const dayIdx = Math.floor(Date.now() / 86400000);
  const eligible = concepts.filter(f => f.meta.type !== 'placeholder' && f.body.length > 200);
  if (!eligible.length) return eligible[0] || concepts[0];
  return eligible[dayIdx % eligible.length];
}

function getRecentUpdates(files, n) {
  return [...files]
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, n);
}

function getDidYouKnow(concepts, n) {
  if (!concepts.length) return [];
  const eligible = concepts.filter(f => f.body.length > 100);
  // Stable daily selection seeded by day
  const dayIdx = Math.floor(Date.now() / 86400000);
  const picks = [];
  for (let i = 0; i < n; i++) {
    picks.push(eligible[(dayIdx + i * 37) % eligible.length]);
  }
  return picks.filter(Boolean);
}

function firstSentence(body) {
  // Strip markdown syntax, get first meaningful sentence
  const plain = body
    .replace(/^#{1,6}\s+.+$/gm, '')
    .replace(/\[\[([^\]|]+)\|?([^\]]*)\]\]/g, (_, t, d) => d || t)
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
    .replace(/^>\s+.*/gm, '')
    .replace(/\|[^|\n]+\|/g, '')
    .replace(/\n+/g, ' ')
    .trim();
  const match = plain.match(/^(.{20,200}[。！？.!?])/);
  return match ? match[1] : plain.slice(0, 150);
}

function firstParagraphs(body, n = 3) {
  const paras = body.split(/\n\n+/).filter(p => p.trim() && !p.startsWith('#') && !p.startsWith('|'));
  return paras.slice(0, n).join('\n\n');
}

function countWikilinks(raw) {
  return (raw.match(/\[\[/g) || []).length;
}

function renderFeatured(file) {
  const excerpt = renderMarkdown(firstParagraphs(file.body, 2));
  return `
    <div class="featured-concept">
      <div class="featured-label">Featured Concept</div>
      <h2 class="featured-title"><a href="/wiki/${file.slug}">${file.title}</a></h2>
      <div class="featured-meta">
        ${file.meta.updated ? `<span>Updated ${file.meta.updated}</span>` : ''}
        ${(file.meta.tags || []).slice(0, 3).map(t => `<a href="/browse/tags/${t}" class="tag">${t}</a>`).join('')}
      </div>
      <div class="featured-excerpt">${excerpt}</div>
      <a href="/wiki/${file.slug}" class="featured-readmore">Read full article →</a>
    </div>`;
}

function renderRecent(files) {
  if (!files.length) return '<p>Nothing here yet.</p>';
  return files.map(f => {
    const age = timeAgo(f.mtime);
    const sectionLabel = { concepts: 'Concept', sources: 'Source', mocs: 'Map', synthesis: 'Synthesis', prompts: 'Prompt' }[f.section] || f.section;
    return `<div class="recent-item">
      <a href="/wiki/${f.slug}" class="recent-title">${f.title}</a>
      <span class="recent-meta"><span class="tag">${sectionLabel}</span> ${age}</span>
    </div>`;
  }).join('');
}

function renderDYK(concepts) {
  if (!concepts.length) return '<p>Nothing here yet.</p>';
  return concepts.map(f => {
    const sentence = firstSentence(f.body);
    return `<div class="dyk-item">
      <span class="dyk-bullet">•</span>
      <span>…<a href="/wiki/${f.slug}">${f.title}</a>：${sentence}</span>
    </div>`;
  }).join('');
}

function renderMocGrid(mocs) {
  if (!mocs.length) return '<p>No maps found.</p>';
  const sorted = [...mocs].sort((a, b) => {
    const la = (a.meta.level || 'L3');
    const lb = (b.meta.level || 'L3');
    return la.localeCompare(lb);
  });
  return sorted.map(f => {
    const level = f.meta.level || '';
    const status = f.meta.status || '';
    const linkCount = countWikilinks(f.raw);
    return `
      <a href="/wiki/${f.slug}" class="moc-card">
        <div class="moc-card-header">
          ${level ? `<span class="moc-level-badge">${level}</span>` : ''}
          <span class="moc-status">${status}</span>
        </div>
        <div class="moc-card-title">${f.title.replace(' MOC', '')}</div>
        <div class="moc-card-count">${linkCount} linked articles</div>
      </a>`;
  }).join('');
}

function renderPortals(allFiles) {
  return DOMAIN_PORTALS.map(portal => {
    // Find files related to this portal by keywords/tags
    const related = allFiles.filter(f => {
      if (f.section !== 'concepts' && f.section !== 'sources') return false;
      const text = (f.title + ' ' + (f.meta.tags || []).join(' ')).toLowerCase();
      return portal.keywords.some(kw => {
        if (kw.startsWith('moc:')) return false; // handled separately
        return text.includes(kw.toLowerCase());
      });
    }).slice(0, 6);

    const links = related.map(f =>
      `<li><a href="/wiki/${f.slug}">${f.title}</a></li>`
    ).join('');

    return `
      <div class="portal-card">
        <div class="portal-header">
          <span class="portal-icon">${portal.icon}</span>
          <h3 class="portal-title">${portal.title}</h3>
        </div>
        <p class="portal-desc">${portal.description}</p>
        <ul class="portal-links">${links}</ul>
        <a href="/browse/concepts" class="portal-more">More →</a>
      </div>`;
  }).join('');
}

function renderIndexNav(allFiles) {
  const DOMAINS = [
    {
      icon: '🧠', title: 'Methods & PKM', moc: 'pkm-methods-moc',
      keys: ['llm-knowledge-systems-moc', '第二大脑', 'llm-wiki', '知识库自动化'],
    },
    {
      icon: '🤖', title: 'AI & Agents', moc: 'ai-research-moc',
      keys: ['agent-systems-moc', 'agent-operating-system', '多模型编排', 'self-improving-agent'],
    },
    {
      icon: '📷', title: 'Camera & Imaging', moc: 'camera-tech-moc',
      keys: ['camera-performance-moc', 'camera-product-strategy-moc', '计算摄影', '多摄融合'],
    },
  ];

  return DOMAINS.map(domain => {
    const links = domain.keys.map(key => {
      const f = allFiles.find(f => f.slug === key || f.title === key);
      if (!f) return null;
      return `<li><a href="/wiki/${f.slug}">${f.title}</a></li>`;
    }).filter(Boolean).join('');

    return `
      <div class="domain-card">
        <div class="domain-card-header">
          <span class="domain-icon">${domain.icon}</span>
          <a href="/wiki/${domain.moc}" class="domain-title">${domain.title}</a>
        </div>
        <ul class="domain-links">${links}</ul>
      </div>`;
  }).join('');
}

function getOrphans(files, n) {
  const skipSections = new Set(['prompts', 'people', 'mocs']);
  return files
    .filter(f => !skipSections.has(f.section) && getBacklinks(f.title).length === 0 && f.body.length > 50)
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, n);
}

function renderOrphanNudge(files) {
  const sectionLabel = { concepts: 'Concept', sources: 'Source', synthesis: 'Synthesis', notes: 'Note' };
  const items = files.map(f =>
    `<div class="orphan-item">
      <span class="orphan-dot"></span>
      <a href="/wiki/${f.slug}">${f.title}</a>
      <span class="orphan-section">${sectionLabel[f.section] || f.section}</span>
    </div>`
  ).join('');
  return `<div class="orphan-nudge">
    <div class="orphan-nudge-title">No incoming links</div>
    ${items}
  </div>`;
}

function getStats(files) {
  const latest = [...files].sort((a, b) => b.mtime - a.mtime)[0];
  const books = getAllBooks();
  return {
    total: files.length,
    concepts: files.filter(f => f.section === 'concepts').length,
    sources: files.filter(f => f.section === 'sources').length,
    books: books.length,
    lastUpdated: latest ? formatDate(latest.mtime) : '—',
  };
}

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - date) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
  return formatDate(date);
}

function formatDate(date) {
  return new Date(date).toISOString().slice(0, 10);
}

async function renderJourneyHeatmap() {
  const JOURNEY_DIR = join(VAULT_PATH, 'Journey');
  let files;
  try {
    files = await readdir(JOURNEY_DIR);
  } catch {
    return '';
  }

  // Build date → section count map
  const entryMap = new Map();
  for (const filename of files) {
    if (!/^\d{4}-\d{2}-\d{2}\.md$/.test(filename)) continue;
    const date = filename.replace('.md', '');
    try {
      const raw = await readFile(join(JOURNEY_DIR, filename), 'utf8');
      const sections = (raw.match(/^##\s+/gm) || []).length;
      entryMap.set(date, sections);
    } catch { /* skip */ }
  }

  // Build 52-week grid ending today, starting on Sunday
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  // Find the Sunday at or before (today - 363 days)
  const gridEnd = new Date(today);
  const gridStart = new Date(today);
  gridStart.setDate(gridStart.getDate() - 363);
  // Rewind to Sunday
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  // Collect total entries in range
  const totalInYear = [...entryMap.keys()].filter(d => d >= gridStart.toISOString().slice(0, 10) && d <= todayStr).length;

  // Build week columns
  const weeks = [];
  const cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const dateStr = cursor.toISOString().slice(0, 10);
      const isFuture = cursor > today;
      const count = entryMap.get(dateStr) || 0;
      week.push({ date: dateStr, count, isFuture });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  // Month labels: track which column each month label starts at
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthLabels = [];
  let prevMonth = -1;
  weeks.forEach((week, wi) => {
    const firstDay = new Date(week[0].date + 'T12:00:00');
    const m = firstDay.getMonth();
    if (m !== prevMonth) {
      monthLabels.push({ col: wi + 1, label: MONTHS[m] });
      prevMonth = m;
    }
  });

  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  // Level: 0=empty, 1=1, 2=2-3, 3=4-5, 4=6+
  function level(count, isFuture) {
    if (isFuture || count === 0) return 0;
    if (count === 1) return 1;
    if (count <= 3) return 2;
    if (count <= 5) return 3;
    return 4;
  }

  // SVG approach — compact, pixel-perfect
  const CELL = 11, GAP = 2, STEP = CELL + GAP;
  const LEFT_PAD = 28; // space for day labels
  const TOP_PAD = 20;  // space for month labels
  const svgW = LEFT_PAD + weeks.length * STEP;
  const svgH = TOP_PAD + 7 * STEP;

  const monthLabelsSvg = monthLabels.map(({ col, label }) =>
    `<text x="${LEFT_PAD + (col - 1) * STEP}" y="${TOP_PAD - 6}" class="hm-month">${label}</text>`
  ).join('');

  const dayLabelsSvg = [1, 3, 5].map(d =>
    `<text x="${LEFT_PAD - 4}" y="${TOP_PAD + d * STEP + CELL - 2}" class="hm-day">${DAYS[d]}</text>`
  ).join('');

  const cellsSvg = weeks.map((week, wi) =>
    week.map((cell, di) => {
      const x = LEFT_PAD + wi * STEP;
      const y = TOP_PAD + di * STEP;
      const lv = level(cell.count, cell.isFuture);
      const title = cell.count ? `${cell.date}: ${cell.count} section${cell.count > 1 ? 's' : ''}` : cell.date;
      const link = cell.count > 0 ? `<a href="/journey/${cell.date}">` : '';
      const linkClose = cell.count > 0 ? '</a>' : '';
      return `${link}<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" class="hm-cell hm-l${lv}" data-date="${cell.date}" data-count="${cell.count}"><title>${title}</title></rect>${linkClose}`;
    }).join('')
  ).join('');

  const legend = [0,1,2,3,4].map(l =>
    `<rect width="${CELL}" height="${CELL}" rx="2" class="hm-cell hm-l${l}"/>`
  ).join('');

  return `
  <div class="journey-heatmap-wrap">
    <div class="journey-heatmap-header">
      <span class="journey-heatmap-title">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"/><path d="M12 6v6l4 2"/></svg>Journey
      </span>
      <span class="journey-heatmap-count"><strong>${totalInYear}</strong> entries in the last year</span>
      <a href="/journey" class="journey-heatmap-link">View all →</a>
    </div>
    <svg class="journey-heatmap-svg" viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}">
      ${monthLabelsSvg}
      ${dayLabelsSvg}
      ${cellsSvg}
    </svg>
    <div class="journey-heatmap-legend">
      <span class="hm-legend-label">Less</span>
      <svg viewBox="0 0 ${5 * STEP - GAP} ${CELL}" width="${5 * STEP - GAP}" height="${CELL}">${
        [0,1,2,3,4].map((l, i) => `<rect x="${i * STEP}" y="0" width="${CELL}" height="${CELL}" rx="2" class="hm-cell hm-l${l}"/>`).join('')
      }</svg>
      <span class="hm-legend-label">More</span>
    </div>
  </div>`;
}

export default router;
