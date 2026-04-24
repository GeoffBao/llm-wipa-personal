/**
 * Parse search operator tokens out of a raw query string.
 *
 * Supported operators:
 *   tag:agent         → filter by tag (substring match)
 *   section:concepts  → filter by section slug (or label prefix)
 *   since:2026-01     → filter to notes updated on or after YYYY-MM or YYYY-MM-DD
 *
 * Returns { text, tags, sections, since }
 * where `text` is the remaining plain query sent to MiniSearch.
 */
export function parseQuery(raw) {
  const tokens = raw.trim().split(/\s+/);
  const plain = [];
  const tags = [];
  const sections = [];
  let since = null;

  for (const tok of tokens) {
    const lower = tok.toLowerCase();
    if (lower.startsWith('tag:')) {
      const v = tok.slice(4).toLowerCase();
      if (v) tags.push(v);
    } else if (lower.startsWith('section:')) {
      const v = tok.slice(8).toLowerCase();
      if (v) sections.push(v);
    } else if (lower.startsWith('since:')) {
      const v = tok.slice(6);
      if (v) since = v;
    } else {
      plain.push(tok);
    }
  }

  return { text: plain.join(' '), tags, sections, since };
}

/**
 * Apply parsed filters to a list of vault files (or search result stubs
 * that have .meta.tags, .section, .meta.updated, .meta.created).
 */
export function applyFilters(files, { tags, sections, since }) {
  let out = files;

  if (tags.length) {
    out = out.filter(f => {
      const fileTags = (f.meta?.tags || f.tags || []).map(t => t.toLowerCase());
      return tags.every(t => fileTags.some(ft => ft.includes(t)));
    });
  }

  if (sections.length) {
    out = out.filter(f => {
      const sec = (f.section || '').toLowerCase();
      return sections.some(s => sec.startsWith(s) || s.startsWith(sec));
    });
  }

  if (since) {
    const sinceDate = new Date(since);
    if (!isNaN(sinceDate)) {
      out = out.filter(f => {
        const d = f.meta?.updated || f.meta?.created;
        if (!d) return false;
        return new Date(d) >= sinceDate;
      });
    }
  }

  return out;
}
