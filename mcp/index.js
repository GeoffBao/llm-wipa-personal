#!/usr/bin/env node
/**
 * LLM KB MCP Server
 * Exposes Eason's Readwise + Obsidian Wiki knowledge base as MCP tools.
 * Transport: stdio (compatible with Raycast AI, Claude Code, Cursor, etc.)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { searchReadwise } from './src/tools/searchReadwise.js';
import { searchWiki } from './src/tools/searchWiki.js';
import { readWikiArticle } from './src/tools/readWikiArticle.js';
import { askKB } from './src/tools/askKB.js';

const server = new McpServer({
  name: 'llm-kb',
  version: '1.0.0',
});

// ── Tool 1: Readwise semantic search ──────────────────────────────────────────
server.tool(
  'search_readwise',
  'Semantic search over 2422+ saved Readwise articles, books, videos, and tweets. ' +
  'Finds relevant content by meaning, not just keywords. ' +
  'Use this when the question is about topics the user has been reading about.',
  {
    query: z.string().describe('Search query (Chinese or English, any language)'),
    limit: z.number().int().min(1).max(12).optional()
      .describe('Number of results to return (default 6)'),
  },
  async ({ query, limit }) => {
    const text = await searchReadwise(query, limit);
    return { content: [{ type: 'text', text }] };
  },
);

// ── Tool 2: Wiki keyword search ───────────────────────────────────────────────
server.tool(
  'search_wiki',
  'Search the compiled personal Obsidian wiki (concepts, source summaries, topic maps, synthesis). ' +
  'Use this when looking for structured knowledge, concept definitions, or compiled notes.',
  {
    query: z.string().describe('Search keywords'),
    limit: z.number().int().min(1).max(10).optional()
      .describe('Number of results (default 6)'),
  },
  async ({ query, limit }) => {
    const text = await searchWiki(query, limit);
    return { content: [{ type: 'text', text }] };
  },
);

// ── Tool 3: Read a specific wiki article ──────────────────────────────────────
server.tool(
  'read_wiki_article',
  'Read the full markdown content of a specific wiki article by title. ' +
  'Call search_wiki first to discover article titles, then use this to get full content.',
  {
    title: z.string().describe('Article title or slug, e.g. "Second Brain", "AI Agent", "LLM Wiki"'),
  },
  async ({ title }) => {
    const text = await readWikiArticle(title);
    return { content: [{ type: 'text', text }] };
  },
);

// ── Tool 4: Full RAG answer ───────────────────────────────────────────────────
server.tool(
  'ask_knowledge_base',
  'Ask a question and receive a synthesized answer grounded in the personal knowledge base. ' +
  'The KB server retrieves relevant Readwise articles and Wiki notes, then generates a structured answer. ' +
  'Best for complex questions that need information from multiple sources.',
  {
    question: z.string().describe('The question to answer'),
    use_wiki: z.boolean().optional()
      .describe('Include Wiki layer in context (default true)'),
  },
  async ({ question, use_wiki = true }) => {
    const text = await askKB(question, use_wiki);
    return { content: [{ type: 'text', text }] };
  },
);

// ── Start server ──────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
