import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createAgentRouter } from '../src/routes/agentRoute.js';

async function withServer(router, callback) {
  const app = express();
  app.use(express.json());
  app.use(router);
  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const { port } = server.address();
  try { return await callback(`http://127.0.0.1:${port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('reading agent end-to-end flow returns evidence and writes reviewed memory', async () => {
  const candidateStore = new Map();
  const writes = [];
  const router = createAgentRouter({
    vaultPath: '/fixture-vault',
    candidateStore,
    fileLoader: async slug => slug === 'agent-memory' ? {
      title: 'Agent Memory', slug, body: 'A reading context about long-term memory.',
    } : null,
    searchers: {
      wiki: async () => [{ kind: 'wiki', title: 'Cognitive Cache', slug: 'cognitive-cache', excerpt: 'Personal context reduces repeated work.', score: 0.91 }],
      readwise: async () => [],
      keyword: async () => [],
    },
    wipaModel: async function* () { yield { type: 'delta', text: 'This connects to your memory system.' }; },
    hermes: null,
    vaultWriter: async candidate => { writes.push(candidate); return { path: '/fixture-vault/Journey/agent.md', title: candidate.title }; },
  });

  await withServer(router, async baseUrl => {
    const queryResponse = await fetch(`${baseUrl}/api/agent/query`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug: 'agent-memory', messages: [{ role: 'user', content: 'How does this connect to my memory system?' }] }),
    });
    const queryText = await queryResponse.text();
    assert.equal(queryResponse.status, 200);
    assert.match(queryText, /event: citation/);
    assert.match(queryText, /Cognitive Cache/);
    assert.match(queryText, /This connects to your memory system/);

    const candidateResponse = await fetch(`${baseUrl}/api/agent/memory-candidates`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source: 'Agent Memory', insight: 'Keep memory as a reusable context layer.', target: 'journey' }),
    });
    const candidate = await candidateResponse.json();
    assert.equal(candidateResponse.status, 201);

    const approvalResponse = await fetch(`${baseUrl}/api/agent/memory-candidates/${candidate.id}/approve`, { method: 'POST' });
    const approval = await approvalResponse.json();
    assert.equal(approvalResponse.status, 200);
    assert.equal(approval.candidate.status, 'approved');
    assert.equal(writes.length, 1);
  });
});
