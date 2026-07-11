import { KB_BASE_URL } from '../config.js';

/**
 * Knowledge Gateway query: calls the default Reading Agent SSE endpoint,
 * aggregates the response, and appends citation metadata.
 */
export async function askKB(question, useWiki = true) {
  let res;
  try {
    res = await fetch(`${KB_BASE_URL}/api/agent/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: question }],
        mode: 'query',
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    return `Failed to reach KB server (${KB_BASE_URL}): ${err.message}\nMake sure llm-wipa is running.`;
  }

  if (!res.ok) return `Reading Agent API error: HTTP ${res.status}`;

  // Consume SSE stream
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let fullContent = '';
  const citations = [];

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
        if (evt.type === 'delta') {
          fullContent += evt.text || '';
        } else if (evt.type === 'citation') {
          citations.push(evt);
        } else if (evt.type === 'error') {
          return `KB error: ${evt.message}`;
        }
      } catch { /* skip bad JSON */ }
    }
  }

  if (!fullContent) return 'No response generated.';

  // Append source list
  const srcLines = citations.map(source => `[${source.kind ?? 'source'}] "${source.title}" — ${source.excerpt ?? ''}`);

  return srcLines.length
    ? `${fullContent}\n\n---\n**Sources used:**\n${srcLines.join('\n')}`
    : fullContent;
}
