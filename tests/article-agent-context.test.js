import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('article page exposes safe Agent context actions', async () => {
  const html = await readFile(new URL('../views/article.html', import.meta.url), 'utf8');
  assert.match(html, /href="\/agent\?slug=\{\{slug\}\}"/);
  assert.match(html, /encodeURIComponent\(selectedText\)/);
  assert.match(html, /slice\(0, 6000\)/);
  assert.match(html, /article-selection-agent/);
});
