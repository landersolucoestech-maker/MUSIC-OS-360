// ── .env loaded BEFORE any module (guarantees process.env for QueueModule.register) ──
// Loads apps/api/.env.development explicitly (path relative to CWD =
// apps/api/ via `npm run dev`). Used only for local development — in
// staging/production the variables come from the hosting provider/Docker -e/CI
// secrets (the file does not exist in those environments, so this becomes a no-op).
// Variables already present in process.env are not overridden — it only fills
// what is not defined yet.
import * as fs from 'fs';
import * as path from 'path';

function loadLocalEnv(envPath: string): void {
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const raw = trimmed.slice(separator + 1).trim();
    if (!key || process.env[key] != null) continue;

    process.env[key] = raw.replace(/^["']|["']$/g, '');
  }
}

loadLocalEnv(path.resolve(__dirname, '../.env.development'));
loadLocalEnv(path.resolve(process.cwd(), '.env.development'));

// ── Sentry MUST be the second import ───────────────────────────────────────────
import './instrument';

import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { createApp } from './create-app';

// Silences connection errors to network services unavailable in the
// development environment (e.g. local Redis not started yet, or the Supabase
// pooler temporarily down).
const NETWORK_CODES = new Set(['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'EPIPE', 'ETIMEDOUT']);
const NET_LOG_THROTTLE_MS = 30_000;
let __netLastCode = '';
let __netLastLogAt = 0;

function suppressNetworkNoise(err: NodeJS.ErrnoException): boolean {
  if (!err.code || !NETWORK_CODES.has(err.code)) return false;
  const now = Date.now();
  if (err.code === __netLastCode && now - __netLastLogAt < NET_LOG_THROTTLE_MS) return true;
  __netLastCode = err.code;
  __netLastLogAt = now;
  console.warn(`[net] Conexao indisponivel (${err.code}): ${err.message?.split('\n')[0]}`);
  return true;
}

process.on('uncaughtException', (err: NodeJS.ErrnoException) => {
  if (suppressNetworkNoise(err)) return;
  throw err;
});

process.on('unhandledRejection', (reason: unknown) => {
  if (reason instanceof Error && suppressNetworkNoise(reason as NodeJS.ErrnoException)) return;
  throw reason;
});

/**
 * Long-running server entrypoint — Docker/self-hosted deployment.
 */
async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await createApp();

  // ── Graceful Shutdown ────────────────────────────────────────────────────────
  app.enableShutdownHooks();

  process.on('SIGTERM', async () => {
    logger.log('SIGTERM recebido — iniciando graceful shutdown...');
    await app.close();
    process.exit(0);
  });

  const port = process.env['PORT'] ?? 3001;
  await app.listen(port);

  logger.log(`🎵 MUSIC OS 360° API rodando em http://localhost:${port}/api/v1`);

  const { isProdLike } = await import('./core/config/runtime-environment');
  if (!isProdLike(process.env['NODE_ENV'])) {
    logger.log(`📚 Swagger em http://localhost:${port}/docs`);
  }
}

bootstrap().catch((err: unknown) => {
  console.error('Falha crítica no bootstrap:', err);
  process.exit(1);
});
