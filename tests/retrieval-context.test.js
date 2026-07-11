import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAgentContext } from '../src/agent/retrievalContext.js';

test('buildAgentContext merges Wiki and reading sources with provenance', async () => {
  const result = await buildAgentContext({
    query: 'long-term agent memory',
    readingContext: {
      document: { title: 'Current article', slug: 'current', body: 'Body' },
      selection: '',
      conversation: [],
    },
    searchers: {
      wiki: async () => [{ title: 'Agent Memory', slug: 'agent-memory', body: 'Evidence', score: 0.9 }],
      readwise: async () => [{ title: 'External article', slug: 'external', summary: 'Summary', score: 0.8 }],
    },
  });

  assert.equal(result.citations.length, 2);
  assert.equal(result.citations[0].kind, 'wiki');
  assert.match(result.promptContext, /Current article/);
  assert.equal(result.retrievalStatus.hasEvidence, true);
});

test('buildAgentContext removes duplicate wiki results and rejects low scores', async () => {
  const result = await buildAgentContext({
    query: 'memory',
    readingContext: { document: null, selection: '', conversation: [] },
    searchers: {
      wiki: async () => [
        { title: 'Same', slug: 'same', snippet: 'first', score: 0.8 },
        { title: 'Same', slug: 'same', snippet: 'duplicate', score: 0.9 },
        { title: 'Weak', slug: 'weak', snippet: 'weak', score: 0.2 },
      ],
    },
  });

  assert.deepEqual(result.citations.map(source => source.slug), ['same']);
});

test('buildAgentContext reports explicit no-evidence state', async () => {
  const result = await buildAgentContext({
    query: 'unknown',
    readingContext: { document: null, selection: '', conversation: [] },
  });

  assert.equal(result.retrievalStatus.hasEvidence, false);
  assert.match(result.promptContext, /No personal KB evidence found/);
});
