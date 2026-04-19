import MiniSearch from 'minisearch';

// CJK-aware tokenizer: insert spaces around each CJK codepoint
function cjkTokenize(text) {
  return text
    .replace(/([\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af])/g, ' $1 ')
    .split(/\s+/)
    .filter(t => t.length > 0);
}

const searchIndex = new MiniSearch({
  fields: ['title', 'tags', 'body'],
  storeFields: ['title', 'slug', 'section', 'type', 'tags'],
  searchOptions: {
    boost: { title: 3, tags: 2, body: 1 },
    fuzzy: 0.2,
    prefix: true,
    combineWith: 'OR',
  },
  tokenize: cjkTokenize,
  processTerm: term => term.toLowerCase(),
});

function stripMarkdown(md) {
  return md
    .replace(/\[\[([^\]|]+)\|?([^\]]*)\]\]/g, (_, t, d) => d || t)
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
    .replace(/`[^`]+`/g, '')
    .replace(/^>\s+.*/gm, '')  // strip blockquote metadata lines
    .replace(/\|[^|\n]+\|/g, '')
    .replace(/!\[\[[^\]]+\]\]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/-{3,}/g, '')
    .trim();
}

export function buildSearchIndex(allFiles) {
  searchIndex.removeAll();
  const docs = allFiles.map(f => ({
    id: f.slug,
    title: f.title,
    tags: (f.meta.tags || []).join(' '),
    body: stripMarkdown(f.body).slice(0, 5000),
    slug: f.slug,
    section: f.section,
    type: f.meta.type || f.section,
  }));
  searchIndex.addAll(docs);
  console.log(`[search] Indexed ${docs.length} documents`);
}

export function updateSearchDoc(file) {
  try { searchIndex.remove({ id: file.slug }); } catch (_) {}
  searchIndex.add({
    id: file.slug,
    title: file.title,
    tags: (file.meta.tags || []).join(' '),
    body: stripMarkdown(file.body).slice(0, 5000),
    slug: file.slug,
    section: file.section,
    type: file.meta.type || file.section,
  });
}

export function removeSearchDoc(slug) {
  try { searchIndex.remove({ id: slug }); } catch (_) {}
}

export function search(query, limit = 20) {
  if (!query || query.trim().length === 0) return [];
  return searchIndex.search(query, { limit });
}

export function autocomplete(query, limit = 5) {
  if (!query || query.trim().length === 0) return [];
  return searchIndex.search(query, { limit, fuzzy: 0.15, prefix: true });
}
