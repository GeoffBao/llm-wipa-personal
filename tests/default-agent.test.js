import test from 'node:test';
import assert from 'node:assert/strict';
import { createHermesClient } from '../src/agent/hermesClient.js';
import { runDefaultAgent } from '../src/agent/defaultAgent.js';

async function collect(iterable) {
  const events = [];
  for await (const event of iterable) events.push(event);
  return events;
}

test('Hermes adapter sends an OpenAI-compatible request with bearer auth', async () => {
  let captured;
  const client = createHermesClient({
    baseUrl: 'http://127.0.0.1:8642/v1',
    apiKey: 'local-test-key',
    fetchImpl: async (url, init) => {
      captured = { url, init };
      return new Response(JSON.stringify({ choices: [{ message: { content: 'done' } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  const events = await collect(client.streamChat({ messages: [{ role: 'user', content: 'Run it' }] }));
  assert.equal(captured.url, 'http://127.0.0.1:8642/v1/chat/completions');
  assert.equal(captured.init.headers.Authorization, 'Bearer local-test-key');
  assert.deepEqual(JSON.parse(captured.init.body).messages, [{ role: 'user', content: 'Run it' }]);
  assert.deepEqual(events, [{ type: 'delta', text: 'done' }]);
});

test('query mode uses WIPA and execute mode delegates to Hermes', async () => {
  const wipaModel = async function* () { yield { type: 'delta', text: 'WIPA answer' }; };
  const hermes = { streamChat: async function* () { yield { type: 'delta', text: 'Hermes result' }; } };
  const context = { promptContext: 'Current reading: Example' };

  const queryEvents = await collect(runDefaultAgent({ mode: 'query', messages: [{ role: 'user', content: 'Explain' }], context }, { wipaModel, hermes }));
  const executeEvents = await collect(runDefaultAgent({ mode: 'execute', messages: [{ role: 'user', content: 'Run' }], context }, { wipaModel, hermes }));

  assert.deepEqual(queryEvents.map(event => event.type), ['delta', 'done']);
  assert.deepEqual(executeEvents.map(event => event.type), ['status', 'delta', 'done']);
  assert.equal(executeEvents[1].text, 'Hermes result');
});

test('execute mode falls back to WIPA when Hermes is unavailable', async () => {
  const wipaModel = async function* () { yield { type: 'delta', text: 'safe fallback' }; };
  const events = await collect(runDefaultAgent({ mode: 'execute', messages: [], context: {} }, { wipaModel, hermes: null }));
  assert.deepEqual(events.map(event => event.type), ['status', 'delta', 'done']);
  assert.equal(events[0].phase, 'fallback');
});
