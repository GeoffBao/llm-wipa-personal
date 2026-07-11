# Hermes Agent Integration

WIPA treats Hermes as the default Agent's execution backend. Users interact with one Reading Agent; Hermes is called when a request needs tools, multi-step execution, browser control, code, files, scheduled work, or an external Bot channel.

## Local setup

1. Install and configure Hermes using the official documentation: <https://hermes-agent.nousresearch.com/docs/>.
2. Enable its OpenAI-compatible API server and bind it to localhost for local development.
3. Copy `.env.example` to `.env` and set:

```env
HERMES_API_URL=http://127.0.0.1:8642/v1
HERMES_API_KEY=change-me-local-dev
HERMES_TIMEOUT_MS=120000
```

4. Start WIPA with the Vault path:

```bash
VAULT_PATH=/Users/admin/Workspace/Resources/obsidian/AI-KN-Base PORT=3010 node server.js
```

5. Check the local Hermes connection:

```bash
node scripts/check-hermes.js
```

The checker never prints the API key or prompt contents. If Hermes is unavailable, WIPA remains usable for reading and personal knowledge queries.

## Routing policy

- `mode: query`: WIPA retrieval plus the configured WIPA model.
- `mode: execute`: explicit confirmation, then Hermes execution.
- External writes, messages, deletes, shell commands, and browser side effects require confirmation.
- Hermes experience and generated skills are candidates; the Obsidian Vault remains the canonical long-term knowledge source.

## API surface

WIPA calls Hermes server-side through `/v1/chat/completions`. The browser never receives `HERMES_API_KEY`.

The WIPA MCP gateway can expose the local Vault and Reading Agent to Hermes and other MCP clients. MCP is an adapter layer, not a second canonical memory store.

References:

- <https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server/>
- <https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp>
- <https://github.com/NousResearch/hermes-agent>
