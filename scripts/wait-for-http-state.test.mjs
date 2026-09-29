import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, reachedState } from './wait-for-http-state.mjs';

test('down needs N consecutive non-200 probes; a 200 in between restarts the count', () => {
  assert.equal(reachedState([false, false], 'down', 3), false);
  assert.equal(reachedState([false, false, false], 'down', 3), true);
  assert.equal(reachedState([false, false, true, false, false], 'down', 3), false);
  assert.equal(reachedState([true, false, false, false], 'down', 3), true);
});

test('up needs N consecutive 200 probes', () => {
  assert.equal(reachedState([true, true, false], 'up', 2), false);
  assert.equal(reachedState([false, true, true], 'up', 2), true);
});

test('arguments are validated (fail closed)', () => {
  assert.throws(() => parseArgs(['--until', 'down']), /--url/);
  assert.throws(() => parseArgs(['--url', 'ftp://x', '--until', 'down']), /--url/);
  assert.throws(() => parseArgs(['--url', 'https://x', '--until', 'sideways']), /--until/);
  assert.throws(() => parseArgs(['--url', 'https://x', '--until', 'up', '--timeout', '0']), /timeout/);
  assert.throws(() => parseArgs(['--url', 'https://x', '--until', 'up', '--bogus', '1']), /unknown argument/);
  assert.deepEqual(parseArgs(['--url', 'https://x/api/v1/health/live', '--until', 'down', '--consecutive', '4']), {
    url: 'https://x/api/v1/health/live', until: 'down', consecutive: 4, interval: 5, timeout: 300, requestTimeout: 5,
  });
});
