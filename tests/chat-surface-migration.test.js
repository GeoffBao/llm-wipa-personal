import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('visible product surfaces point to Reading Agent instead of legacy Chat', async () => {
  const files = [
    'views/layout.html', 'views/home.html', 'desktop/main.js',
    'public/js/workspace.js', 'public/js/split-pane.js', 'public/js/palette.js',
  ];
  const contents = await Promise.all(files.map(file => readFile(new URL('../' + file, import.meta.url), 'utf8')));
  const visible = contents.join('\n');
  assert.doesNotMatch(visible, /href="\/chat"|URL \+ '\/chat'|nav\('\/chat|data-pane="chat"/);
  assert.match(visible, /Reading Agent/);
});

test('legacy Chat page redirects to the new Agent surface while API remains available', async () => {
  const route = await readFile(new URL('../src/routes/chatRoute.js', import.meta.url), 'utf8');
  assert.match(route, /res\.redirect\(`\/agent/);
  assert.match(route, /router\.post\('\/api\/chat'/);
});
