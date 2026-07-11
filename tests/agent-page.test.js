import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Agent page exposes the desktop workspace contract', async () => {
  const html = await readFile(new URL('../views/agent.html', import.meta.url), 'utf8');
  assert.match(html, /class="agent-workspace"/);
  assert.match(html, /aria-label="Reading context"/);
  assert.match(html, /aria-label="Default agent"/);
  assert.match(html, /aria-label="Evidence and related knowledge"/);
  assert.ok(html.includes('/api/agent/query'));
  assert.match(html, /data-agent-state/);
});
