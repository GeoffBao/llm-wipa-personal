import { KB_BASE_URL } from '../config.js';

export async function searchWiki(query, limit = 6) {
  const url = `${KB_BASE_URL}/api/search?q=${encodeURIComponent(query)}`;

  let results;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    results = await res.json();
  } catch (err) {
    return `Failed to reach KB server (${KB_BASE_URL}): ${err.message}\nMake sure llm-wipa is running.`;
  }

  const top = results.slice(0, limit ?? 6);
  if (!top.length) return 'No matching wiki articles found. Try different keywords.';

  const lines = top.map((r, i) =>
    `[W${i + 1}] ${r.title}  (${r.section})  → use read_wiki_article("${r.title}") for full content`
  );

  return `Wiki search results (${top.length}):\n\n${lines.join('\n')}`;
}
