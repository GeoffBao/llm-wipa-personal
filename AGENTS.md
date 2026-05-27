## Project Philosophy: KB × Agent Bidirectional Loop

LLM WIPA is the shared brain across all of Eason's AI agents. The central design principle is a **bidirectional loop** between the personal knowledge base and the agent layer:

- **KB → Agent (Pull):** Every agent (Claude Code, Raycast AI, Cursor, Craft Agents, Hermes) queries this KB via MCP before answering. The MCP server exposes `search_wiki`, `search_readwise`, `read_wiki_article`, and `ask_knowledge_base`. Answers are grounded in curated personal knowledge, not generic model memory.
- **Agent → KB (Push):** Daily and weekly automations write insights back into the vault: Daily AI Signal Brief → `Journey/`, Readwise sync → `Raw/`, Tana notes → `Wiki/sources/`, conversation insights → `Journey/YYYY-MM-DD.md` via `memory-journal-sync`.
- **Shared skill layer:** Skills (`wiki-query`, `wiki-ingest`, `memory-journal-sync`, `tana-wiki-export`, etc.) run identically across all agent surfaces. One skill, all agents.

The KB compounds over time: every session enriches it, and richer KB means sharper agent answers.

When working on this project, always keep this philosophy in mind. Features that strengthen either direction of the loop — better retrieval, better ingestion, better automation — are high priority.

---

## Learned User Preferences
- When executing attached implementation plans, leave the plan file unchanged, use the existing todos instead of recreating them, mark the current todo in progress, and continue until all todos are complete.
- For UI work, self-test the actual page across the active theme and relevant responsive widths, then iterate on visible failures; screenshots from the user should trigger direct debugging and reassessment, not another abstract plan.
- When the user provides Obsidian plugin or app screenshots as UI reference, implement to match that layout and styling directly.
- The product direction is Surf (deta/surf)-inspired UI/UX via phased adoption—visual theme, vertical tabs, split panes, macOS Electron shell—keeping the Obsidian vault as data source rather than forking Surf.

## Learned Workspace Facts
- This workspace is LLM WIPA, a local Express and vanilla JavaScript app that serves an Obsidian vault as a Wikipedia-style knowledge base from vault markdown.
- The project includes a local `/flipbook/:slug` Flipbook view that renders a flipbook.page-style visual browser from vault graph data using local SVG/canvas-style frames, with no image model required in the base path.
- Homepage `Topic Areas` are configured in `config.js` via `DOMAIN_PORTALS`, while sidebar topic links live in `views/layout.html`; portal matching scans `concepts`/`sources` titles and frontmatter tags, not full body text.
- Wikilink rendering resolves targets in `src/vault/wikilinks.js`; missing targets render as red `wikilink-missing` links and resolution falls back through title, case-insensitive title, slug, and normalized punctuation matching.
- The unified reading page is `/books` (formerly Library); `/library` and `/reading` redirect there, with year-grouped shelf cards aggregating WeRead vault markdown and Readwise epub data.
- Books heatmap activity counts WeRead highlight timestamps (`⏱ YYYY-MM-DD`), Readwise epub `updatedAt`, and `lastReadDate` fallback—not `lastReadDate` alone.
- Mermaid fenced blocks (` ```mermaid ` or `mmd`) render as client-side diagrams via bundled `mermaid.js`; `src/render/markdown.js` outputs `.mermaid-wrap` + `.mermaid` DOM instead of hljs code blocks.
