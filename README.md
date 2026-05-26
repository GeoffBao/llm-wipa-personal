# LLM WIPA — Personal Knowledge Base

> **W**ikipedia-**I**nspired **P**ersonal **A**rchive  
> A local web app for Obsidian vaults with semantic search, RAG chat, and MCP integration.

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

---

## What Is This?

LLM WIPA turns your Obsidian vault into a locally-served knowledge base — searchable, browseable, and queryable by AI. It reads vault files directly, embeds your Readwise library for semantic search, exposes a RAG chat interface, and ships an MCP server so Raycast AI and Claude Code can draw from your knowledge while you work.

Everything runs on your machine. Nothing leaves it.

---

## Screenshots

| Homepage | Chat with KB | Knowledge Graph |
|---|---|---|
| ![Home](docs/screenshots/home.png) | ![Chat](docs/screenshots/chat.png) | ![Graph](docs/screenshots/graph.png) |

| Article | Books | Readwise Dashboard |
|---|---|---|
| ![Article](docs/screenshots/article.png) | ![Books](docs/screenshots/books.png) | ![Readwise](docs/screenshots/readwise.png) |

---

## Features

### Knowledge Browser
- **Wikipedia-style articles** — sticky TOC, infobox, breadcrumb, tag pills, backlinks panel
- **`[[Wikilink]]` navigation** — click any `[[Title]]` to jump between notes; broken links shown as red stubs
- **Browse by section** — Concepts, Sources, MOCs, Synthesis, Prompts, Notes, Projects
- **Browse by tag** — click any `#tag` to see all articles
- **Full-text search** — MiniSearch with CJK tokenizer, autocomplete dropdown, field-weighted ranking
- **Live index** — chokidar watches the vault; edit a file, reload the page — index updates instantly

### Semantic Search
- Local embeddings via `@xenova/transformers` (`multilingual-e5-small`, 118 MB, multilingual, fully offline)
- Covers all 2422+ Readwise articles — articles, books, emails, videos, tweets
- `GET /api/semantic-search?q=<query>&k=<n>` — returns top-K results with cosine similarity scores
- Daily auto-sync and re-embed at 07:00 via launchd cron
- Hot-reload: vector index automatically reloads when the index file is updated on disk

### Chat with Knowledge Base
- `/chat` — RAG chat interface: semantic search over Readwise + keyword search over Wiki → DeepSeek LLM
- Streaming via SSE — tokens appear as they're generated
- Citation links — `[R1]` / `[W1]` rendered as clickable badges linking to source URL or wiki article
- Sources panel — lists all retrieved sources with author, category, match score, and summary
- Mermaid diagram rendering with syntax-error fallback
- Table and code block rendering
- Viewport-locked layout — chat area scrolls internally; no page-level scroll drift

### Reading & Library
- **Books** — unified shelf: WeRead + Readwise + Apple Books, year-grouped with 52-week reading heatmap
- **Journey** — reverse-chronological daily memory timeline with activity heatmap
- **Readwise dashboard** — saving activity heatmap, top sources chart, full library with category/location filters

### Visualizations
- **Knowledge Graph** — D3 force-directed graph of all wikilink connections; color by section; searchable; draggable
- **Canvas Viewer** — renders Obsidian `.canvas` files as interactive pan/zoom diagrams
- **Excalidraw Viewer** — renders `.excalidraw` JSON as SVG (no React, no external deps)
- **Mermaid** — diagram rendering in articles and chat

### MCP Server (`mcp/`)
Exposes the knowledge base as MCP tools — compatible with Raycast AI, Claude Code, Cursor, and any MCP client.

| Tool | Description |
|---|---|
| `search_readwise` | Semantic search over Readwise library |
| `search_wiki` | Keyword search over compiled wiki |
| `read_wiki_article` | Full markdown content of any wiki article |
| `ask_knowledge_base` | Full RAG answer with source attribution |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Server | Express (Node.js) |
| Markdown | marked + custom wikilink extension |
| Full-text search | MiniSearch |
| Semantic search | @xenova/transformers (`multilingual-e5-small`) |
| LLM / Chat | DeepSeek API (OpenAI-compatible SDK) |
| Graph | D3.js v7 force simulation |
| Diagrams | Mermaid (bundled) |
| Syntax highlight | highlight.js |
| File watching | chokidar |
| MCP | @modelcontextprotocol/sdk |

---

## Project Structure

```
llm-wipa/
├── server.js                        # Express entry + chokidar watchers
├── config.js                        # Reads VAULT_PATH, PORT, etc. from env
├── .env.example
│
├── scripts/
│   ├── sync-readwise.js             # Fetch Readwise → Raw/readwise-sync-data.json
│   ├── embed-readwise.js            # Embed articles → Raw/readwise-vector-index.json
│   └── sync-and-embed.sh            # Daily cron: sync + embed (incremental)
│
├── src/
│   ├── vault/
│   │   ├── loader.js                # Glob vault, build slug/title maps
│   │   ├── parser.js                # Inline blockquote metadata + YAML fallback
│   │   ├── wikilinks.js             # [[Title]] → /wiki/slug resolver
│   │   ├── backlinks.js             # Reverse index: title → files
│   │   ├── canvas.js                # Load Obsidian .canvas files
│   │   └── excalidraw.js            # Load .excalidraw files
│   ├── search/
│   │   ├── index.js                 # MiniSearch build/query
│   │   └── vectorStore.js           # Load embeddings, cosine search
│   ├── render/
│   │   ├── markdown.js              # marked + wikilink + image extensions
│   │   ├── toc.js                   # H2/H3/H4 → nested TOC HTML
│   │   ├── assets.js                # ![[img.png]] → vault Assets/ resolver
│   │   └── template.js              # Lightweight {{var}} / {{{raw}}} template engine
│   └── routes/
│       ├── home.js                  # GET /
│       ├── article.js               # GET /wiki/:slug
│       ├── browse.js                # GET /browse/:section, /browse/tags/:tag
│       ├── search.js                # GET /search?q=
│       ├── chatRoute.js             # GET /chat, POST /api/chat (SSE)
│       ├── semanticSearch.js        # GET /api/semantic-search
│       ├── libraryRoute.js          # GET /books, /reading/:slug
│       ├── journeyRoute.js          # GET /journey, /journey/:date
│       ├── graph.js                 # GET /graph, /api/graph
│       ├── canvasRoute.js           # GET /diagrams, /diagrams/:slug
│       ├── excalidrawRoute.js       # GET /excalidraw, /excalidraw/:slug
│       ├── readwiseRoute.js         # GET /readwise
│       └── api.js                   # GET /api/search, /api/random
│
├── views/                           # HTML templates ({{var}} / {{{raw}}} interpolation)
│   ├── layout.html                  # Base shell: header + sidebar + footer
│   ├── home.html                    # Homepage with MCP onboarding banner
│   ├── chat.html                    # Chat UI: messages + sources panel
│   ├── article.html
│   ├── browse.html
│   ├── search.html
│   ├── books.html
│   ├── journey.html
│   ├── readwise.html
│   ├── graph.html
│   ├── canvas.html
│   └── excalidraw.html
│
├── public/
│   ├── css/main.css                 # Full design system (warm amber + dark mode)
│   ├── js/                          # search.js, toc-highlight.js, mobile-nav.js
│   └── vendor/                      # d3.min.js, mermaid.min.js
│
├── mcp/                             # MCP server (co-located, own package.json)
│   ├── index.js                     # stdio MCP server entry
│   ├── src/
│   │   ├── config.js
│   │   └── tools/
│   │       ├── searchReadwise.js
│   │       ├── searchWiki.js
│   │       ├── readWikiArticle.js
│   │       └── askKB.js
│   └── README.md
│
├── launchd/
│   └── com.llm-wipa.readwise-sync.plist  # Daily 07:00 cron for sync + embed
│
└── docs/
    ├── PRD.md                       # Product requirements document
    └── screenshots/
```

---

## Setup

### Prerequisites

- Node.js 20.6+ (uses built-in `--env-file` flag)
- An Obsidian vault with `Wiki/` subdirectory

### Install

```bash
git clone https://github.com/GeoffBao/llm-wipa-personal.git
cd llm-wipa-personal
npm install
```

### Configure

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Absolute path to your Obsidian vault root
VAULT_PATH=/path/to/your/obsidian/vault

# Server port (default 3000)
PORT=3000

# Readwise API token — get from https://readwise.io/access_token
READWISE_TOKEN=your_token_here

# DeepSeek API key — for /chat RAG interface
CHAT_API_KEY=your_deepseek_key
CHAT_BASE_URL=https://api.deepseek.com/v1
CHAT_MODEL=deepseek-chat

# WeRead cookie (optional — for Books page reading progress)
WEREAD_COOKIE=wr_skey=xxx; wr_vid=xxx; ...
```

### Run

```bash
npm start
# or for dev (auto-restart on server code changes):
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Semantic Search Setup

Build the vector index over your Readwise library (required for `/chat` and `/api/semantic-search`):

```bash
# First run — full embed (~2 min for 2422 articles, model downloads ~118 MB)
node --env-file=.env scripts/embed-readwise.js

# Incremental — only embeds new/updated articles
node --env-file=.env scripts/embed-readwise.js --incremental
```

The index is saved to `Raw/readwise-vector-index.json` in your vault. The server hot-reloads it automatically when updated.

---

## Sync Scripts

### Readwise

```bash
# Full sync
node --env-file=.env scripts/sync-readwise.js

# Incremental (fast, only new items)
node --env-file=.env scripts/sync-readwise.js --incremental
```

### WeRead (微信读书)

```bash
node --env-file=.env scripts/sync-weread.js
```

**Getting your WeRead cookie:** `weread.qq.com` → login → DevTools → Network → any `/web/` request → copy the `Cookie` request header.

---

## Auto-Start & Daily Sync (macOS)

### Always-on server

Create `~/Library/LaunchAgents/com.llm-wipa.server.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.llm-wipa.server</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/node</string>
    <string>--env-file=.env</string>
    <string>/path/to/llm-wipa/server.js</string>
  </array>
  <key>WorkingDirectory</key><string>/path/to/llm-wipa</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
</dict>
</plist>
```

```bash
launchctl load ~/Library/LaunchAgents/com.llm-wipa.server.plist
```

### Daily sync + embed cron

Copy the included plist:

```bash
cp launchd/com.llm-wipa.readwise-sync.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.llm-wipa.readwise-sync.plist
```

Runs daily at 07:00: sync Readwise → embed new articles → server auto-reloads vector index.

---

## MCP Server Setup (Raycast AI / Claude Code)

Install dependencies:

```bash
cd mcp && npm install
```

### Raycast AI

Raycast → Settings → Extensions → AI → **MCP Servers** → add:

```json
{
  "llm-kb": {
    "command": "node",
    "args": ["/path/to/llm-wipa/mcp/index.js"],
    "env": {
      "VAULT_PATH": "/path/to/your/obsidian/vault",
      "KB_API_URL": "http://localhost:3000"
    }
  }
}
```

### Claude Code

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "llm-kb": {
      "command": "node",
      "args": ["/path/to/llm-wipa/mcp/index.js"],
      "env": {
        "VAULT_PATH": "/path/to/your/obsidian/vault",
        "KB_API_URL": "http://localhost:3000"
      }
    }
  }
}
```

Once configured, your AI assistant will call `search_readwise`, `search_wiki`, and `ask_knowledge_base` automatically when answering knowledge questions.

---

## Routes

| Route | Description |
|---|---|
| `GET /` | Homepage — Wiki Index hero, MOC grid, recent updates, featured concept |
| `GET /wiki/:slug` | Article page with TOC, infobox, backlinks |
| `GET /chat` | RAG chat interface |
| `GET /browse/:section` | All articles in a section |
| `GET /browse/tags/:tag` | All articles with a tag |
| `GET /search?q=` | Full-text search results |
| `GET /books` | Unified books shelf — WeRead + Readwise + Apple Books |
| `GET /readwise` | Readwise Reader dashboard |
| `GET /journey` | Daily memory timeline |
| `GET /graph` | D3 knowledge graph |
| `GET /diagrams` | Canvas diagram gallery |
| `GET /excalidraw` | Excalidraw drawing gallery |
| `GET /api/search?q=` | JSON autocomplete results |
| `GET /api/semantic-search?q=&k=` | JSON semantic search results |
| `POST /api/chat` | SSE streaming RAG chat |
| `GET /api/graph` | JSON graph data |
| `GET /api/random` | JSON random concept |

---

## Vault Structure

```
YourVault/
├── Wiki/
│   ├── concepts/        # Core knowledge concepts
│   ├── sources/         # Book/article summaries
│   ├── mocs/            # Maps of Content
│   ├── synthesis/       # Synthesized insights
│   └── prompts/         # Prompt templates
├── Notes/               # Personal notes (browseable, searchable)
├── Projects/            # Project documentation
├── Journey/             # Daily memory entries (YYYY-MM-DD.md)
└── Raw/
    ├── readwise-sync-data.json      # Readwise library (from sync script)
    └── readwise-vector-index.json   # Embeddings (from embed script)
```

### Metadata format

Inline blockquote (Obsidian-native, preferred):
```markdown
> Type: #concept
> Tags: #agent #llm
> Created: 2025-01-15
```

YAML frontmatter (fallback, common in Readwise/WeRead imports):
```yaml
---
title: My Note
author: John Doe
tags: [agent, llm]
---
```

---

## Design

- Warm cream background (`#fdf8f0`) with blue/amber accents — easy on the eyes for long reading sessions
- Frosted-glass sticky header
- Light / Dark / Wikipedia theme switcher
- CJK-aware typography (`line-height: 1.7`, `word-break: break-word`)
- Responsive layout

---

## License

MIT — use it, fork it, make it yours.

---

*Built by Eason · [llm-wipa-personal](https://github.com/GeoffBao/llm-wipa-personal)*
