import { Router } from 'express';
import { getFilesBySection, getFilesByTag } from '../vault/loader.js';
import { render } from '../render/template.js';
import { SECTION_LABELS } from '../../config.js';

const router = Router();

// IMPORTANT: specific route must come before /:section wildcard
router.get('/browse/tags/:tag', async (req, res) => {
  const { tag } = req.params;
  const files = getFilesByTag(tag).sort((a, b) => a.title.localeCompare(b.title, 'zh-Hans'));

  const itemsHtml = files.map(f => `
    <div class="browse-item">
      <a href="/wiki/${f.slug}" class="browse-item-title">${f.title}</a>
      <span class="tag">${SECTION_LABELS[f.section] || f.section}</span>
      ${f.meta.updated ? `<span class="browse-item-date">${f.meta.updated}</span>` : ''}
    </div>`).join('');

  res.send(await render('browse.html', {
    pageTitle: `#${tag} — LLM KB`,
    sectionLabel: `Tag: #${tag}`,
    section: 'tags',
    count: files.length,
    items: itemsHtml || '<p class="search-empty">No articles with this tag.</p>',
    breadcrumb: `<a href="/">Home</a> › Tags › ${tag}`,
    activeNav: '',
  }));
});

router.get('/browse/:section', async (req, res) => {
  const { section } = req.params;
  const files = getFilesBySection(section).sort((a, b) =>
    a.title.localeCompare(b.title, 'zh-Hans')
  );

  const label = SECTION_LABELS[section] || section;

  if (!files.length && !SECTION_LABELS[section]) {
    return res.status(404).send('Not found');
  }

  const itemsHtml = files.map(f => `
    <div class="browse-item">
      <a href="/wiki/${f.slug}" class="browse-item-title">${f.title}</a>
      ${f.meta.tags?.length ? `<span class="browse-item-tags">${f.meta.tags.slice(0,4).map(t => `<a href="/browse/tags/${t}" class="tag">${t}</a>`).join('')}</span>` : ''}
      ${(f.meta.updated || f.meta.lastreaddate) ? `<span class="browse-item-date">${f.meta.updated || f.meta.lastreaddate}</span>` : ''}
    </div>`).join('') || '<p class="search-empty">No articles in this section.</p>';

  res.send(await render('browse.html', {
    pageTitle: `${label} — LLM KB`,
    sectionLabel: label,
    section,
    count: files.length,
    items: itemsHtml,
    breadcrumb: `<a href="/">Home</a> › ${label}`,
    activeNav: section,
  }));
});

export default router;
