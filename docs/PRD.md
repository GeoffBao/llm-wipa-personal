# LLM WIPA — Product Requirements Document

> Version 2.2 · May 2026  
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
| **Agent-agnostic loop** | One vault + one server; agents integrate via MCP, HTTP, or shared skills — no per-agent forks. |

---

## 5. Feature Scope

### 5.1 Completed (v1 → v2.1)

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

#### Semantic Search Layer (v2)
- Local vector embeddings via `@xenova/transformers` (model: `Xenova/multilingual-e5-small`, 118 MB, multilingual, runs fully offline)
- Readwise embed script: `scripts/embed-readwise.js` — indexes 2422+ Readwise articles, `--incremental` flag for fast updates
- `GET /api/semantic-search?q=&k=` — cosine similarity search over embedded vectors
- Daily cron via launchd (`com.llm-wipa.readwise-sync.plist`) — auto sync + re-embed at 07:00
- Hot-reload: server automatically reloads both vector indices when index files change on disk

#### Chat with Knowledge Base (v2)
- `/chat` — full-screen two-column chat interface
- RAG pipeline (see v2.1 update below)
- Streaming response via SSE with real-time markdown rendering
- Citation links: `[R1]`/`[W1]` rendered as clickable badges → source URL or wiki article
- Sources panel: all retrieved sources with author, category, match score, summary
- Mermaid diagram rendering in chat with syntax-error fallback
- Table rendering in chat
- Model selector (deepseek-v4-flash / deepseek-reasoner)
- Wiki layer toggle
- Conversation history within session
- Layout locked to viewport — no body scroll, only message area scrolls internally

#### MCP Server (v2)
- `mcp/` — standalone MCP server co-located in the llm-wipa repo
- stdio transport — compatible with Raycast AI, Claude Code, Cursor, any MCP client
- Tools exposed:
  - `search_readwise(query, limit)` — semantic search over Readwise library
  - `search_wiki(query, limit)` — keyword search over Wiki via MiniSearch
  - `read_wiki_article(title)` — full markdown content of any wiki article
  - `ask_knowledge_base(question, use_wiki)` — full RAG answer with source attribution
- Homepage onboarding banner — shows Raycast config JSON, one-click copy, dismissible via localStorage

#### Wiki Semantic Search — Dual-Index RAG (v2.1 new)

**Background**: The v2 Chat only embedded Readwise articles; Wiki/Notes/Projects used keyword-only MiniSearch. This meant paraphrase queries ("内核追踪实验"), pronoun references ("它"), and semantic-but-not-keyword matches silently returned zero Wiki results.

**What was built:**

| Component | Change |
|---|---|
| `scripts/embed-wiki.js` | New script: chunks all Wiki/Notes/Projects `.md` files (~800 chars, 100-char overlap), embeds with same model, writes `Raw/wiki-vector-index.json` |
| `src/search/vectorStore.js` | Dual-index: `loadWikiVectorStore()` + `wikiSemanticSearch()` sharing one extractor; title+slug dedup in results |
| `src/routes/chatRoute.js` | Hybrid retrieval: semantic-first (top 8 deduped), MiniSearch fills remaining slots; `vectorCount` reads `getCount()` not hardcoded |
| `server.js` | Loads both indices non-blocking on boot; chokidar watches `wiki-vector-index.json` for hot-reload |
| `mcp/src/tools/askKB.js` | Model updated to `deepseek-v4-flash` (consistent with UI default) |

**Index stats (as of v2.1 build):** 1403 files → 12,832 chunks → 103 MB on disk.

**Retrieval pipeline (updated):**

```
user query
    │
    ├─► R layer: semanticSearch(Readwise, k=6, threshold=0.78)
    │
    └─► W layer:
          ├─ @wiki:slug → exact file inject (priority 0)
          ├─ wikiSemanticSearch(k=8, threshold=0.65) → semantic-first
          └─ wikiSearch(MiniSearch, k=8) → fills remaining slots
          └─ dedup by slug+title → slice(0, 8)
    │
    └─► systemPrompt → DeepSeek SSE → Sources panel
```

**Root cause addressed**: "eBPF + AI 微架构能效分析实验方案" is now retrievable via "内核追踪性能实验方案" (semantic match, score 0.885). Previously unreachable via keyword.

#### Agent Integration Layer (v2.2 — design documented)

LLM WIPA is the **shared brain** for all local AI agents. Integration is intentionally split into Pull and Push so new agents can adopt one surface without rewriting the system.

**Pull (KB → Agent)** — agent queries before answering:

| Method | Transport | Entry point | Used by |
|---|---|---|---|
| MCP stdio | Process IPC | `mcp/index.js` → 4 tools | Claude Code, Cursor, Raycast AI |
| HTTP JSON/SSE | `localhost:3000` | `/api/semantic-search`, `/api/search`, `/api/chat` | Custom scripts, `wiki-query` skill |
| Guided filesystem | Vault read | `Wiki/INDEX.md` → MOC → concepts | `wiki-query` skill (no server required for static read) |

**Push (Agent → KB)** — agent writes insights back:

| Method | Destination | Skill / automation |
|---|---|---|
| Skills | `Wiki/sources/`, `Raw/work/` | `wiki-ingest`, `work-indexer` |
| Skills | `Journey/YYYY-MM-DD.md` | `memory-journal-sync` |
| Skills | `Wiki/sources/` | `tana-wiki-export` |
| Cron | `Raw/readwise-sync-data.json` | launchd daily sync |
| Cron | `Journey/` | Daily AI Signal Brief |

**Canonical skill source**: `{VAULT_PATH}/share-skills/` — symlinked into agent-specific skill dirs (`~/.claude/skills/`, Craft project prompts, etc.). One skill definition, all agents.

**Adding a new local agent (checklist)**:

1. Start llm-wipa server (`npm start`, port 3000)
2. If MCP-capable: add `llm-kb` server block with `VAULT_PATH` + `KB_API_URL`
3. If not MCP-capable: use HTTP API or install `wiki-query` skill
4. For write-back: enable `memory-journal-sync` / `wiki-ingest` from `share-skills/`
5. Add agent rule: "query KB via MCP or HTTP before answering knowledge questions"

**MCP tool → server mapping**:

| Tool | Implementation |
|---|---|
| `search_readwise` | `GET /api/semantic-search?q=&k=` |
| `search_wiki` | `GET /api/search?q=` |
| `read_wiki_article` | Direct `fs.readFile` on `Wiki/{section}/*.md` |
| `ask_knowledge_base` | `POST /api/chat` — consumes SSE, aggregates response |

**Design constraints** (intentional):

- MCP uses stdio, not HTTP — zero port exposure, process-isolated
- MCP layer is thin — delegates retrieval/RAG to Express; no duplicate index logic
- `read_wiki_article` bypasses HTTP for low-latency full-text reads
- Push workflows never require MCP — skills write markdown directly to vault

---

### 5.2 Planned (v3 Roadmap)

| Feature | Priority | Notes |
|---|---|---|
| **Multi-turn query rewrite** | P1 | Resolve pronouns and references ("它", "上面提到的") by rewriting the query using recent chat history before retrieval. Requires a lightweight rewrite LLM call before the RAG pipeline. |
| **Chat history persistence** | P1 | localStorage-based conversation history across sessions |
| **Wiki embed incremental via mtime** | P1 | `embed-wiki.js --incremental` already supports mtime-based invalidation; wire it into the daily cron (`sync-and-embed.sh`) so new wiki notes auto-embed at 07:00 |
| **`/api/ask` non-streaming endpoint** | P2 | Cleaner interface for MCP `ask_knowledge_base` tool; avoids SSE parsing in MCP layer |
| **MCP `search_wiki_semantic` tool** | P2 | Expose `wikiSemanticSearch` as a new MCP tool so Claude Code / Raycast can call it directly |
| **Agent onboarding doc generator** | P2 | Homepage banner → generate MCP JSON + agent-specific snippet (Cursor / Craft / generic) |
| **Sidebar Chat link** | P2 | Left nav currently missing Chat entry |
| **Raycast Script Command: `ask-kb`** | P2 | Quick one-shot query from any app via Raycast |
| **Wiki ingest pipeline in UI** | P2 | One-click "add to Wiki" from chat answer |
| **MCP resources (optional)** | P3 | Expose `Wiki/INDEX.md` or MOC list as MCP resources for zero-query navigation |
| **Retrieval quality metrics page** | P3 | Log query → sources → user interaction; visualize retrieval hit rate over time |
| **Hybrid re-ranking** | P3 | Combine BM25 score (MiniSearch) + vector score (cosine) into a single relevance score (RRF or learned); expose via `/api/search?hybrid=true` |
| **Multi-turn context in MCP** | P3 | `ask_knowledge_base` currently stateless |
| **Old `/readwise/chat` route cleanup** | P3 | Legacy route from v1 |
| **Cross-vault federation** | P4 | Query multiple vault instances via MCP |

---

## 6. Technical Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     CLIENT LAYER                         │
│  Browser   Claude Code   Cursor   Raycast   Craft/Hermes │
│  ── HTTP ── MCP stdio ── MCP stdio ── MCP ── Skills/HTTP│
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│                   EXPRESS SERVER (server.js)              │
│                                                           │
│  Routes                    Services                       │
│  ├── /                     ├── vault/loader.js            │
│  ├── /wiki/:slug           ├── vault/backlinks.js         │
│  ├── /chat ─── SSE ──────► ├── search/vectorStore.js      │
│  ├── /api/semantic-search  │     ├── Readwise index (R)   │
│  ├── /api/chat             │     └── Wiki index (W-vec)   │
│  └── ... (15+ routes)      ├── search/index.js (MiniSearch│
│                            └── render/template.js         │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│                    DATA LAYER (Vault)                     │
│                                                           │
│  Wiki/concepts/   Wiki/sources/   Wiki/mocs/             │
│  share-skills/    ← canonical agent skill definitions    │
│  Journey/         ← Agent → KB daily memory              │
│  Raw/readwise-sync-data.json      ← 2422+ articles       │
│  Raw/readwise-vector-index.json   ← 384-dim embeddings   │
│  Raw/wiki-vector-index.json       ← 12,832 wiki chunks   │
│  Notes/  Projects/                                       │
└──────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                   MCP LAYER (mcp/)                        │
│  Thin adapter — stdio in, HTTP/vault out                 │
│                                                           │
│  index.js (stdio) → 4 tools                              │
│  ├── search_readwise   → GET /api/semantic-search        │
│  ├── search_wiki       → GET /api/search                 │
│  ├── read_wiki_article → fs.readFile (vault direct)      │
│  └── ask_knowledge_base → POST /api/chat (SSE consume)   │
└──────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│              AGENT SKILLS LAYER (share-skills/)           │
│  Push + guided Pull — no server required for static read │
│                                                           │
│  wiki-query / wiki-ingest / memory-journal-sync / …      │
│  → HTTP curl to :3000  OR  direct vault read/write       │
└──────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                BACKGROUND JOBS (launchd)                  │
│                                                           │
│  com.llm-wipa.server          → always-on, auto-restart  │
│  com.llm-wipa.readwise-sync   → daily 07:00              │
│    └── sync-readwise.js --incremental                    │
│    └── embed-readwise.js --incremental                   │
│    └── embed-wiki.js --incremental          (v2.1 TODO)  │
│        └── triggers vectorStore hot-reload via chokidar  │
└─────────────────────────────────────────────────────────┘
```

### Key Technical Decisions

| Decision | Rationale |
|---|---|
| `Xenova/multilingual-e5-small` for embeddings | 118 MB, multilingual (Chinese + English), runs entirely offline via WebAssembly in Node.js |
| Shared extractor for dual index | Readwise and Wiki use the same model instance; avoids loading 118 MB twice |
| Semantic-first retrieval order | Vector results fill W-layer slots first; MiniSearch fills remaining — prevents keyword noise from crowding out semantic matches |
| Title+slug dedup in wiki search | Multiple chunks from same file, plus slug-collision files with identical titles, would otherwise occupy top-k slots |
| DeepSeek for chat LLM | OpenAI-compatible API, cost-effective, strong Chinese + code understanding |
| SSE for streaming | Simpler than WebSocket for one-way server-to-client stream; works with fetch API |
| MCP over REST for AI clients | MCP is emerging standard; one server supports Raycast, Claude Code, Cursor simultaneously |
| Co-located `mcp/` in llm-wipa | Single repo, shared deployment, easier path updates |
| stdio transport for MCP | Zero network config; process-isolated; supported by all major MCP clients |
| Thin MCP adapter | MCP tools proxy to Express HTTP — single source of truth for retrieval/RAG logic |
| Vault `share-skills/` as canonical skill store | Agent-specific dirs symlink/copy; Push workflows don't require MCP or server |
| HTTP API as MCP fallback | Any agent/script can integrate without MCP SDK |

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
| Daily embed run time (Readwise) | < 2 min for incremental (2422+ articles) |
| Daily embed run time (Wiki) | < 5 min for incremental (1403 files, 12k chunks) |
| MCP tool response time | < 1s for search, < 10s for ask_knowledge_base |
| Readwise vector index size | < 50 MB on disk |
| Wiki vector index size | < 150 MB on disk (current: 103 MB) |
| Server memory at rest | < 400 MB (dual index loaded) |
| Wiki semantic recall (paraphrase) | eBPF findable via "内核追踪技术实验方案" with score ≥ 0.85 |
