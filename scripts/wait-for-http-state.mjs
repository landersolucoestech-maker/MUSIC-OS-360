#!/usr/bin/env node
/**
 * scripts/wait-for-http-state.mjs
 *
 * Deploy-order gate (DB-M2, docs/engineering/database.md "Deploy order"):
 * waits until an HTTP endpoint is observably UP (HTTP 200) or DOWN (anything
 * else: connection refused, timeout, 5xx/4xx) for N consecutive probes, and
 * fails when that never happens within the timeout. staging.yml uses it to
 * prove no build is serving before migrating/rolling back the database, and
 * that the new build is serving after the deploy hook.
 *
 * Usage:
 *   node scripts/wait-for-http-state.mjs --url https://api/api/v1/health/live --until down \
 *     [--consecutive 3] [--interval 5] [--timeout 300] [--request-timeout 5]
 */
import { fileURLToPath } from 'node:url';

/** Pure decision: true once the last `consecutive` observations all match `until`. */
export function reachedState(observations, until, consecutive) {
  if (observations.length < consecutive) return false;
  return observations.slice(-consecutive).every((up) => (until === 'up' ? up : !up));
}

export function parseArgs(argv) {
  const args = { url: null, until: null, consecutive: 3, interval: 5, timeout: 300, requestTimeout: 5 };
  for (let i = 0; i < argv.length; i += 1) {
    const [flag, value] = [argv[i], argv[i + 1]];
    if (flag === '--url') args.url = value;
    else if (flag === '--until') args.until = value;
    else if (flag === '--consecutive') args.consecutive = Number(value);
    else if (flag === '--interval') args.interval = Number(value);
    else if (flag === '--timeout') args.timeout = Number(value);
    else if (flag === '--request-timeout') args.requestTimeout = Number(value);
    else throw new Error(`unknown argument: ${flag}`);
    i += 1;
  }
  if (!args.url || !/^https?:\/\//.test(args.url)) throw new Error('--url must be an http(s) URL');
  if (args.until !== 'up' && args.until !== 'down') throw new Error('--until must be "up" or "down"');
  for (const key of ['consecutive', 'interval', 'timeout', 'requestTimeout']) {
    if (!Number.isFinite(args[key]) || args[key] <= 0) throw new Error(`--${key} must be a positive number`);
  }
  return args;
}

async function probe(url, requestTimeoutSeconds) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(requestTimeoutSeconds * 1000), redirect: 'manual' });
    return { up: response.status === 200, detail: `HTTP ${response.status}` };
  } catch (error) {
    return { up: false, detail: error?.name === 'TimeoutError' ? 'timeout' : 'connection error' };
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const deadline = Date.now() + args.timeout * 1000;
  const observations = [];
  for (;;) {
    const { up, detail } = await probe(args.url, args.requestTimeout);
    observations.push(up);
    console.log(`[wait-for-http-state] ${new Date().toISOString()} ${detail} (${up ? 'up' : 'down'})`);
    if (reachedState(observations, args.until, args.consecutive)) {
      console.log(`[wait-for-http-state] ${args.until.toUpperCase()} confirmed by ${args.consecutive} consecutive probes.`);
      return;
    }
    if (Date.now() + args.interval * 1000 > deadline) {
      console.error(`::error::${args.url} did not stay ${args.until} for ${args.consecutive} consecutive probes within ${args.timeout}s.`);
      process.exit(1);
    }
    await new Promise((resolve) => setTimeout(resolve, args.interval * 1000));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`::error::[wait-for-http-state] ${error.message}`);
    process.exit(1);
  });
}
