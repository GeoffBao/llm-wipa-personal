# LLM WIPA Reading Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing LLM WIPA desktop web app into a reading-and-knowledge-query Agent backed by the local Obsidian Vault, with Hermes as the default execution layer and a mymind-quality visual/motion system.

**Architecture:** Keep the local Obsidian Vault as the canonical knowledge source. Add a backend Context Layer that combines the active reading document, selected text, conversation, and WIPA retrieval results into a typed agent request. Route ordinary questions through WIPA's existing model path and route approved multi-step work through an OpenAI-compatible Hermes adapter; return citations, progress, cancellation, and candidate writebacks through the same desktop Agent surface.

**Tech Stack:** Existing Express + vanilla JavaScript + server-rendered HTML; Node.js built-in `node:test`; existing MiniSearch/vector stores; OpenAI-compatible HTTP API for Hermes; existing Obsidian Vault rendering and `/vault/` asset serving.

## Global Constraints

- First phase is desktop-only; mobile implementation is out of scope.
- Canonical knowledge source is `/Users/admin/Workspace/Resources/obsidian/AI-KN-Base`.
- Do not create a second canonical knowledge database.
- The user sees one default Agent; Hermes is an execution backend, not a user-selected second agent.
- External side effects require explicit confirmation; read-only retrieval may run automatically.
- Preserve the existing main line and existing unrelated worktree changes.
- Create implementation branch `codex/agent-reading-product` before code changes.
- Reuse existing route, rendering, search, and theme patterns before adding abstractions.
- Validate each task with focused tests before moving to the next task.

---

## Current File Map

- `server.js`: Express route registration and vector-store loading/watchers.
- `config.js`: Vault path, chat provider, and model configuration.
- `src/routes/chatRoute.js`: Existing `/chat` shell and streaming `/api/chat` RAG endpoint.
- `src/search/vectorStore.js`: Readwise and Wiki vector stores plus semantic search.
- `src/search/index.js`: Existing Wiki full-text search.
- `src/vault/loader.js`: Vault file loading and metadata access.
- `src/routes/article.js`: Wiki article rendering.
- `views/chat.html`: Existing chat UI, controls, sources panel, and client streaming code.
- `views/article.html`: Existing article layout and right-side tools column.
- `views/layout.html`: Global shell, navigation, theme, and shared scripts.
- `views/home.html`: Existing Wiki homepage and KB × Agent hero.
- `public/`: Static assets and shared CSS/JavaScript where applicable.
- `mcp/`: Existing MCP surface and local Vault configuration.
- `scripts/`: Existing embedding and Vault maintenance commands.
- `package.json`: No test script currently; add Node's built-in test runner.

## Task 1: Create the Product Branch and Baseline Test Harness

**Files:**
- Create: none
- Modify: `package.json` scripts
- Test: `tests/smoke.test.js`

**Interfaces:**
- Produces: `npm test` running Node's built-in test runner.

- [ ] **Step 1: Create the isolated implementation branch**

Run:

```bash
git switch -c codex/agent-reading-product
```

Expected: the branch is created from the current commit; existing unrelated changes remain in the worktree.

- [ ] **Step 2: Add a failing smoke test**

Create `tests/smoke.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

test('test harness is available', () => {
  assert.equal(typeof test, 'function');
});
```

- [ ] **Step 3: Add the test script**

Modify `package.json`:

```json
{
  "scripts": {
    "test": "node --test",
    "start": "node --env-file=.env server.js",
    "dev": "node --env-file=.env --watch server.js"
  }
}
```

Keep all existing scripts unchanged.

- [ ] **Step 4: Run the baseline test**

Run:

```bash
npm test -- --test-reporter=spec
```

Expected: PASS for `tests/smoke.test.js`.

- [ ] **Step 5: Commit the harness**

```bash
git add package.json tests/smoke.test.js
git commit -m "test: add node test harness for reading agent"
```

## Task 2: Add the Reading Context Contract

**Files:**
- Create: `src/agent/context.js`
- Create: `src/agent/citations.js`
- Create: `tests/agent-context.test.js`
- Modify: `src/vault/loader.js` only if an existing safe file lookup helper is unavailable

**Interfaces:**
- Consumes: `getFile(slug)` from `src/vault/loader.js`, request body `{slug, selectedText, messages}`.
- Produces: `buildReadingContext(input)` returning `{ document, selection, conversation, sources }` and `toCitation(source)` returning `{ id, title, slug, excerpt, kind, score }`.

- [ ] **Step 1: Write failing context tests**

Create `tests/agent-context.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReadingContext } from '../src/agent/context.js';

test('buildReadingContext keeps the active document and selected text bounded', async () => {
  const context = await buildReadingContext({
    slug: 'example',
    selectedText: 'A selected passage',
    messages: [{ role: 'user', content: 'How does this relate to my project?' }],
    fileLoader: async () => ({ title: 'Example', slug: 'example', body: 'Document body' }),
  });

  assert.deepEqual(context.document, { title: 'Example', slug: 'example', body: 'Document body' });
  assert.equal(context.selection, 'A selected passage');
  assert.equal(context.conversation.length, 1);
});

test('buildReadingContext rejects an unknown slug without exposing filesystem paths', async () => {
  await assert.rejects(
    () => buildReadingContext({ slug: '../private', fileLoader: async () => null }),
    /document not found/
  );
});
```

- [ ] **Step 2: Run the focused test to verify failure**

Run:

```bash
node --test tests/agent-context.test.js
```

Expected: FAIL because `src/agent/context.js` does not exist.

- [ ] **Step 3: Implement the bounded context builder**

Create `src/agent/context.js` with these rules:

```js
export async function buildReadingContext({
  slug = '',
  selectedText = '',
  messages = [],
  fileLoader,
  maxBodyChars = 12000,
  maxSelectionChars = 6000,
  maxMessages = 12,
}) {
  const normalizedSlug = String(slug).trim();
  if (!normalizedSlug || normalizedSlug.includes('..') || normalizedSlug.includes('/')) {
    throw new Error('document not found');
  }

  const file = await fileLoader(normalizedSlug);
  if (!file) throw new Error('document not found');

  return {
    document: {
      title: String(file.title || normalizedSlug),
      slug: String(file.slug || normalizedSlug),
      body: String(file.body || '').slice(0, maxBodyChars),
    },
    selection: String(selectedText || '').slice(0, maxSelectionChars),
    conversation: messages
      .filter(message => message && (message.role === 'user' || message.role === 'assistant'))
      .slice(-maxMessages)
      .map(message => ({ role: message.role, content: String(message.content || '').slice(0, 6000) })),
    sources: [],
  };
}
```

Implement `toCitation(source)` in `src/agent/citations.js` with a stable ID derived from kind + slug/title, a bounded excerpt, and no raw vector payload.

- [ ] **Step 4: Run the focused tests**

Run:

```bash
node --test tests/agent-context.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit the context contract**

```bash
git add src/agent/context.js src/agent/citations.js tests/agent-context.test.js
git commit -m "feat: add bounded reading context contract"
```

## Task 3: Build the WIPA Retrieval Context Layer

**Files:**
- Create: `src/agent/retrievalContext.js`
- Create: `tests/retrieval-context.test.js`
- Modify: `src/search/vectorStore.js` only to expose an existing safe readiness/count helper if needed
- Modify: `src/search/index.js` only to consume existing Wiki search behavior without changing thresholds

**Interfaces:**
- Consumes: `buildReadingContext`, `semanticSearch`, `wikiSemanticSearch`, `search`, and `getFile`.
- Produces: `buildAgentContext({ query, readingContext, searchers })` returning `{ promptContext, citations, retrievalStatus }`.

- [ ] **Step 1: Write tests for source merging and provenance**

Create tests that verify:

```js
test('buildAgentContext merges Wiki and reading sources with provenance', async () => {
  const result = await buildAgentContext({
    query: 'long-term agent memory',
    readingContext: { document: { title: 'Current article', slug: 'current', body: 'Body' }, selection: '', conversation: [] },
    searchers: {
      wiki: async () => [{ title: 'Agent Memory', slug: 'agent-memory', body: 'Evidence', score: 0.9 }],
      readwise: async () => [{ title: 'External article', slug: 'external', summary: 'Summary', score: 0.8 }],
    },
  });

  assert.equal(result.citations.length, 2);
  assert.equal(result.citations[0].kind, 'wiki');
  assert.match(result.promptContext, /Current article/);
});
```

Also test empty indices, duplicate slugs, and a query with no results.

- [ ] **Step 2: Run tests to verify failure**

```bash
node --test tests/retrieval-context.test.js
```

Expected: FAIL because `src/agent/retrievalContext.js` does not exist.

- [ ] **Step 3: Implement retrieval context assembly**

Use the existing vector thresholds and source order documented in the repository: Wiki semantic hits, Readwise semantic hits, then MiniSearch keyword completion. Deduplicate by `{kind, slug}`. Build a bounded prompt section with explicit labels:

```text
[CURRENT READING]
...

[SELECTED PASSAGE]
...

[PERSONAL KB EVIDENCE]
1. [wiki] Title — excerpt

[EXTERNAL READING EVIDENCE]
1. [readwise] Title — excerpt

[INSTRUCTION]
Separate source-backed facts from inference. Cite source IDs in the response.
```

- [ ] **Step 4: Run focused tests**

```bash
node --test tests/retrieval-context.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit retrieval context**

```bash
git add src/agent/retrievalContext.js tests/retrieval-context.test.js
git commit -m "feat: assemble reading-aware retrieval context"
```

## Task 4: Add the Default Agent Backend Contract

**Files:**
- Create: `src/agent/defaultAgent.js`
- Create: `src/agent/hermesClient.js`
- Create: `tests/default-agent.test.js`
- Modify: `config.js` to add Hermes URL/key/timeouts with local-safe defaults

**Interfaces:**
- Consumes: retrieval context and `{messages, conversationId, mode}`.
- Produces: `runDefaultAgent(input, dependencies)` returning async events `{type:'delta'|'citation'|'status'|'done'|'error', ...}`.
- Produces: `createHermesClient({ baseUrl, apiKey, fetchImpl, timeoutMs })` with `health()` and `streamChat(request)`.

- [ ] **Step 1: Write adapter contract tests with a fake fetch**

Test that the adapter:

```js
const client = createHermesClient({
  baseUrl: 'http://127.0.0.1:8642/v1',
  apiKey: 'local-test-key',
  fetchImpl: async (url, init) => new Response(
    JSON.stringify({ choices: [{ message: { content: 'done' } }] }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  ),
});
```

adds `Authorization: Bearer local-test-key`, sends an OpenAI-compatible request, and converts Hermes failure/timeout into typed errors.

- [ ] **Step 2: Write default-routing tests**

Verify:

```js
await collect(runDefaultAgent({ mode: 'query', messages, context }, { wipaModel, hermes: null }));
await collect(runDefaultAgent({ mode: 'execute', messages, context }, { wipaModel, hermes }));
```

The first uses WIPA directly; the second emits `status: 'delegating'` and calls Hermes. No client-side provider choice is required.

- [ ] **Step 3: Implement config and backend adapter**

Add configuration values:

```js
HERMES_API_URL = process.env.HERMES_API_URL || 'http://127.0.0.1:8642/v1';
HERMES_API_KEY = process.env.HERMES_API_KEY || '';
HERMES_TIMEOUT_MS = Number(process.env.HERMES_TIMEOUT_MS || 120000);
```

Keep the Hermes adapter server-side. Do not expose `HERMES_API_KEY` to HTML or browser JavaScript.

- [ ] **Step 4: Run focused tests**

```bash
node --test tests/default-agent.test.js
```

Expected: PASS, including WIPA fallback when Hermes is unavailable.

- [ ] **Step 5: Commit the default Agent contract**

```bash
git add config.js src/agent/defaultAgent.js src/agent/hermesClient.js tests/default-agent.test.js
git commit -m "feat: add default agent and Hermes adapter"
```

## Task 5: Expose Reading-Aware Agent APIs

**Files:**
- Create: `src/routes/agentRoute.js`
- Modify: `server.js` to register `agentRoute.js`
- Create: `tests/agent-route.test.js`

**Interfaces:**
- `POST /api/agent/query`: accepts `{messages, slug, selectedText, mode:'query'|'execute', conversationId}` and streams SSE events.
- `GET /api/agent/health`: returns WIPA readiness, Vault availability, and Hermes availability without secrets.
- `POST /api/agent/cancel/:runId`: cancels an active Hermes run when supported.

- [ ] **Step 1: Write route contract tests**

Test invalid JSON shape returns `400`, unknown document returns `404`, query mode emits citations, execute mode requires confirmation token, and Hermes failure returns an SSE error event while preserving query availability.

- [ ] **Step 2: Implement request validation and context assembly**

The route must call `buildReadingContext`, `buildAgentContext`, then `runDefaultAgent`. It must never accept a filesystem path or raw Vault path from the client.

- [ ] **Step 3: Implement SSE serialization**

Serialize one event per frame:

```text
event: status
data: {"phase":"retrieving"}

event: citation
data: {"id":"wiki:agent-memory",...}

event: delta
data: {"text":"..."}

event: done
data: {"runId":"..."}
```

End streams with `event: error` and a user-safe message; log detailed diagnostics server-side.

- [ ] **Step 4: Run route tests and smoke test**

```bash
node --test tests/agent-route.test.js
npm test -- --test-reporter=spec
```

Expected: all tests pass.

- [ ] **Step 5: Commit the API surface**

```bash
git add server.js src/routes/agentRoute.js tests/agent-route.test.js
git commit -m "feat: expose reading-aware agent API"
```

## Task 6: Add the Desktop Agent Workspace

**Files:**
- Create: `views/agent.html`
- Create: `src/routes/agentPageRoute.js`
- Modify: `server.js` to register the page route
- Modify: `views/layout.html` to add the Agent entry and preserve existing navigation
- Create: `tests/agent-page.test.js`

**Interfaces:**
- `GET /agent`: renders the desktop Agent home.
- `GET /agent?slug=<slug>&selected=<encoded-text>`: opens the Agent with reading context.
- Client consumes `/api/agent/query` SSE events and renders `status`, `citation`, `delta`, `done`, and `error`.

- [ ] **Step 1: Write page contract tests**

Verify `/agent` contains the query input, recent context region, Agent status region, evidence region, and no Readwise/Reader-specific navigation as a primary action.

- [ ] **Step 2: Implement the page shell**

Create three explicit regions:

```html
<main class="agent-workspace">
  <section class="agent-context-column" aria-label="Reading context"></section>
  <section class="agent-conversation-column" aria-label="Default agent"></section>
  <aside class="agent-evidence-column" aria-label="Evidence and related knowledge"></aside>
</main>
```

Keep the page server-rendered and use existing theme variables.

- [ ] **Step 3: Implement client streaming and citation rendering**

Use `fetch()` with `ReadableStream`/SSE parsing. Render source-backed text separately from Agent inference. Keep the current slug, selected text, and conversation ID in page state; never put the Hermes secret in page state.

- [ ] **Step 4: Run page tests and browser smoke test**

```bash
node --test tests/agent-page.test.js
npm run dev
```

Open `http://localhost:3000/agent`, submit a query against a known Vault article, and verify that a response, at least one citation or an explicit no-evidence state, and a recoverable error state render.

- [ ] **Step 5: Commit the Agent workspace**

```bash
git add views/agent.html src/routes/agentPageRoute.js views/layout.html server.js tests/agent-page.test.js
git commit -m "feat: add desktop reading agent workspace"
```

## Task 7: Connect Article Reading Context to the Agent

**Files:**
- Modify: `views/article.html` to add `Ask Agent` and selection action affordances
- Modify: `src/routes/article.js` to expose safe slug/title context already loaded by the page
- Modify: `views/agent.html` only for incoming context rendering
- Create: `tests/article-agent-context.test.js`

**Interfaces:**
- Article action navigates to `/agent?slug=<slug>`.
- Selected text action navigates to `/agent?slug=<slug>&selected=<encoded-text>`.

- [ ] **Step 1: Write a DOM contract test**

Assert an article page exposes an accessible `Ask Agent` control with the article slug in its destination and a selection handler that caps selected text before navigation.

- [ ] **Step 2: Implement the safe context bridge**

Use `encodeURIComponent` for slug and selection, cap selection to 6,000 characters, and use the existing article slug only; do not serialize the full article body into the URL.

- [ ] **Step 3: Verify behavior in the browser**

Open a representative Wiki article, click `Ask Agent`, submit a question, and verify the Agent page names the article as active context. Select a short passage and verify it appears as selected context.

- [ ] **Step 4: Commit the context bridge**

```bash
git add views/article.html src/routes/article.js views/agent.html tests/article-agent-context.test.js
git commit -m "feat: connect article reading context to agent"
```

## Task 8: Add the Evidence, Related Cards, and Candidate Memory UI

**Files:**
- Create: `src/agent/writeback.js`
- Create: `tests/writeback.test.js`
- Modify: `views/agent.html` for evidence cards, related cards, and candidate-memory review
- Modify: `src/routes/agentRoute.js` with `POST /api/agent/memory-candidates` and `POST /api/agent/memory-candidates/:id/approve`

**Interfaces:**
- `createMemoryCandidate({ source, insight, target })` returns a validated candidate object without writing.
- `approveMemoryCandidate(candidate, vaultWriter)` writes only to an approved target (`Journey`, `Wiki`, or `Projects`) and returns `{path, title}`.

- [ ] **Step 1: Write writeback tests**

Cover: candidate creation, path traversal rejection, allowed target validation, duplicate-safe approval, and writer failure preserving the candidate.

- [ ] **Step 2: Implement candidate-only writeback**

The first pass must store pending candidates in a process-safe local JSON/SQLite mechanism already present in the project, or an in-memory adapter behind the interface for tests; do not write arbitrary client-provided paths. Resolve the final Vault path from a fixed target map.

- [ ] **Step 3: Implement evidence and related-card rendering**

Every card must show source kind, title, excerpt, relation reason, and a link to the source. Inference-only cards must be visually labeled as Agent inference.

- [ ] **Step 4: Verify approval and failure paths**

Run:

```bash
node --test tests/writeback.test.js
```

Then approve one candidate using a test Vault fixture and verify the resulting file is inside the intended Vault subdirectory.

- [ ] **Step 5: Commit evidence and writeback**

```bash
git add src/agent/writeback.js src/routes/agentRoute.js views/agent.html tests/writeback.test.js
git commit -m "feat: add evidence cards and reviewed memory writeback"
```

## Task 9: Apply the mymind-Inspired Visual System and Motion States

**Files:**
- Modify: `views/agent.html` styles and markup
- Modify: `views/article.html` only for Agent affordance styling
- Modify: `public/css/main.css` for shared Agent layout tokens and motion-safe defaults
- Create: `tests/agent-visual-contract.test.js`

**Interfaces:**
- Stable classes: `.agent-workspace`, `.agent-context-column`, `.agent-conversation-column`, `.agent-evidence-column`, `.agent-card`, `.agent-status`, `.agent-citation`, `.agent-action`.
- Stable state attributes: `[data-agent-state="idle|retrieving|thinking|delegating|awaiting-confirmation|complete|error"]`.

- [ ] **Step 1: Write visual contract tests**

Verify the required regions and state attributes exist, active states are announced with `aria-live`, and the layout does not require Readwise/Reader navigation.

- [ ] **Step 2: Implement the visual tokens**

Use the existing theme variables and add only focused Agent tokens: warm paper background, ink text, muted plant green, terracotta action accent, quiet borders, restrained shadows, and dark Agent status surface. Do not introduce a second global design system.

- [ ] **Step 3: Implement motion states**

Use CSS transitions/keyframes for page reveal, Agent breathing, evidence expansion, delegation progress, and completion. Respect `prefers-reduced-motion: reduce` by disabling nonessential motion while retaining state changes.

- [ ] **Step 4: Verify visually across desktop widths and themes**

Use the existing local app and browser verification at widths 1440px, 1180px, and 900px in light and dark themes. Check that reading content remains primary, Agent remains usable, evidence does not cause horizontal overflow, and motion is subtle rather than distracting.

- [ ] **Step 5: Commit the visual system**

```bash
git add views/agent.html views/article.html public/css/main.css tests/agent-visual-contract.test.js
git commit -m "feat: add reading agent visual system and motion states"
```

## Task 10: Integrate Hermes in a Local Safe Profile

**Files:**
- Create: `docs/integrations/hermes-agent.md`
- Create: `scripts/check-hermes.js`
- Modify: `.env.example` if present, otherwise create `.env.example`
- Modify: `src/agent/hermesClient.js` only for verified API capability handling
- Create: `tests/hermes-integration.test.js`

**Interfaces:**
- `scripts/check-hermes.js` checks `/health`, `/v1/models`, and `/v1/capabilities` without exposing the API key.
- Documentation defines local-only binding, API key setup, timeout, cancellation behavior, and approval policy.

- [ ] **Step 1: Write Hermes capability tests with mocked responses**

Test successful health, missing API key, 401, timeout, unsupported cancellation, and capability response that lacks run events.

- [ ] **Step 2: Implement the local checker**

Read `HERMES_API_URL` and `HERMES_API_KEY` from the environment. Print only endpoint, status, model name, and capability booleans; never print the key or request body.

- [ ] **Step 3: Document setup and safety**

Document that Hermes should bind to localhost for the first integration, WIPA calls it server-side, external side effects require confirmation, and the WIPA Vault remains the canonical memory source.

- [ ] **Step 4: Run the integration checks**

```bash
node --test tests/hermes-integration.test.js
node scripts/check-hermes.js
```

Expected: tests pass; the checker reports a clear unavailable state if Hermes is not running instead of failing the WIPA server.

- [ ] **Step 5: Commit the Hermes integration docs/checker**

```bash
git add docs/integrations/hermes-agent.md scripts/check-hermes.js .env.example src/agent/hermesClient.js tests/hermes-integration.test.js
git commit -m "docs: define safe local Hermes integration"
```

## Task 11: End-to-End Verification and Product Handoff

**Files:**
- Modify: `README.md` with the desktop Agent entry point and local Vault/Hermes setup
- Modify: `START_HERE.md` only if it is the current onboarding entry point
- Create: `tests/e2e-reading-agent.test.js` using local HTTP/fake providers
- Create: `docs/superpowers/verification/2026-07-11-reading-agent-verification.md`

**Interfaces:**
- End-to-end flow covers article → Agent → retrieval → citations → Hermes delegation → result/candidate memory.

- [ ] **Step 1: Add a deterministic end-to-end fixture**

Use a temporary fixture Vault containing one article, one linked concept, and one Journey entry. Stub the model and Hermes HTTP adapter; do not use production secrets or mutate the real Vault.

- [ ] **Step 2: Run all automated tests**

```bash
npm test -- --test-reporter=spec
```

Expected: all tests pass with no network dependency.

- [ ] **Step 3: Run the local server smoke test**

```bash
npm run dev
```

Verify:

1. `/agent` opens as the default desktop Agent.
2. A known article opens with an `Ask Agent` action.
3. A query returns streamed text and citations.
4. An unknown query explicitly reports no personal evidence.
5. Hermes unavailable does not break WIPA query mode.
6. An execute request pauses for confirmation before external side effects.
7. A reviewed candidate writes only to the configured Vault target.

- [ ] **Step 4: Perform visual QA**

Check light/dark themes and widths 1440px, 1180px, and 900px. Record screenshots and any failures in `docs/superpowers/verification/2026-07-11-reading-agent-verification.md`.

- [ ] **Step 5: Review branch scope**

Run:

```bash
git status --short
git diff main...HEAD --stat
git log --oneline main..HEAD
```

Confirm unrelated pre-existing changes are not included and all Agent product commits are on `codex/agent-reading-product`.

- [ ] **Step 6: Commit the verification handoff**

```bash
git add README.md START_HERE.md tests/e2e-reading-agent.test.js docs/superpowers/verification/2026-07-11-reading-agent-verification.md
git commit -m "test: verify reading agent product flow"
```

- [ ] **Step 7: Push only after user approval**

After the user approves the verified branch and confirms the target GitHub remote:

```bash
git push -u origin codex/agent-reading-product
```

Do not push the current main branch or unrelated worktree changes.

## Plan Self-Review

- Spec coverage: product positioning (Tasks 6/11), desktop IA (Tasks 6/7), visual and motion system (Task 9), local Vault retrieval (Tasks 2/3/5), Hermes boundary and integration (Tasks 4/10), candidate writeback (Task 8), errors and fallback (Tasks 4/5/10), tests and verification (Task 11), and independent branch delivery (Tasks 1/11) are all mapped.
- Placeholder scan: no unresolved planning markers or unspecified implementation step is used.
- Type consistency: `buildReadingContext`, `buildAgentContext`, `createHermesClient`, `runDefaultAgent`, `createMemoryCandidate`, and `approveMemoryCandidate` are named consistently across tasks.
- Scope: mobile, cloud KB migration, social features, and Readwise/Reader product replacement are explicitly excluded from this plan.
