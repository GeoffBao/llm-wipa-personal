function joinUrl(baseUrl, path) {
  return `${String(baseUrl).replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

function parseSseFrame(frame) {
  const data = frame
    .split('\n')
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice(5).trim())
    .join('\n');
  if (!data || data === '[DONE]') return null;
  try { return JSON.parse(data); } catch { return { text: data }; }
}

async function* readResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/event-stream')) {
    const payload = await response.json();
    const text = payload.choices?.[0]?.message?.content || payload.output_text || '';
    if (text) yield { type: 'delta', text };
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const frames = buffer.split('\n\n');
    buffer = frames.pop() || '';
    for (const frame of frames) {
      const event = parseSseFrame(frame);
      if (!event) continue;
      if (event.type === 'delta') yield event;
      else if (event.choices?.[0]?.delta?.content) yield { type: 'delta', text: event.choices[0].delta.content };
      else yield event;
    }
    if (done) break;
  }
}

export function createHermesClient({
  baseUrl,
  apiKey,
  fetchImpl = globalThis.fetch,
  timeoutMs = 120000,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl is required');

  async function request(path, init = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(joinUrl(baseUrl, path), {
        ...init,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey || ''}`,
          'Content-Type': 'application/json',
          ...(init.headers || {}),
        },
      });
      if (!response.ok) {
        throw new Error(`Hermes API ${response.status}`);
      }
      return response;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Hermes request timed out');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async health() {
      const response = await request('/health');
      return response.json();
    },

    async *streamChat({ messages, conversationId, model = 'hermes-agent', signal } = {}) {
      const response = await request('/chat/completions', {
        method: 'POST',
        signal,
        body: JSON.stringify({
          model,
          messages,
          conversation: conversationId,
          stream: true,
        }),
      });
      yield* readResponse(response);
    },
  };
}
