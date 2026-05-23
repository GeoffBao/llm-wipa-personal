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

  res.send(await render('home.html', {
    pageTitle: "LLM KB — Eason's Knowledge Base",
    featuredConcept: featuredHtml,
    recentUpdates: recentHtml,
    didYouKnow: dykHtml,
    mocGrid,
    portals,
    indexNav,
    orphanNudge,
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

export default router;
