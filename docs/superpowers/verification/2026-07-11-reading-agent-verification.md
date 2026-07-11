# Reading Agent Verification

**Date:** 2026-07-11  
**Branch:** `codex/agent-reading-product`  
**Vault:** `/Users/admin/Workspace/Resources/obsidian/AI-KN-Base`

## Automated verification

Command:

```bash
npm test -- --test-reporter=spec
```

Result: 27 tests passed, 0 failed.

Covered paths:

- bounded reading context and no-document queries
- Wiki/Readwise evidence merge and no-evidence state
- WIPA query and Hermes delegation/fallback
- Agent SSE route and confirmation requirement
- article-to-Agent selection context
- evidence citations and reviewed memory writeback
- Chat-to-Reading-Agent surface migration
- MCP gateway migration
- Hermes health/capability checker
- end-to-end reading → evidence → answer → reviewed writeback

## Local Vault boot verification

The server booted with:

```bash
VAULT_PATH=/Users/admin/Workspace/Resources/obsidian/AI-KN-Base PORT=3010 node server.js
```

Observed:

- 1813 Vault files loaded
- 14 books loaded
- 52 visualizations loaded
- Wiki vector index loaded with 12858 chunks when available
- Local preview URL: `http://localhost:3010/agent`

## Manual browser checklist

- [ ] `/agent` opens with the three-column desktop workspace.
- [ ] `/wiki/<slug>` exposes `Ask Agent about this article`.
- [ ] Selecting article text exposes `Ask Agent about selection`.
- [ ] Query results show status, answer text, and evidence cards.
- [ ] `/chat` redirects to `/agent`.
- [ ] Light and dark themes preserve readable context, Agent, and evidence columns.
- [ ] Desktop widths 1440px, 1180px, and 900px do not introduce horizontal overflow.
- [ ] `prefers-reduced-motion` removes nonessential animation.
- [ ] Hermes-unavailable state keeps query/read behavior usable.

## Known integration boundary

Hermes was not required for the deterministic test suite. The WIPA server reports Hermes availability through `/api/agent/health`; setting `HERMES_API_URL` and `HERMES_API_KEY` enables execution routing without changing the Vault source of truth.
