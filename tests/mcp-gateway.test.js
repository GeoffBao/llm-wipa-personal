import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('MCP ask tool targets the Reading Agent API and parses citations', async () => {
  const source = await readFile(new URL('../mcp/src/tools/askKB.js', import.meta.url), 'utf8');
  assert.match(source, /\/api\/agent\/query/);
  assert.doesNotMatch(source, /\/api\/chat/);
  assert.match(source, /evt\.type === 'citation'/);
  assert.match(source, /evt\.text/);
});

test('MCP onboarding points to the independent wipagents project', async () => {
  const home = await readFile(new URL('../views/home.html', import.meta.url), 'utf8');
  const readme = await readFile(new URL('../mcp/README.md', import.meta.url), 'utf8');
  assert.match(home, /Workspace\/ClaudeCode\/wipagents\/mcp\/index\.js/);
  assert.match(readme, /Workspace\/ClaudeCode\/wipagents\/mcp\/index\.js/);
});
