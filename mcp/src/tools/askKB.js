import { KB_BASE_URL } from '../config.js';

/**
 * Full RAG query: calls /api/chat (SSE stream), aggregates the response,
 * and appends a source list at the end.
 */
export async function askKB(question, useWiki = true) {
  let res;
  try {
    res = await fetch(`${KB_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: question }],
        useWiki,
        model: 'deepseek-v4-flash',
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    return `Failed to reach KB server (${KB_BASE_URL}): ${err.message}\nMake sure llm-wipa is running.`;
  }

  if (!res.ok) return `Chat API error: HTTP ${res.status}`;

  // Consume SSE stream
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let fullContent = '';
  let rawSources = [];
  let wikiSources = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (!raw) continue;
      try {
        const evt = JSON.parse(raw);
        if (evt.type === 'sources') {
          rawSources = evt.rawSources ?? [];
          wikiSources = evt.wikiSources ?? [];
        } else if (evt.type === 'delta') {
          fullContent += evt.content;
        } else if (evt.type === 'error') {
          return `KB error: ${evt.message}`;
        }
      } catch { /* skip bad JSON */ }
    }
  }

  if (!fullContent) return 'No response generated.';

  // Append source list
  const srcLines = [
    ...rawSources.map((s, i) => `[R${i + 1}] "${s.title}" by ${s.author ?? '?'} (${s.category ?? ''})`),
    ...wikiSources.map((w, i) => `[W${i + 1}] [[${w.title}]] (${w.section ?? 'wiki'})`),
  ];

  return srcLines.length
    ? `${fullContent}\n\n---\n**Sources used:**\n${srcLines.join('\n')}`
    : fullContent;
}
