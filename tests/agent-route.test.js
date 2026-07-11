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
  const address = server.address();
  try { return await callback(`http://127.0.0.1:${address.port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

const dependencies = {
  vaultPath: '/tmp/test-vault',
  fileLoader: async slug => slug === 'current' ? { title: 'Current', slug, body: 'Current body' } : null,
  searchers: {
    wiki: async () => [{ title: 'Memory', slug: 'memory', snippet: 'Evidence', score: 0.9 }],
    readwise: async () => [],
    keyword: async () => [],
  },
  wipaModel: async function* () { yield { type: 'delta', text: 'Answer' }; },
  hermes: null,
};

test('agent route validates messages and unknown documents', async () => {
  await withServer(createAgentRouter(dependencies), async baseUrl => {
    const bad = await fetch(`${baseUrl}/api/agent/query`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: [] }) });
    assert.equal(bad.status, 400);
    const missing = await fetch(`${baseUrl}/api/agent/query`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'Explain' }], slug: 'missing' }) });
    assert.equal(missing.status, 404);
  });
});

test('agent route streams citations and deltas', async () => {
  await withServer(createAgentRouter(dependencies), async baseUrl => {
    const response = await fetch(`${baseUrl}/api/agent/query`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'Explain' }], slug: 'current' }) });
    const text = await response.text();
    assert.equal(response.status, 200);
    assert.match(text, /event: citation/);
    assert.match(text, /event: delta/);
    assert.match(text, /Answer/);
    assert.match(text, /event: done/);
  });
});

test('execute mode requires explicit confirmation', async () => {
  await withServer(createAgentRouter(dependencies), async baseUrl => {
    const response = await fetch(`${baseUrl}/api/agent/query`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'execute', messages: [{ role: 'user', content: 'Run it' }], slug: 'current' }) });
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: 'confirmation_required' });
  });
});
