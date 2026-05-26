/**
 * /chat  — Chat with your knowledge base
 * Uses semantic search (Raw layer) + Wiki files for context,
 * then streams a DeepSeek response via SSE.
 */

import { Router } from 'express';
import { render } from '../render/template.js';
import { semanticSearch, isReady } from '../search/vectorStore.js';
import { getAllFiles, getFile } from '../vault/loader.js';
import OpenAI from 'openai';

const router = Router();

const client = new OpenAI({
  apiKey: process.env.CHAT_API_KEY || '',
  baseURL: process.env.CHAT_BASE_URL || 'https://api.deepseek.com/v1',
});
const MODEL = process.env.CHAT_MODEL || 'deepseek-chat';

// ── Shell page ────────────────────────────────────────────────────────────────
router.get('/chat', async (req, res) => {
  res.send(await render('chat.html', {
    pageTitle: 'Chat — LLM KB',
    activeNav: 'chat',
    vectorReady: isReady() ? 'true' : 'false',
    vectorCount: String(isReady() ? 2422 : 0),
    model: MODEL,
  }));
});

// ── Streaming chat API ────────────────────────────────────────────────────────
router.post('/api/chat', async (req, res) => {
  const { messages, useWiki = true } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages required' });
  }

  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
  const query = lastUserMsg?.content || '';

  // ── 1. Semantic search over Raw Readwise layer ──
  let rawSources = [];
  if (isReady() && query) {
    const hits = await semanticSearch(query, 6);
    rawSources = hits.filter(h => h.score >= 0.78);
  }

  // ── 2. Wiki keyword search (title match) ──
  let wikiSources = [];
  if (useWiki && query) {
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 1);
    const allFiles = getAllFiles();
    wikiSources = allFiles
      .filter(f => terms.some(t => f.title?.toLowerCase().includes(t)))
      .slice(0, 4)
      .map(f => ({ title: f.title, slug: f.slug, section: f.section, raw: f.raw?.slice(0, 600) }));
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
    contextParts.push('## 相关 Wiki 节点\n' +
      wikiSources.map((w, i) =>
        `[W${i + 1}] [[${w.title}]] (${w.section})\n${w.raw || ''}`
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
      model: MODEL,
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
