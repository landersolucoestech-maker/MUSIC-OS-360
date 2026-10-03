/**
 * migrate.mjs — RETIRED. It used to apply the archived Drizzle snapshot
 * (apps/api/drizzle/0000_mixed_jimmy_woo.sql, Portuguese columns, creates `events.data`) to Neon.
 *
 * TypeORM is the sole migration executor: `pnpm --filter api db:migrate`
 * (see apps/api/drizzle/_DEPRECATED.md). This file only refuses to run; delete it with the
 * `apps/api/drizzle/` archive.
 */
console.error('migrate.mjs is retired: use `pnpm --filter api db:migrate` (TypeORM migrations are the only source of truth).');
process.exit(1);
