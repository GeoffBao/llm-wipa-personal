import test from 'node:test';
import assert from 'node:assert/strict';

test('test harness is available', () => {
  assert.equal(typeof test, 'function');
});
