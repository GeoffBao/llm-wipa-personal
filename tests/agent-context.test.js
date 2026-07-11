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

test('buildReadingContext permits a query with no active reading document', async () => {
  const context = await buildReadingContext({ messages: [], fileLoader: async () => null });
  assert.equal(context.document, null);
});
