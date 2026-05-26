import { KB_BASE_URL } from '../config.js';

export async function searchReadwise(query, limit = 6) {
  const k = Math.min(limit ?? 6, 12);
  const url = `${KB_BASE_URL}/api/semantic-search?q=${encodeURIComponent(query)}&k=${k}`;

  let data;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    return `Failed to reach KB server (${KB_BASE_URL}): ${err.message}\nMake sure llm-wipa is running.`;
  }

  if (!data.ready) {
    return 'Semantic index not ready yet. The server may still be loading the vector store.';
  }

  const results = data.results ?? [];
  if (!results.length) return 'No relevant Readwise articles found for this query.';

  const lines = results.map((r, i) => {
    const score = `${(r.score * 100).toFixed(0)}%`;
    const meta = [r.author, r.category, score].filter(Boolean).join(' · ');
    const url = r.url ? `\n   ${r.url}` : '';
    const summary = r.summary ? `\n   ${r.summary}` : '';
    return `[R${i + 1}] "${r.title}" (${meta})${url}${summary}`;
  });

  return `Readwise results (${results.length}):\n\n${lines.join('\n\n')}`;
}
