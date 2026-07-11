import test from 'node:test';
import assert from 'node:assert/strict';
import { checkHermes } from '../scripts/check-hermes.js';

test('Hermes checker reports missing configuration without making a request', async () => {
  let calls = 0;
  const result = await checkHermes({ apiKey: '', fetchImpl: async () => { calls += 1; } });
  assert.deepEqual(result, { available: false, reason: 'HERMES_API_KEY is not configured' });
  assert.equal(calls, 0);
});

test('Hermes checker reports capabilities without exposing credentials', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith('/health')) return new Response('{}', { status: 200 });
    if (url.endsWith('/models')) return new Response(JSON.stringify({ data: [{ id: 'hermes-agent' }] }), { status: 200 });
    return new Response(JSON.stringify({ features: { chat_completions: true, run_events_sse: true } }), { status: 200 });
  };
  const result = await checkHermes({ baseUrl: 'http://127.0.0.1:8642/v1', apiKey: 'secret', fetchImpl });
  assert.deepEqual(result, { available: true, model: 'hermes-agent', capabilities: { chat_completions: true, run_events_sse: true } });
  assert.equal(calls.every(call => call.init.headers.Authorization === 'Bearer secret'), true);
  assert.equal(JSON.stringify(result).includes('secret'), false);
});

test('Hermes checker handles unreachable backend', async () => {
  const result = await checkHermes({ apiKey: 'secret', fetchImpl: async () => { throw new Error('connection refused'); } });
  assert.deepEqual(result, { available: false, reason: 'connection refused' });
});
