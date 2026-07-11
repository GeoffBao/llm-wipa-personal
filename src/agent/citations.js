function clean(value, maxLength) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function toCitation(source = {}) {
  const kind = clean(source.kind || 'unknown', 24);
  const slug = clean(source.slug || source.id || source.title || 'source', 180);
  const title = clean(source.title || slug, 240);
  return {
    id: `${kind}:${slug}`,
    title,
    slug,
    excerpt: clean(source.excerpt || source.snippet || source.summary || source.text || source.body, 420),
    kind,
    score: Number.isFinite(Number(source.score)) ? Number(source.score) : null,
  };
}
