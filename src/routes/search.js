import { Router } from 'express';
import { search, autocomplete } from '../search/index.js';
import { getFile, getAllFiles } from '../vault/loader.js';
import { render } from '../render/template.js';
import { parseQuery, applyFilters } from '../search/parser.js';

const router = Router();

router.get('/search', async (req, res) => {
  const rawQ = (req.query.q || '').trim();
  const { text, tags, sections, since } = parseQuery(rawQ);

  // Run full-text search on plain text (or all files when only filters given)
  let results = text ? search(text, 60) : [];

  // If no text but filters present, start from all files
  if (!text && (tags.length || sections.length || since)) {
    results = getAllFiles().map(f => ({ slug: f.slug, title: f.title, section: f.section }));
  }

  // Post-filter: attach meta for filter evaluation
  const withMeta = results.map(r => {
    const file = getFile(r.slug);
    return file ? { ...r, meta: file.meta } : r;
  });
  const filtered = applyFilters(withMeta, { tags, sections, since });

  // Active filter chips (rendered inline as tag-like pills with remove links)
  const activeFilters = [
    ...tags.map(t => ({ label: `tag:${t}`, remove: rawQ.replace(new RegExp(`\\btag:${t}\\b`, 'i'), '').trim() })),
    ...sections.map(s => ({ label: `section:${s}`, remove: rawQ.replace(new RegExp(`\\bsection:${s}\\b`, 'i'), '').trim() })),
    ...(since ? [{ label: `since:${since}`, remove: rawQ.replace(new RegExp(`\\bsince:${since}\\b`, 'i'), '').trim() }] : []),
  ];
  const filterChipsHtml = activeFilters.length
    ? `<div class="search-filter-chips">${activeFilters.map(f =>
        `<a class="search-filter-chip active" href="/search?q=${encodeURIComponent(f.remove)}">${escapeHtml(f.label)} <span class="chip-remove">×</span></a>`
      ).join('')}</div>`
    : '';

  // Suggested filter chips from result set (top 5 tags, top sections)
  const suggestedChips = buildSuggestedChips(filtered, rawQ, tags, sections);

  // Result HTML
  const resultsHtml = filtered.length
    ? filtered.slice(0, 30).map(r => {
        const file = getFile(r.slug);
        const excerpt = file ? extractExcerpt(file.body, text || rawQ) : '';
        const fileTags = (file?.meta?.tags || []).slice(0, 3)
          .map(t => `<a class="tag" href="/search?q=${encodeURIComponent(`${rawQ} tag:${t}`.trim())}">${escapeHtml(t)}</a>`)
          .join('');
        return `
          <div class="search-result">
            <div class="search-result-title">
              <a href="/wiki/${r.slug}">${escapeHtml(r.title)}</a>
              <span class="tag">${escapeHtml(r.section)}</span>
            </div>
            ${fileTags ? `<div class="search-result-tags">${fileTags}</div>` : ''}
            ${excerpt ? `<div class="search-result-excerpt">${excerpt}</div>` : ''}
          </div>`;
      }).join('')
    : rawQ ? '<p class="search-empty">No results found.</p>' : '';

  // Operator hint shown when query has no operators
  const hasOperators = tags.length || sections.length || since;
  const hintHtml = (!hasOperators && rawQ)
    ? `<div class="search-op-hint">Tip: narrow results with <code>tag:pkm</code> · <code>section:concepts</code> · <code>since:2026-01</code></div>`
    : '';

  res.send(await render('search.html', {
    pageTitle: rawQ ? `Search: ${rawQ} — LLM KB` : 'Search — LLM KB',
    query: rawQ,
    resultCount: filtered.length,
    results: resultsHtml,
    filterChips: filterChipsHtml,
    suggestedChips,
    hintHtml,
    activeNav: 'search',
  }));
});

export default router;

// ── Helpers ────────────────────────────────────────────────────────────────

function buildSuggestedChips(results, rawQ, activeTags, activeSections) {
  const tagFreq = new Map();
  const sectionFreq = new Map();
  for (const r of results) {
    const file = getFile(r.slug);
    (file?.meta?.tags || []).forEach(t => tagFreq.set(t, (tagFreq.get(t) || 0) + 1));
    const s = r.section;
    sectionFreq.set(s, (sectionFreq.get(s) || 0) + 1);
  }

  const topTags = [...tagFreq.entries()]
    .filter(([t]) => !activeTags.includes(t.toLowerCase()))
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([t, c]) =>
      `<a class="search-filter-chip" href="/search?q=${encodeURIComponent(`${rawQ} tag:${t}`.trim())}">tag:${escapeHtml(t)} <span class="chip-count">${c}</span></a>`
    );

  const topSections = [...sectionFreq.entries()]
    .filter(([s]) => !activeSections.some(a => s.startsWith(a) || a.startsWith(s)))
    .sort((a, b) => b[1] - a[1]).slice(0, 4)
    .map(([s, c]) =>
      `<a class="search-filter-chip" href="/search?q=${encodeURIComponent(`${rawQ} section:${s}`.trim())}">section:${escapeHtml(s)} <span class="chip-count">${c}</span></a>`
    );

  const chips = [...topSections, ...topTags];
  return chips.length
    ? `<div class="search-filter-chips suggest">${chips.join('')}</div>`
    : '';
}

function extractExcerpt(body, query) {
  const plain = body.replace(/\[\[([^\]|]+)\|?([^\]]*)\]\]/g, (_, t, d) => d || t)
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*{1,2}/g, '')
    .replace(/^>\s+.*/gm, '')
    .replace(/\n+/g, ' ')
    .trim();

  if (!query) return escapeHtml(plain.slice(0, 150)) + '…';

  const lower = plain.toLowerCase();
  const qLower = query.toLowerCase();
  const idx = lower.indexOf(qLower);
  if (idx === -1) return escapeHtml(plain.slice(0, 150)) + '…';

  const start = Math.max(0, idx - 60);
  const end = Math.min(plain.length, idx + query.length + 100);
  const excerpt = (start > 0 ? '…' : '') + plain.slice(start, end) + (end < plain.length ? '…' : '');

  return escapeHtml(excerpt).replace(
    new RegExp(escapeRegex(query), 'gi'),
    m => `<strong>${m}</strong>`
  );
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
