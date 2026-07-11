import { Router } from 'express';
import OpenAI from 'openai';
import {
  CHAT_API_KEY,
  CHAT_BASE_URL,
  CHAT_MODEL,
  HERMES_API_KEY,
  HERMES_API_URL,
  HERMES_TIMEOUT_MS,
  VAULT_PATH,
} from '../../config.js';
import { buildReadingContext } from '../agent/context.js';
import { buildAgentContext } from '../agent/retrievalContext.js';
import { runDefaultAgent } from '../agent/defaultAgent.js';
import { createHermesClient } from '../agent/hermesClient.js';
import { approveMemoryCandidate, createMemoryCandidate, createVaultWriter } from '../agent/writeback.js';
import { getFile } from '../vault/loader.js';
import { search as keywordSearch } from '../search/index.js';
import {
  isReady,
  isWikiReady,
  semanticSearch,
  wikiSemanticSearch,
} from '../search/vectorStore.js';

function createWipaModel({ client, model }) {
  return async function* wipaModel({ messages }) {
    const stream = await client.chat.completions.create({ model, messages, stream: true, max_tokens: 2048 });
    for await (const chunk of stream) {
      const text = chunk.choices?.[0]?.delta?.content;
      if (text) yield { type: 'delta', text };
    }
  };
}

function defaultSearchers() {
  return {
    wiki: async query => {
      if (!isWikiReady()) return [];
      const hits = await wikiSemanticSearch(query, 8);
      return hits
        .filter(hit => hit.score >= 0.65)
        .map(hit => ({ ...hit, kind: 'wiki', excerpt: hit.text || hit.snippet }));
    },
    readwise: async query => {
      if (!isReady()) return [];
      return (await semanticSearch(query, 6))
        .filter(hit => hit.score >= 0.78)
        .map(hit => ({ ...hit, kind: 'readwise', excerpt: hit.summary }));
    },
    keyword: async query => keywordSearch(query, 8),
  };
}

function writeEvent(res, event, payload) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

export function createAgentRouter({
  fileLoader = getFile,
  searchers = defaultSearchers(),
  wipaModel,
  hermes,
  vaultPath = VAULT_PATH,
  candidateStore = new Map(),
  vaultWriter = createVaultWriter({ vaultPath }),
} = {}) {
  const router = Router();
  let resolvedWipaModel = wipaModel;
  const getWipaModel = () => {
    if (resolvedWipaModel) return resolvedWipaModel;
    const modelClient = new OpenAI({
      apiKey: CHAT_API_KEY || process.env.CHAT_API_KEY || '',
      baseURL: CHAT_BASE_URL || process.env.CHAT_BASE_URL || 'https://api.deepseek.com/v1',
    });
    resolvedWipaModel = createWipaModel({ client: modelClient, model: CHAT_MODEL || 'deepseek-v4-flash' });
    return resolvedWipaModel;
  };
  const resolvedHermes = hermes || (HERMES_API_KEY
    ? createHermesClient({ baseUrl: HERMES_API_URL, apiKey: HERMES_API_KEY, timeoutMs: HERMES_TIMEOUT_MS })
    : null);

  router.get('/api/agent/health', async (_req, res) => {
    let hermesStatus = { available: false };
    if (resolvedHermes) {
      try {
        await resolvedHermes.health();
        hermesStatus = { available: true };
      } catch (error) {
        hermesStatus = { available: false, reason: error.message };
      }
    }
    res.json({
      vault: { available: Boolean(vaultPath) },
      retrieval: { wikiReady: isWikiReady(), readwiseReady: isReady() },
      hermes: hermesStatus,
    });
  });

  router.post('/api/agent/memory-candidates', (req, res) => {
    try {
      const candidate = createMemoryCandidate(req.body || {});
      candidateStore.set(candidate.id, candidate);
      res.status(201).json(candidate);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/api/agent/memory-candidates/:id/approve', async (req, res) => {
    const candidate = candidateStore.get(req.params.id);
    if (!candidate) return res.status(404).json({ error: 'candidate not found' });
    try {
      const result = await approveMemoryCandidate(candidate, vaultWriter);
      res.json({ candidate, result });
    } catch (error) {
      res.status(502).json({ error: error.message, candidate });
    }
  });

  router.post('/api/agent/query', async (req, res) => {
    const {
      messages,
      slug = '',
      selectedText = '',
      mode = 'query',
      conversationId = '',
      confirmed = false,
    } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages required' });
    }
    if (!['query', 'execute'].includes(mode)) {
      return res.status(400).json({ error: 'invalid mode' });
    }
    if (mode === 'execute' && confirmed !== true) {
      return res.status(409).json({ error: 'confirmation_required' });
    }

    let readingContext;
    try {
      readingContext = await buildReadingContext({ slug, selectedText, messages, fileLoader });
    } catch (error) {
      return res.status(404).json({ error: error.message });
    }

    const lastUser = [...messages].reverse().find(message => message?.role === 'user');
    const query = String(lastUser?.content || '');
    let agentContext;
    try {
      agentContext = await buildAgentContext({ query, readingContext, searchers });
    } catch (error) {
      return res.status(503).json({ error: 'retrieval unavailable', detail: error.message });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    writeEvent(res, 'status', { phase: 'retrieving' });
    for (const citation of agentContext.citations) writeEvent(res, 'citation', citation);

    try {
      for await (const event of runDefaultAgent(
        { mode, messages, context: agentContext, conversationId },
        { wipaModel: getWipaModel(), hermes: resolvedHermes },
      )) {
        if (event.type === 'delta') writeEvent(res, 'delta', { text: event.text });
        else if (event.type === 'done') writeEvent(res, 'done', { hasEvidence: agentContext.retrievalStatus.hasEvidence });
        else writeEvent(res, event.type || 'status', event);
      }
    } catch (error) {
      writeEvent(res, 'error', { message: 'Agent backend unavailable', detail: error.message });
    } finally {
      res.end();
    }
  });

  return router;
}

export default createAgentRouter();
