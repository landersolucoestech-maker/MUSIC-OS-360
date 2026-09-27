#!/usr/bin/env tsx
import { Queue, QueueEvents, Worker, JobsOptions } from 'bullmq';
import IORedis from 'ioredis';
import * as fs from 'fs';
import * as path from 'path';

type Check = { name: string; ok: boolean; detail?: unknown };

const envPath = path.resolve(__dirname, '../.env.development');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  }
}

function redisUrl(): string {
  if (process.env.REDIS_QUEUE_URL) return process.env.REDIS_QUEUE_URL;
  if (process.env.REDIS_URL) return process.env.REDIS_URL;
  if (process.env.REDIS_HOST) {
    const port = process.env.REDIS_PORT || '6379';
    const password = process.env.REDIS_PASSWORD ? `:${encodeURIComponent(process.env.REDIS_PASSWORD)}@` : '';
    return `redis://${password}${process.env.REDIS_HOST}:${port}`;
  }
  return 'redis://127.0.0.1:6379';
}

function connection(url: string) {
  return new IORedis(url, {
    lazyConnect: true,
    enableReadyCheck: false,
    enableOfflineQueue: false,
    connectTimeout: 4000,
    maxRetriesPerRequest: null,
    retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 1000)),
  });
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const checks: Check[] = [];
  const url = redisUrl();
  const prefix = `phase1b-${Date.now()}`;
  const queueName = `${prefix}-queue`;
  const queueConnection = connection(url);
  const workerConnection = connection(url);
  const eventsConnection = connection(url);

  console.log(JSON.stringify({ phase: 'PHASE 1B', provider: url.includes('127.0.0.1') || url.includes('localhost') ? 'local' : 'remote', url: url.replace(/\/\/.*@/, '//***@') }));

  try {
    await queueConnection.connect();
    const ping = await queueConnection.ping();
    const evalResult = await queueConnection.eval('return 1', 0);
    checks.push({ name: 'redis.ping', ok: ping === 'PONG', detail: ping });
    checks.push({ name: 'redis.eval', ok: evalResult === 1, detail: evalResult });

    const queue = new Queue(queueName, {
      connection: queueConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'fixed', delay: 100 },
        removeOnComplete: false,
        removeOnFail: false,
      },
    });
    const events = new QueueEvents(queueName, { connection: eventsConnection });
    await events.waitUntilReady();

    const processed: Array<{ id?: string; name: string; attemptsMade: number }> = [];
    const worker = new Worker(
      queueName,
      async (job) => {
        processed.push({ id: job.id, name: job.name, attemptsMade: job.attemptsMade });
        if (job.name === 'retry-once' && job.attemptsMade === 0) {
          throw new Error('phase1b intentional retry');
        }
        if (job.name === 'always-fail') {
          throw new Error('phase1b intentional failure');
        }
        return { ok: true, name: job.name };
      },
      { connection: workerConnection, concurrency: 2 },
    );
    await worker.waitUntilReady();
    checks.push({ name: 'bullmq.worker.ready', ok: worker.isRunning() });

    const normal = await queue.add('upload-confirm', { kind: 'upload-confirm' });
    const activity = await queue.add('activity-event', { kind: 'activity-event' });
    const websocket = await queue.add('websocket-emit', { kind: 'websocket-emit' });
    const retry = await queue.add('retry-once', { kind: 'retry' }, { attempts: 2, backoff: { type: 'fixed', delay: 100 } } as JobsOptions);
    const failed = await queue.add('always-fail', { kind: 'failed' }, { attempts: 2, backoff: { type: 'fixed', delay: 100 } } as JobsOptions);

    await normal.waitUntilFinished(events, 10000);
    await activity.waitUntilFinished(events, 10000);
    await websocket.waitUntilFinished(events, 10000);
    await retry.waitUntilFinished(events, 10000);
    try {
      await failed.waitUntilFinished(events, 10000);
    } catch {
      // Expected: validates failed/retry path without hiding it from queue stats.
    }

    await wait(300);
    const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed', 'paused');
    const retryJob = await queue.getJob(retry.id!);
    const failedJob = await queue.getJob(failed.id!);
    checks.push({ name: 'bullmq.jobs.completed', ok: counts.completed >= 4, detail: counts });
    checks.push({ name: 'bullmq.retry.completed_after_retry', ok: retryJob?.finishedOn != null && (retryJob.attemptsMade || 0) >= 2, detail: { attemptsMade: retryJob?.attemptsMade } });
    checks.push({ name: 'bullmq.failed.recorded', ok: counts.failed >= 1 && failedJob?.failedReason?.includes('intentional failure'), detail: { counts, failedReason: failedJob?.failedReason } });
    checks.push({ name: 'bullmq.no_stuck_jobs', ok: counts.waiting === 0 && counts.active === 0 && counts.delayed === 0, detail: counts });
    checks.push({ name: 'bullmq.operational_jobs_seen', ok: ['upload-confirm', 'activity-event', 'websocket-emit'].every((name) => processed.some((p) => p.name === name)), detail: processed });

    await worker.close();
    await events.close();
    await queue.drain(true);
    await queue.clean(0, 1000, 'completed');
    await queue.clean(0, 1000, 'failed');
    await queue.close();
  } finally {
    queueConnection.disconnect();
    workerConnection.disconnect();
    eventsConnection.disconnect();
  }

  const failedChecks = checks.filter((check) => !check.ok);
  console.log(JSON.stringify({ result: failedChecks.length ? 'FAILED' : 'PASSED', checks }, null, 2));
  process.exit(failedChecks.length ? 1 : 0);
}

main().catch((error) => {
  console.error(JSON.stringify({ result: 'FAILED', error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exit(1);
});
