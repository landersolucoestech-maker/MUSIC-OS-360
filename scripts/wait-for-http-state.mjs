#!/usr/bin/env node
/**
 * scripts/wait-for-http-state.mjs
 *
 * Deploy-order gate (DB-M2, docs/engineering/database.md "Deploy order"):
 * waits until the API liveness endpoint is observably UP or DOWN for N
 * consecutive probes, and fails when that never happens within the timeout.
 * staging.yml uses it to prove the running build is reachable before stopping
 * it, that no build is serving before migrating/rolling back the database,
 * and that the build of this run is serving after the deploy hook.
 *
 * Each probe is classified (fail closed — anything unexpected is not proof):
 *   up           HTTP 200 whose JSON body says status "up" (liveness) or "ok"
 *                (Terminus readiness), plain or inside the API's { data }
 *                envelope, and, with --expect-build, whose
 *                `build` is exactly that commit;
 *   down         connection refused/reset, DNS failure, timeout, HTTP 502/503/504
 *                (nothing, or only the platform's proxy, answers);
 *   inconclusive anything else: 3xx, 4xx (a wrong path answers 404 while the
 *                build is still serving), other 5xx, a 200 from another build.
 * Only N consecutive probes in the target state count; an inconclusive probe
 * resets the count.
 *
 * Usage:
 *   node scripts/wait-for-http-state.mjs --url https://api/api/v1/health/live --until down|up \
 *     [--expect-build <sha>] [--consecutive 3] [--interval 5] [--timeout 300] [--request-timeout 5]
 */
import { fileURLToPath } from 'node:url';

const DOWN_STATUSES = new Set([502, 503, 504]);

/** Pure decision: true once the last `consecutive` observations are all `until`. */
export function reachedState(observations, until, consecutive) {
  if (observations.length < consecutive) return false;
  return observations.slice(-consecutive).every((state) => state === until);
}

/** Pure classification of one probe result (see the header). */
export function classifyProbe({ error, status, body }, expectBuild) {
  if (error) return 'down';
  if (DOWN_STATUSES.has(status)) return 'down';
  if (status !== 200) return 'inconclusive';
  const payload = body && typeof body === 'object' && body.data && typeof body.data === 'object' ? body.data : body;
  if (!payload || (payload.status !== 'up' && payload.status !== 'ok')) return 'inconclusive';
  if (expectBuild && payload.build !== expectBuild) return 'inconclusive';
  return 'up';
}

export function parseArgs(argv) {
  const args = { url: null, until: null, expectBuild: null, consecutive: 3, interval: 5, timeout: 300, requestTimeout: 5 };
  for (let i = 0; i < argv.length; i += 1) {
    const [flag, value] = [argv[i], argv[i + 1]];
    if (flag === '--url') args.url = value;
    else if (flag === '--until') args.until = value;
    else if (flag === '--expect-build') args.expectBuild = value;
    else if (flag === '--consecutive') args.consecutive = Number(value);
    else if (flag === '--interval') args.interval = Number(value);
    else if (flag === '--timeout') args.timeout = Number(value);
    else if (flag === '--request-timeout') args.requestTimeout = Number(value);
    else throw new Error(`unknown argument: ${flag}`);
    i += 1;
  }
  if (!args.url || !/^https?:\/\//.test(args.url)) throw new Error('--url must be an http(s) URL');
  // A doubled slash (base URL ending in "/") reaches a 404 route, never the health endpoint.
  if (new URL(args.url).pathname.includes('//')) throw new Error('--url path must not contain "//" (strip the trailing slash of the base URL)');
  if (args.until !== 'up' && args.until !== 'down') throw new Error('--until must be "up" or "down"');
  if (args.expectBuild !== null && !/^[0-9a-f]{7,40}$/i.test(args.expectBuild)) throw new Error('--expect-build must be a commit SHA');
  for (const key of ['consecutive', 'interval', 'timeout', 'requestTimeout']) {
    if (!Number.isFinite(args[key]) || args[key] <= 0) throw new Error(`--${key} must be a positive number`);
  }
  return args;
}

export async function probe(url, requestTimeoutSeconds) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(requestTimeoutSeconds * 1000), redirect: 'manual' });
    let body = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    return { status: response.status, body, detail: `HTTP ${response.status}` };
  } catch (error) {
    return { error: true, detail: error?.name === 'TimeoutError' ? 'timeout' : 'connection error' };
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const deadline = Date.now() + args.timeout * 1000;
  const observations = [];
  for (;;) {
    const result = await probe(args.url, args.requestTimeout);
    const state = classifyProbe(result, args.expectBuild);
    observations.push(state);
    console.log(`[wait-for-http-state] ${new Date().toISOString()} ${result.detail} (${state})`);
    if (reachedState(observations, args.until, args.consecutive)) {
      console.log(`[wait-for-http-state] ${args.until.toUpperCase()} confirmed by ${args.consecutive} consecutive probes.`);
      return;
    }
    if (Date.now() + args.interval * 1000 > deadline) {
      const expected = args.expectBuild ? ` (build ${args.expectBuild})` : '';
      console.error(`::error::${args.url} was not observed ${args.until}${expected} for ${args.consecutive} consecutive probes within ${args.timeout}s (last: ${result.detail}, ${state}).`);
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
