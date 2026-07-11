import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Agent visual contract includes stable regions and reduced-motion support', async () => {
  const view = await readFile(new URL('../views/agent.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('../public/css/main.css', import.meta.url), 'utf8');
  for (const token of ['agent-workspace', 'agent-context-column', 'agent-conversation-column', 'agent-evidence-column', 'data-agent-state']) {
    assert.ok(view.includes(token), `missing ${token}`);
  }
  assert.match(view, /prefers-reduced-motion/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /data-agent-state="delegating"/);
});
