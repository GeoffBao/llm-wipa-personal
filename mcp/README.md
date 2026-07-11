# WIPA Knowledge Gateway MCP Server

Exposes the local Obsidian knowledge base and WIPA Reading Agent as MCP tools, compatible with Raycast AI, Claude Code, Cursor, Hermes, and any MCP-capable AI client.

## Tools

| Tool | Description |
|---|---|
| `search_readwise` | Semantic search over Readwise library (articles, books, videos) |
| `search_wiki` | Keyword search over compiled Obsidian wiki |
| `read_wiki_article` | Read full content of a wiki article by title |
| `ask_knowledge_base` | Reading Agent answer with Wiki/reading citations |

## Prerequisites

- **llm-wipa server** must be running at `http://localhost:3000`  
  (starts automatically via launchd on login)
- Node.js 18+

## Install

```bash
cd /Users/admin/Workspace/ClaudeCode/wipagents/mcp
npm install
```

## Configure Raycast AI

1. Open Raycast → Settings → Extensions → AI
2. Click **MCP Servers** → Add server
3. Paste this config:

```json
{
  "llm-kb": {
    "command": "node",
    "args": ["/Users/admin/Workspace/ClaudeCode/wipagents/mcp/index.js"],
    "env": {
      "VAULT_PATH": "/Users/admin/Workspace/Resources/obsidian/AI-KN-Base",
      "KB_API_URL": "http://localhost:3000"
    }
  }
}
```

## Configure Claude Code

Add to `~/.claude/CLAUDE.md` or project `CLAUDE.md`:

```markdown
## MCP: LLM KB
Available MCP tools: search_readwise, search_wiki, read_wiki_article, ask_knowledge_base
Use these to query Eason's personal knowledge base before answering knowledge questions.
```

Or add to Claude Code settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "llm-kb": {
      "command": "node",
      "args": ["/Users/admin/Workspace/ClaudeCode/wipagents/mcp/index.js"],
      "env": {
        "VAULT_PATH": "/Users/admin/Workspace/Resources/obsidian/AI-KN-Base",
        "KB_API_URL": "http://localhost:3000"
      }
    }
  }
}
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VAULT_PATH` | `/Users/admin/Workspace/Resources/obsidian/AI-KN-Base` | Path to Obsidian vault |
| `KB_API_URL` | `http://localhost:3000` | llm-wipa server base URL |

## Test

```bash
# Verify tools are listed
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node index.js
```
