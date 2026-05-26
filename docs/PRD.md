# LLM WIPA — Product Requirements Document

> Version 2.0 · May 2026  
> Author: Eason

---

## 1. Vision

Turn a personal Obsidian vault into a **self-hosted, AI-augmented knowledge companion** — one that reads, retrieves, and reasons over everything you have ever saved, without any data leaving your machine.

The goal is not a second brain that stores notes. It's a **queryable intelligence layer** on top of the notes you already have.

---

## 2. Problem Statement

Knowledge workers accumulate large reading libraries (articles, books, videos, highlights) alongside compiled notes (concepts, maps, synthesis). Two friction points emerge:

1. **Dark matter problem**: The majority of saved content — Readwise articles, book highlights, clipped pages — is archived but never revisited. Semantic value exists; access does not.
2. **Context switching cost**: Querying a knowledge base means opening Obsidian, running a search, reading a file, then returning to the tool you were actually using. AI assistants (Raycast, Claude Code) can't see your personal knowledge.

LLM WIPA solves both: it surfaces dark-matter content through semantic search, and exposes the knowledge base as an AI-native API so any tool can draw from it.

---

## 3. User Persona

**Primary user: knowledge-intensive professional**

- Maintains an Obsidian vault with Wiki + Notes + Projects structure
- Saves 5–20 articles/videos per week to Readwise Reader
- Uses Claude Code, Raycast AI, or Cursor as daily AI tools
- Prefers local-first tools; uncomfortable with cloud-synced notes
- Reads and writes in both Chinese and English

---

## 4. Core Design Principles

| Principle | Implication |
|---|---|
| **Local-first** | Zero cloud sync. Vault files stay on disk. API keys stay in `.env`. |
| **Vault as source of truth** | App reads files directly; vault stays pure Obsidian-compatible markdown. |
| **No build step** | `npm start` serves the current vault state immediately. |
| **AI-augmented, not AI-dependent** | Core browsing/search works without AI. AI features are additive layers. |
| **MCP-native** | Knowledge base exposed as MCP tools so any compatible agent can consume it. |

---

## 5. Feature Scope

### 5.1 Completed (v1 → v2)

#### Knowledge Browser
- Wikipedia-style article pages — infobox, sticky TOC, breadcrumbs, tag pills, backlinks
- `[[wikilink]]` resolution and navigation
- Browse by section (Concepts, Sources, MOCs, Synthesis, Prompts, Notes, Projects)
- Browse by tag
- Full-text search powered by MiniSearch with CJK tokenizer + autocomplete

#### Reading & Library
- **Books page** — unified shelf aggregating WeRead + Readwise + Apple Books, year-grouped with 52-week reading heatmap
- **Journey page** — reverse-chronological daily memory timeline with heatmap
- **Readwise dashboard** — saving activity heatmap, top sources chart, full library browsing by category and location

#### Visualizations
- Force-directed D3 knowledge graph with backlink-scaled node sizes
- Obsidian Canvas viewer (pan/zoom, color-coded cards, arrows)
- Excalidraw viewer (SVG rendering, no React dependency)
- Mermaid diagram rendering in articles

#### Infrastructure
- chokidar vault watcher — live index rebuild on file save, no restart needed
- chokidar views watcher — template cache cleared on `.html` change
- macOS LaunchAgent — server auto-starts at login, auto-restarts on crash
- `--env-file` configuration — vault path, port, tokens all in `.env`

#### Semantic Search Layer (v2 new)
- Local vector embeddings via `@xenova/transformers` (model: `Xenova/multilingual-e5-small`, 118 MB, multilingual, runs fully offline)
- Batch embed script: `scripts/embed-readwise.js` — indexes all 2422+ Readwise articles, `--incremental` flag for fast updates
- `GET /api/semantic-search?q=&k=` — cosine similarity search over embedded vectors
- Daily cron via launchd (`com.llm-wipa.readwise-sync.plist`) — auto sync + re-embed at 07:00
- Hot-reload: server automatically reloads vector index when the index file changes on disk

#### Chat with Knowledge Base (v2 new)
- `/chat` — full-screen two-column chat interface
- RAG pipeline: semantic search (Readwise, top 6 results, score ≥ 0.78) + wiki keyword search (top 4) → DeepSeek LLM (streaming SSE)
- Streaming response via SSE with real-time markdown rendering
- Citation links: `[R1]`/`[W1]` rendered as clickable badges → source URL or wiki article
- Sources panel: all retrieved sources with author, category, match score, summary
- Mermaid diagram rendering in chat with syntax-error fallback
- Table rendering in chat
- Model selector (deepseek-chat / deepseek-reasoner)
- Wiki layer toggle
- Conversation history within session
- Layout locked to viewport — no body scroll, only message area scrolls internally

#### MCP Server (v2 new)
- `mcp/` — standalone MCP server co-located in the llm-wipa repo
- stdio transport — compatible with Raycast AI, Claude Code, Cursor, any MCP client
- Tools exposed:
  - `search_readwise(query, limit)` — semantic search over Readwise library
  - `search_wiki(query, limit)` — keyword search over Wiki via MiniSearch
  - `read_wiki_article(title)` — full markdown content of any wiki article
  - `ask_knowledge_base(question, use_wiki)` — full RAG answer with source attribution
- Homepage onboarding banner — shows Raycast config JSON, one-click copy, dismissible via localStorage

---

### 5.2 Planned (v3 Roadmap)

| Feature | Priority | Notes |
|---|---|---|
| Chat history persistence | P1 | localStorage-based conversation history across sessions |
| `/api/ask` non-streaming endpoint | P1 | Cleaner interface for MCP `ask_knowledge_base` tool |
| Sidebar Chat link | P2 | Left nav currently missing Chat entry |
| Raycast Script Command: `ask-kb` | P2 | Quick one-shot query from any app via Raycast |
| Wiki ingest pipeline in UI | P2 | One-click "add to Wiki" from chat answer |
| Incremental vector index hot-reload | P2 | Currently reloads full index; delta-only reload for large datasets |
| Multi-turn context in MCP | P3 | `ask_knowledge_base` currently stateless |
| Old `/readwise/chat` route cleanup | P3 | Legacy route from v1 |
| Semantic search over Wiki | P3 | Currently only Readwise is embedded; Wiki uses keyword search |
| Cross-vault federation | P4 | Query multiple vault instances via MCP |

---

## 6. Technical Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     CLIENT LAYER                         │
│  Browser (localhost:3000)   Raycast AI   Claude Code     │
│  ─── HTTP / SSE ──────────── MCP stdio ──────────────── │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│                   EXPRESS SERVER (server.js)              │
│                                                           │
│  Routes                    Services                       │
│  ├── /                     ├── vault/loader.js            │
│  ├── /wiki/:slug           ├── vault/backlinks.js         │
│  ├── /chat ─── SSE ──────► ├── search/vectorStore.js      │
│  ├── /api/semantic-search  ├── search/index.js (MiniSearch)│
│  ├── /api/chat             └── render/template.js         │
│  └── ... (15+ routes)                                     │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│                    DATA LAYER (Vault)                     │
│                                                           │
│  Wiki/concepts/   ← compiled knowledge                   │
│  Wiki/sources/    ← source summaries                     │
│  Wiki/mocs/       ← topic maps                           │
│  Raw/readwise-sync-data.json    ← 2422 articles          │
│  Raw/readwise-vector-index.json ← 384-dim embeddings     │
│  Notes/  Journey/  Projects/                             │
└──────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                   MCP LAYER (mcp/)                        │
│                                                           │
│  index.js (stdio) → 4 tools                              │
│  ├── search_readwise   → GET /api/semantic-search        │
│  ├── search_wiki       → GET /api/search                 │
│  ├── read_wiki_article → fs.readFile (vault direct)      │
│  └── ask_knowledge_base → POST /api/chat (SSE consume)   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                BACKGROUND JOBS (launchd)                  │
│                                                           │
│  com.llm-wipa.server          → always-on, auto-restart  │
│  com.llm-wipa.readwise-sync   → daily 07:00              │
│    └── sync-readwise.js --incremental                    │
│    └── embed-readwise.js --incremental                   │
│        └── triggers vectorStore hot-reload via chokidar  │
└─────────────────────────────────────────────────────────┘
```

### Key Technical Decisions

| Decision | Rationale |
|---|---|
| `Xenova/multilingual-e5-small` for embeddings | 118 MB, multilingual (Chinese + English), runs entirely offline via WebAssembly in Node.js |
| DeepSeek for chat LLM | OpenAI-compatible API, cost-effective, strong Chinese + code understanding |
| SSE for streaming | Simpler than WebSocket for one-way server-to-client stream; works with fetch API |
| MCP over REST for AI clients | MCP is emerging standard; one server supports Raycast, Claude Code, Cursor simultaneously |
| Co-located `mcp/` in llm-wipa | Single repo, shared deployment, easier path updates |
| stdio transport for MCP | Zero network config; process-isolated; supported by all major MCP clients |

---

## 7. Non-Goals

- No mobile app or PWA
- No collaborative/multi-user features
- No cloud sync or remote access (use SSH tunnel if needed)
- No real-time collaborative editing
- Not a replacement for Obsidian — the vault editor remains Obsidian
- No LLM-generated note creation (AI assists retrieval, not authoring)

---

## 8. Success Metrics

| Metric | Target |
|---|---|
| Query latency (semantic search) | < 500ms after model warm-up |
| Chat first-token latency | < 2s (DeepSeek API) |
| Daily embed run time | < 2 min for incremental (2422 articles) |
| MCP tool response time | < 1s for search, < 10s for ask_knowledge_base |
| Vector index size | < 50 MB on disk |
| Server memory at rest | < 300 MB |
