#!/usr/bin/env tsx
/**
 * PHASE 1D — Recovery Probe (no restart)
 *
 * Continuous loop that probes in parallel:
 *   - /health/live                  (Node process alive)
 *   - /health/ready                 (DB + deps ok according to the indicator)
 *   - direct Redis PING via ioredis (Redis reachable)
 *
 * Prints ONE line per second with timestamps + status; on SIGINT it
 * writes a full JSONL to apps/api/logs/fase1d-recovery-<ts>.jsonl.
 *
 * Usage:
 *   pnpm tsx apps/api/scripts/fase1d-recovery.ts
 *   (Ctrl+C to stop and write the report.)
 *
 * The orchestrator (PowerShell) is the one that triggers `docker stop` / `docker start`.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Redis from 'ioredis';

const API_URL = (process.env['API_URL'] ?? 'http://localhost:3001').replace(/\/$/, '');
const REDIS_URL = process.env['REDIS_QUEUE_URL'] ?? process.env['REDIS_URL'] ?? 'redis://localhost:6379';
const TICK_MS = 1000;
const HTTP_TIMEOUT_MS = 4000;

type ProbeOutcome =
  | { kind: 'http'; status: number; ms: number }
  | { kind: 'timeout'; ms: number }
  | { kind: 'network-error'; error: string; ms: number };

interface Tick {
  ts: string;
  uptimeSec: number;
  live: ProbeOutcome;
  ready: ProbeOutcome;
  redisPing: ProbeOutcome;
}

const log: Tick[] = [];
const startedAt = Date.now();

async function probeHttp(path: string): Promise<ProbeOutcome> {
  const t0 = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_URL}${path}`, { signal: controller.signal });
    await res.text(); // drain body
    return { kind: 'http', status: res.status, ms: Date.now() - t0 };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (controller.signal.aborted) return { kind: 'timeout', ms: Date.now() - t0 };
    return { kind: 'network-error', error: message.split('\n')[0].slice(0, 120), ms: Date.now() - t0 };
  } finally {
    clearTimeout(timer);
  }
}

// One ioredis instance kept alive — measures from-process reachability without
// inheriting the API's connection pool state.
const probeRedis = new Redis(REDIS_URL, {
  lazyConnect: true,
  enableReadyCheck: false,
  enableOfflineQueue: false,
  connectTimeout: 2000,
  maxRetriesPerRequest: 0,
  retryStrategy: () => 1000, // try again every 1s when down
});
probeRedis.on('error', () => { /* swallow; we surface via ping() below */ });

async function probeRedisPing(): Promise<ProbeOutcome> {
  const t0 = Date.now();
  try {
    if (probeRedis.status !== 'ready' && probeRedis.status !== 'connecting' && probeRedis.status !== 'connect') {
      // try lazy connect
      probeRedis.connect().catch(() => {});
    }
    const result = await Promise.race([
      probeRedis.ping(),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), HTTP_TIMEOUT_MS)),
    ]);
    if (result === 'PONG') return { kind: 'http', status: 200, ms: Date.now() - t0 };
    return { kind: 'network-error', error: `unexpected: ${String(result)}`, ms: Date.now() - t0 };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'timeout') return { kind: 'timeout', ms: Date.now() - t0 };
    return { kind: 'network-error', error: message.split('\n')[0].slice(0, 120), ms: Date.now() - t0 };
  }
}

function fmt(o: ProbeOutcome): string {
  if (o.kind === 'http') return `${o.status} ${o.ms}ms`;
  if (o.kind === 'timeout') return `TMO  ${o.ms}ms`;
  return `ERR  ${o.error.slice(0, 30)}`;
}

let previousLine = '';
async function tick(): Promise<void> {
  const ts = new Date().toISOString();
  const [live, ready, redisPing] = await Promise.all([
    probeHttp('/api/v1/health/live'),
    probeHttp('/api/v1/health/ready'),
    probeRedisPing(),
  ]);
  const entry: Tick = {
    ts,
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    live, ready, redisPing,
  };
  log.push(entry);
  const line = `[${ts.slice(11, 19)}] live=${fmt(live).padEnd(14)} ready=${fmt(ready).padEnd(14)} redis=${fmt(redisPing).padEnd(14)}`;
  // Always print — caller wants timeline
  if (line !== previousLine || log.length % 5 === 0) {
    console.log(line);
    previousLine = line;
  }
}

async function main(): Promise<void> {
  console.log(`PHASE 1D probe → API=${API_URL}  REDIS=${REDIS_URL.replace(/:[^@]*@/, ':***@')}`);
  console.log('Press Ctrl+C to stop and write the report.\n');

  const interval = setInterval(() => {
    tick().catch((err) => console.error('[tick error]', err));
  }, TICK_MS);

  const shutdown = (signal: string) => {
    clearInterval(interval);
    try { probeRedis.disconnect(false); } catch { /* noop */ }
    const logsDir = join(process.cwd(), 'apps', 'api', 'logs');
    try { mkdirSync(logsDir, { recursive: true }); } catch { /* noop */ }
    const outPath = join(logsDir, `fase1d-recovery-${Date.now()}.jsonl`);
    const lines = log.map((e) => JSON.stringify(e)).join('\n');
    writeFileSync(outPath, lines + '\n', 'utf8');

    // Summary
    const liveOk = log.filter((e) => e.live.kind === 'http' && e.live.status === 200).length;
    const readyOk = log.filter((e) => e.ready.kind === 'http' && e.ready.status === 200).length;
    const ready503 = log.filter((e) => e.ready.kind === 'http' && e.ready.status === 503).length;
    const redisOk = log.filter((e) => e.redisPing.kind === 'http' && e.redisPing.status === 200).length;
    console.log(`\n── ${signal} — ${log.length} ticks written to ${outPath}`);
    console.log(`   live  200: ${liveOk}/${log.length}`);
    console.log(`   ready 200: ${readyOk}/${log.length}  503: ${ready503}/${log.length}`);
    console.log(`   redis PING: ${redisOk}/${log.length}`);
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => { console.error('[fase1d-recovery] fatal:', err); process.exit(1); });
