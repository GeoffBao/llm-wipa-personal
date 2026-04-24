import { Router } from 'express';
import { SECTION_LABELS } from '../../config.js';
import { getFile, getAllFiles } from '../vault/loader.js';
import { getBacklinks } from '../vault/backlinks.js';
import { renderMarkdown } from '../render/markdown.js';
import { extractTOC, renderTOC } from '../render/toc.js';
import { render } from '../render/template.js';
import { search } from '../search/index.js';

const router = Router();

router.get('/wiki/:slug', async (req, res) => {
  const file = getFile(req.params.slug);
  if (!file) {
    // Try suggestions
    const suggestions = search(req.params.slug.replace(/-/g, ' '), 5);
    return res.status(404).send(await render('404.html', {
      title: 'Page Not Found',
      slug: req.params.slug,
      suggestions: renderSuggestions(suggestions),
      pageTitle: '404 — Page Not Found',
      activeNav: '',
    }));
  }

  const html = renderMarkdown(file.body, file.filepath);
  const toc = extractTOC(html);
  const tocHtml = renderTOC(toc);
  const backlinks = getBacklinks(file.title);
  const infobox = renderInfobox(file.meta);
  const breadcrumb = renderBreadcrumb(file);
  const backlinksHtml = renderBacklinksHtml(backlinks);
  const tagBadges = renderTagBadges(file.meta.tags || []);
  const sectionLabel = sectionLabels[file.section] || file.section;

  const html_out = await render('article.html', {
    pageTitle: `${file.title} — LLM KB`,
    title: file.title,
    slug: file.slug,
    sectionLabel,
    breadcrumb,
    infobox,
    toc: tocHtml,
    content: html,
    backlinks: backlinksHtml,
    backlinksCount: backlinks.length,
    hasBacklinks: backlinks.length > 0,
    hasToc: !!tocHtml,
    tagBadges,
    updatedAt: file.meta.updated || '',
    activeNav: file.section,
    hasSide: !!(infobox || tocHtml),
  });

  res.send(html_out);
});

const sectionLabels = SECTION_LABELS;

function renderInfobox(meta) {
  if (!meta.type && !meta.created && !meta.updated) return '';
  const rows = [];
  if (meta.type) rows.push(['Type', capitalize(meta.type)]);
  if (meta.level) rows.push(['Level', meta.level]);
  if (meta.status) rows.push(['Status', meta.status]);
  if (meta.author) rows.push(['Author', meta.author]);
  if (meta.category) rows.push(['Category', meta.category]);
  if (meta.created) rows.push(['Created', meta.created]);
  if (meta.updated) rows.push(['Updated', meta.updated]);

  const rowsHtml = rows.map(([k, v]) =>
    `<tr><th>${k}</th><td>${v}</td></tr>`
  ).join('');

  return `<table class="article-infobox"><tbody>${rowsHtml}</tbody></table>`;
}

function renderBreadcrumb(file) {
  const label = sectionLabels[file.section] || file.section;
  return `<a href="/">Home</a> › <a href="/browse/${file.section}">${label}</a> › ${file.title}`;
}

function renderBacklinksHtml(backlinks) {
  if (!backlinks.length) return '';
  const links = backlinks.slice(0, 10).map(f =>
    `<li><a href="/wiki/${f.slug}" class="wikilink">${f.title}</a></li>`
  ).join('');
  const more = backlinks.length > 10
    ? `<li class="backlinks-more">…${backlinks.length} total</li>` : '';
  return `<ul class="backlinks-list">${links}${more}</ul>`;
}

function renderTagBadges(tags) {
  if (!tags.length) return '';
  return tags.map(t =>
    `<a href="/browse/tags/${encodeURIComponent(t)}" class="tag">${t}</a>`
  ).join('');
}

function renderSuggestions(results) {
  if (!results.length) return '<p>No related pages found.</p>';
  const items = results.map(r =>
    `<li><a href="/wiki/${r.slug}">${r.title}</a> <span class="tag">${r.section}</span></li>`
  ).join('');
  return `<p>Did you mean:</p><ul>${items}</ul>`;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default router;
