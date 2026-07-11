import test from 'node:test';
import assert from 'node:assert/strict';
import { approveMemoryCandidate, createMemoryCandidate, createVaultWriter } from '../src/agent/writeback.js';

test('candidate creation validates target and bounds content', () => {
  const candidate = createMemoryCandidate({ source: 'Article', insight: 'A useful insight', target: 'wiki' });
  assert.equal(candidate.target, 'wiki');
  assert.equal(candidate.status, 'pending');
  assert.throws(() => createMemoryCandidate({ source: 'Article', insight: 'x', target: '../private' }), /invalid writeback target/);
});

test('approval is idempotent and writes only through the injected writer', async () => {
  const candidate = createMemoryCandidate({ source: 'Article', insight: 'A useful insight' });
  const calls = [];
  const writer = async input => { calls.push(input); return { path: '/vault/Journey/agent.md', title: input.title }; };
  const first = await approveMemoryCandidate(candidate, writer);
  const second = await approveMemoryCandidate(candidate, writer);
  assert.deepEqual(first, second);
  assert.equal(calls.length, 1);
});

test('Vault writer resolves a fixed safe target', async () => {
  const candidate = createMemoryCandidate({ source: 'Article', insight: 'A useful insight', target: 'projects' });
  const calls = [];
  const writer = createVaultWriter({
    vaultPath: '/vault',
    mkdirImpl: async (...args) => calls.push(['mkdir', ...args]),
    writeFileImpl: async (...args) => calls.push(['write', ...args]),
  });
  await writer(candidate);
  assert.equal(calls[0][1], '/vault/Projects');
  assert.match(calls[1][1], /^\/vault\/Projects\/agent-[^/]+\.md$/);
});
