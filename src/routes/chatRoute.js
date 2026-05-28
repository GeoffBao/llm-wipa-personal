/**
 * /chat  — Chat with your knowledge base
 * Uses semantic search (Raw layer) + Wiki files for context,
 * then streams a DeepSeek response via SSE.
 */

import { Router } from 'express';
import { render } from '../render/template.js';
import { semanticSearch, isReady } from '../search/vectorStore.js';
import { getFile } from '../vault/loader.js';
import { search as wikiSearch } from '../search/index.js';
import OpenAI from 'openai';
import { CHAT_API_KEY, CHAT_BASE_URL, CHAT_MODEL } from '../../config.js';

const router = Router();

const client = new OpenAI({
  apiKey: CHAT_API_KEY || process.env.CHAT_API_KEY || '',
  baseURL: CHAT_BASE_URL || process.env.CHAT_BASE_URL || 'https://api.deepseek.com/v1',
});
const DEFAULT_MODEL = CHAT_MODEL || 'deepseek-v4-flash';

// ── Shell page ────────────────────────────────────────────────────────────────
router.get('/chat', async (req, res) => {
  const embed = req.query.embed === '1';
  const initialQuery = req.query.q ? String(req.query.q) : '';
  res.send(await render('chat.html', {
    pageTitle: 'Chat — LLM KB',
    activeNav: 'chat',
    vectorReady: isReady() ? 'true' : 'false',
    vectorCount: String(isReady() ? 2422 : 0),
    model: DEFAULT_MODEL,
    embed: embed ? 'true' : '',
    initialQuery: initialQuery,
  }));
});

// ── Streaming chat API ────────────────────────────────────────────────────────
router.post('/api/chat', async (req, res) => {
  const { messages, useWiki = true, model } = req.body || {};
  const chatModel = model || DEFAULT_MODEL;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages required' });
  }

  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
  let query = lastUserMsg?.content || '';

  // Parse @wiki:slug and @readwise:term mentions
  const wikiMentionSlugs = [...query.matchAll(/@wiki:([^\s]+)/gi)].map(m => m[1]);
  const readwiseTerms = [...query.matchAll(/@readwise:([^\s]+)/gi)].map(m => m[1]);
  const cleanQuery = query.replace(/@(wiki|readwise):[^\s]+/gi, '').trim() || query;

  // ── 1. Semantic search over Raw Readwise layer ──
  let rawSources = [];
  if (isReady() && cleanQuery) {
    const searchQ = readwiseTerms.length ? readwiseTerms.join(' ') : cleanQuery;
    const hits = await semanticSearch(searchQ, 6);
    rawSources = hits.filter(h => h.score >= 0.78);
  }

  // ── 2. Wiki full-text search (MiniSearch) + @wiki mentions ──
  let wikiSources = [];
  if (useWiki) {
    // Explicit @wiki:slug mentions get added first
    for (const slug of wikiMentionSlugs) {
      const f = getFile(slug);
      if (f && !wikiSources.find(w => w.slug === f.slug)) {
        wikiSources.push({ title: f.title, slug: f.slug, section: f.section, body: f.body?.slice(0, 1800) });
      }
    }
    // MiniSearch full-text search: title + tags + body, CJK-aware, fuzzy
    if (cleanQuery) {
      const hits = wikiSearch(cleanQuery, 8);
      for (const hit of hits) {
        if (wikiSources.find(w => w.slug === hit.slug)) continue;
        const f = getFile(hit.slug);
        if (!f) continue;
        wikiSources.push({ title: f.title, slug: f.slug, section: f.section, body: f.body?.slice(0, 1800) });
      }
    }
    wikiSources = wikiSources.slice(0, 6);
  }

  // ── 3. Build context block ──
  const contextParts = [];

  if (rawSources.length > 0) {
    contextParts.push('## 相关 Readwise 内容\n' +
      rawSources.map((s, i) =>
        `[R${i + 1}] 《${s.title}》 by ${s.author || '未知'} (${s.category})\n${s.summary}`
      ).join('\n\n')
    );
  }

  if (wikiSources.length > 0) {
    contextParts.push('## 相关 Wiki 知识\n' +
      wikiSources.map((w, i) =>
        `[W${i + 1}] [[${w.title}]] (${w.section})\n${w.body || ''}`
      ).join('\n\n')
    );
  }

  const systemPrompt = `你是 Eason 的个人知识库助手。基于以下从知识库中检索到的内容回答问题。

优先使用知识库内容作答；若知识库内容不足，可补充通用知识，但需明确说明。
引用来源时用 [R1]、[R2] 表示 Readwise 原料，[W1]、[W2] 表示 Wiki 节点。
回答简洁、有结构，使用 Markdown 格式。

${contextParts.length > 0 ? contextParts.join('\n\n') : '（当前无相关知识库内容检索到，请基于通用知识回答）'}`;

  // ── 4. SSE stream ──
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send sources metadata first
  res.write(`data: ${JSON.stringify({
    type: 'sources',
    rawSources: rawSources.map(s => ({ title: s.title, author: s.author, url: s.url, category: s.category, score: s.score, summary: s.summary })),
    wikiSources: wikiSources.map(w => ({ title: w.title, slug: w.slug, section: w.section })),
  })}\n\n`);

  try {
    const stream = await client.chat.completions.create({
      model: chatModel,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      stream: true,
      max_tokens: 2048,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        res.write(`data: ${JSON.stringify({ type: 'delta', content: delta })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
  } finally {
    res.end();
  }
});

export default router;
