import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyProbe, parseArgs, reachedState } from './wait-for-http-state.mjs';

const SHA = '1dfd59547e2ba2a2916d90944e2be8ee702f8c97';

test('N consecutive probes in the target state; any other state restarts the count', () => {
  assert.equal(reachedState(['down', 'down'], 'down', 3), false);
  assert.equal(reachedState(['down', 'down', 'down'], 'down', 3), true);
  assert.equal(reachedState(['down', 'inconclusive', 'down', 'down'], 'down', 3), false);
  assert.equal(reachedState(['up', 'down', 'down', 'down'], 'down', 3), true);
  assert.equal(reachedState(['up', 'up', 'inconclusive'], 'up', 2), false);
  assert.equal(reachedState(['inconclusive', 'up', 'up'], 'up', 2), true);
});

test('only nothing answering (or the proxy saying the upstream is gone) is down', () => {
  assert.equal(classifyProbe({ error: true }), 'down');
  for (const status of [502, 503, 504]) assert.equal(classifyProbe({ status, body: null }), 'down');
});

test('a wrong path, a redirect or an auth wall is never proof the build stopped (DB-M2 M1)', () => {
  // e.g. STAGING_API_URL ending in "/" -> https://host//api/v1/health/live -> 404 from the running build
  for (const status of [301, 302, 307, 401, 403, 404, 429, 500]) {
    assert.equal(classifyProbe({ status, body: { statusCode: status } }), 'inconclusive', `HTTP ${status}`);
  }
});

test('up needs the liveness body, plain or inside the API envelope, and the expected build', () => {
  assert.equal(classifyProbe({ status: 200, body: { status: 'up' } }), 'up');
  assert.equal(classifyProbe({ status: 200, body: { data: { status: 'ok', info: { database: { status: 'up' } } } } }), 'up');
  assert.equal(classifyProbe({ status: 200, body: { data: { status: 'up', build: SHA }, timestamp: 't' } }, SHA), 'up');
  assert.equal(classifyProbe({ status: 200, body: { data: { status: 'up', build: 'abc1234' } } }, SHA), 'inconclusive');
  assert.equal(classifyProbe({ status: 200, body: { data: { status: 'up', build: null } } }, SHA), 'inconclusive');
  assert.equal(classifyProbe({ status: 200, body: '<html>maintenance</html>' }), 'inconclusive');
  assert.equal(classifyProbe({ status: 200, body: null }), 'inconclusive');
});

test('arguments are validated (fail closed)', () => {
  assert.throws(() => parseArgs(['--until', 'down']), /--url/);
  assert.throws(() => parseArgs(['--url', 'ftp://x', '--until', 'down']), /--url/);
  assert.throws(() => parseArgs(['--url', 'https://x//api/v1/health/live', '--until', 'down']), /"\/\/"/);
  assert.throws(() => parseArgs(['--url', 'https://x', '--until', 'sideways']), /--until/);
  assert.throws(() => parseArgs(['--url', 'https://x', '--until', 'up', '--timeout', '0']), /timeout/);
  assert.throws(() => parseArgs(['--url', 'https://x', '--until', 'up', '--expect-build', 'main']), /SHA/);
  assert.throws(() => parseArgs(['--url', 'https://x', '--until', 'up', '--bogus', '1']), /unknown argument/);
  assert.deepEqual(parseArgs(['--url', 'https://x/api/v1/health/live', '--until', 'up', '--expect-build', SHA, '--consecutive', '4']), {
    url: 'https://x/api/v1/health/live', until: 'up', expectBuild: SHA, consecutive: 4, interval: 5, timeout: 300, requestTimeout: 5,
  });
});

test('against a real server: the running build is up on its path and inconclusive on a doubled slash', async () => {
  const { createServer } = await import('node:http');
  const { probe } = await import('./wait-for-http-state.mjs');
  const server = createServer((req, res) => {
    const ok = req.url === '/api/v1/health/live';
    res.writeHead(ok ? 200 : 404, { 'content-type': 'application/json' });
    res.end(JSON.stringify(ok ? { data: { status: 'up', build: SHA }, timestamp: 't' } : { statusCode: 404 }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal(classifyProbe(await probe(`${base}/api/v1/health/live`, 2), SHA), 'up');
    assert.equal(classifyProbe(await probe(`${base}//api/v1/health/live`, 2), SHA), 'inconclusive');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  assert.equal(classifyProbe(await probe(`${base}/api/v1/health/live`, 2)), 'down');
});
