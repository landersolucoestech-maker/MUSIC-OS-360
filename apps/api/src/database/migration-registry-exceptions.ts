/**
 * Migrations present on disk (and, on some databases, applied) that are
 * deliberately NOT registered in migrations/index.ts. Single list, read by:
 *   - scripts/verify-migration-source-of-truth.mjs (registry parity guard);
 *   - db:check / db-ops check:state (an applied row for one of these is not
 *     "a database ahead of the build": it is reported, never counted).
 * Keep one quoted class name per entry: the .mjs guard parses this file.
 */
export const INTENTIONALLY_UNREGISTERED_MIGRATIONS: readonly string[] = [
  // Destructive DROP TABLE (contacts + 3 satellites). Needs explicit
  // sign-off to register/execute, not just the migration's own header
  // claiming a pre-verified 0-rows check. See index.ts:106 and
  // req-a6155d65 (mission-e39d21fa) for the recorded decision. Applied on DEV
  // (documented in the header of 20260920000002).
  'DropOrphanContactsSatelliteTables20260713000002',
  // Staged rollout proposal (filename-prefixed PROPOSAL_, self-documented
  // "NOT REGISTERED IN index.ts, NOT EXECUTED" in its own header) — this is
  // step 2 (BACKFILL) of a 4-step expand/contract rollout whose step 1
  // (EXPAND, application code accepting both PT-BR and EN values) has not
  // shipped yet. Registering it now would run it before the app is ready.
  'PROPOSAL_BackfillArtistGoalStatusToEnglish20260910900001',
];
