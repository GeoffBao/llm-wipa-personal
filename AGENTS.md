## Learned User Preferences
- When executing attached implementation plans, leave the plan file unchanged, use the existing todos instead of recreating them, mark the current todo in progress, and continue until all todos are complete.
- For UI work, self-test the actual page across the active theme and relevant responsive widths, then iterate on visible failures; screenshots from the user should trigger direct debugging and reassessment, not another abstract plan.

## Learned Workspace Facts
- This workspace is LLM WIPA, a local Express and vanilla JavaScript app that serves an Obsidian vault as a Wikipedia-style knowledge base from vault markdown.
- The project includes a local `/flipbook/:slug` Flipbook view that renders a flipbook.page-style visual browser from vault graph data using local SVG/canvas-style frames, with no image model required in the base path.
- Homepage `Topic Areas` are configured in `config.js` via `DOMAIN_PORTALS`, while sidebar topic links live in `views/layout.html`; portal matching scans `concepts`/`sources` titles and frontmatter tags, not full body text.
- Wikilink rendering resolves targets in `src/vault/wikilinks.js`; missing targets render as red `wikilink-missing` links and resolution falls back through title, case-insensitive title, slug, and normalized punctuation matching.
