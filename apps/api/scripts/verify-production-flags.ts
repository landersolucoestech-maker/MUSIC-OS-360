#!/usr/bin/env ts-node
/**
 * scripts/verify-production-flags.ts — RBAC-SHADOW-01 / DBCTX-01 release gate.
 *
 * Read-only: only inspects process.env (never prints values). Fails the
 * release gate if, in production, RBAC_PERSISTED_AUTHORITY or
 * DATABASE_SESSION_CONTEXT_ENABLED are left at their silent zod default
 * instead of being explicitly declared — see collectProductionAuthorityErrors
 * in src/core/config/env.schema.ts for the exact rules.
 *
 * Usage: pnpm --filter @music-os-360/api verify:production-flags
 */
import { collectProductionAuthorityErrors } from '../src/core/config/env.schema';

const errors = collectProductionAuthorityErrors(process.env as Record<string, string | undefined>);

if (errors.length > 0) {
  console.error('\n❌ verify:production-flags FAILED:');
  for (const err of errors) console.error(`  • ${err}`);
  console.error(
    '\nThese flags are only required when NODE_ENV=production. ' +
      'Ver apps/api/.env.production.\n',
  );
  process.exit(1);
}

const nodeEnv = process.env['NODE_ENV'] ?? 'development';
if (nodeEnv === 'production') {
  console.log(
    '✓ verify:production-flags — RBAC_PERSISTED_AUTHORITY e DATABASE_SESSION_CONTEXT_ENABLED ' +
      'correct for production.',
  );
} else {
  console.log(`✓ verify:production-flags — NODE_ENV=${nodeEnv} (flags are only required in production).`);
}
