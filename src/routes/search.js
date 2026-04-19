import { Router } from 'express';
import { search, autocomplete } from '../search/index.js';
import { getFile } from '../vault/loader.js';
import { render } from '../render/template.js';

const router = Router();

router.get('/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  const results = q ? search(q, 30) : [];

  const resultsHtml = results.length
    ? results.map(r => {
        const file = getFile(r.slug);
        const excerpt = file ? extractExcerpt(file.body, q) : '';
        return `
          <div class="search-result">
            <div class="search-result-title">
              <a href="/wiki/${r.slug}">${r.title}</a>
              <span class="tag">${r.section}</span>
            </div>
            ${excerpt ? `<div class="search-result-excerpt">${excerpt}</div>` : ''}
          </div>`;
      }).join('')
    : q ? '<p class="search-empty">No results found.</p>' : '';

  res.send(await render('search.html', {
    pageTitle: q ? `Search: ${q} — LLM KB` : 'Search — LLM KB',
    query: q,
    resultCount: results.length,
    results: resultsHtml,
    activeNav: 'search',
  }));
});

export default router;

function extractExcerpt(body, query) {
  const plain = body.replace(/\[\[([^\]|]+)\|?([^\]]*)\]\]/g, (_, t, d) => d || t)
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*{1,2}/g, '')
    .replace(/^>\s+.*/gm, '')
    .replace(/\n+/g, ' ')
    .trim();

  if (!query) return plain.slice(0, 150) + '…';

  // Find query position for context window
  const lower = plain.toLowerCase();
  const qLower = query.toLowerCase();
  const idx = lower.indexOf(qLower);
  if (idx === -1) return plain.slice(0, 150) + '…';

  const start = Math.max(0, idx - 60);
  const end = Math.min(plain.length, idx + query.length + 100);
  const excerpt = (start > 0 ? '…' : '') + plain.slice(start, end) + (end < plain.length ? '…' : '');

  // Bold the matching term
  return excerpt.replace(
    new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
    m => `<strong>${m}</strong>`
  );
}
