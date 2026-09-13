#!/usr/bin/env node
/**
 * scripts/verify-migration-source-of-truth.mjs
 *
 * MUSIC OS 360 has exactly one canonical migration system: TypeORM
 * migrations in apps/api/src/database/migrations/, tracked in the
 * musicos360_migrations table (see apps/api/DATABASE.md). supabase/migrations/
 * is a frozen historical artifact (2 legacy SQL files) and is never a second
 * tracker. This guard fails the build the moment that stops being true —
 * before drift accumulates into an actual dual-tracking mess — by checking:
 *
 *   1. supabase/migrations/ contains only the frozen, allowlisted files.
 *   2. No *new* file in supabase/migrations/ shares a timestamp prefix or
 *      normalized name with a TypeORM migration (a hand-mirrored duplicate).
 *   3. datasource.ts — the config db-ops.ts (db:migrate/db:check) actually
 *      loads — still imports the shared ALL_MIGRATIONS registry and still
 *      uses musicos360_migrations as the tracking table name.
 *   4. migrations/index.ts (the single shared registry both datasource.ts
 *      AND database.module.ts import) has exactly one entry per migration
 *      file on disk, and vice versa — this is what used to be impossible to
 *      check meaningfully (database.module.ts had its own, separate, silently
 *      drifting list) until Parte 61 unified both consumers onto one file.
 *
 * Usage:
 *   node scripts/verify-migration-source-of-truth.mjs
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

// Adding a file here is itself the "explicit architectural decision" this
// guard exists to force — it must be a deliberate code change, reviewed like
// any other, never a silent addition.
export const SUPABASE_MIGRATIONS_ALLOWLIST = [
  '20260521071214_initial_schema.sql',
  '20260617233000_reconcile_custom_access_token_hook_tenant_selection.sql',
];

const TYPEORM_FILENAME_RE = /^(\d{14})_([A-Za-z0-9_]+)\.ts$/;

// Migration classes that exist on disk but are deliberately NOT registered
// in migrations/index.ts — a reviewed architectural/product decision, not
// drift. Adding a class name here IS the explicit decision this guard
// demands: each entry must be backed by a code comment (in index.ts, next to
// where the migration would be imported, or in the migration file's own
// header) explaining why it stays unregistered and what would need to happen
// to register it. This guard still fails on anything unregistered that
// ISN'T listed here — that's the "forgotten, not deliberate" case.
export const INTENTIONALLY_UNREGISTERED_MIGRATIONS = [
  // Destructive DROP TABLE (contacts + 3 satellites). Needs explicit
  // sign-off to register/execute, not just the migration's own header
  // claiming a pre-verified 0-rows check. See index.ts:106 and
  // req-a6155d65 (mission-e39d21fa) for the recorded decision.
  'DropOrphanContactsSatelliteTables20260713000002',
  // Staged rollout proposal (filename-prefixed PROPOSAL_, self-documented
  // "NOT REGISTERED IN index.ts, NOT EXECUTED" in its own header) — this is
  // step 2 (BACKFILL) of a 4-step expand/contract rollout whose step 1
  // (EXPAND, application code accepting both PT-BR and EN values) has not
  // shipped yet. Registering it now would run it before the app is ready.
  'PROPOSAL_BackfillArtistGoalStatusToEnglish20260910900001',
];

export function checkSupabaseMigrationsAllowlist(actualFiles, allowlist = SUPABASE_MIGRATIONS_ALLOWLIST) {
  const allowed = new Set(allowlist);
  const unexpected = actualFiles.filter((f) => f.endsWith('.sql') && !allowed.has(f));
  return {
    ok: unexpected.length === 0,
    unexpected,
  };
}

function normalizeName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Only new (non-allowlisted) supabase/migrations files are checked for
// collisions — the 2 frozen legacy files are already-reviewed history and
// can coincidentally share a name ("initial schema") with an unrelated
// TypeORM migration without that being an attempt at duplicate tracking.
export function checkNoParallelTimestampCollision(typeormFiles, supabaseFiles, allowlist = SUPABASE_MIGRATIONS_ALLOWLIST) {
  const allowed = new Set(allowlist);
  const typeormEntries = typeormFiles
    .map((f) => f.match(TYPEORM_FILENAME_RE))
    .filter(Boolean)
    .map((m) => ({ timestamp: m[1], normalized: normalizeName(m[2]) }));

  const collisions = [];
  for (const sqlFile of supabaseFiles) {
    if (!sqlFile.endsWith('.sql') || allowed.has(sqlFile)) continue;
    const sqlTimestamp = sqlFile.match(/^(\d{14})/)?.[1];
    const sqlNormalized = normalizeName(sqlFile.replace(/\.sql$/, ''));
    for (const entry of typeormEntries) {
      const timestampCollides = sqlTimestamp && sqlTimestamp === entry.timestamp;
      const nameCollides = sqlNormalized.includes(entry.normalized) && entry.normalized.length > 0;
      if (timestampCollides || nameCollides) {
        collisions.push({ supabaseFile: sqlFile, typeormTimestamp: entry.timestamp });
      }
    }
  }
  return { ok: collisions.length === 0, collisions };
}

// datasource.ts is what db-ops.ts actually loads for db:migrate/db:check —
// confirms it still imports the shared registry (not a private list, not a
// glob) and still uses the canonical tracking table name.
export function checkCanonicalRunnerConfig(datasourceSource) {
  const reasons = [];
  if (!datasourceSource.includes("migrationsTableName: 'musicos360_migrations'")) {
    reasons.push("musicos360_migrations tracking table name not found in datasource.ts — did it silently change?");
  }
  if (!/from ['"]\.\/migrations\/index['"]/.test(datasourceSource) || !datasourceSource.includes('ALL_MIGRATIONS')) {
    reasons.push("datasource.ts no longer imports ALL_MIGRATIONS from ./migrations/index — TypeORM runner may no longer point at the shared registry");
  }
  return { ok: reasons.length === 0, reasons };
}

// migrations/index.ts is the single shared registry — every file on disk
// must have exactly one entry there, and every entry must correspond to a
// real file. This is the "registry parity" check: with one shared file
// (Parte 61) instead of two independently-maintained lists, a real,
// meaningful comparison against disk finally exists.
//
// Takes the *actual* exported class names (read from each file's `export
// class X` declaration by the caller), not a name reconstructed from the
// filename — at least one migration (RemoveDeadStructuresD1D8_20260705000003)
// breaks the usual {Name}{Timestamp} convention with an underscore
// separator, and reconstructing names from filenames silently mismatches it.
export function checkRegistryParity(classNamesOnDisk, indexSource, intentionallyUnregistered = INTENTIONALLY_UNREGISTERED_MIGRATIONS) {
  const onDisk = new Set(classNamesOnDisk);
  const allowedUnregistered = new Set(intentionallyUnregistered);
  const notInIndex = [...onDisk].filter((className) => !indexSource.includes(className));
  const missingFromIndex = notInIndex.filter((className) => !allowedUnregistered.has(className));
  const unregisteredIntentional = notInIndex.filter((className) => allowedUnregistered.has(className));

  // An allowlist entry for a class that isn't actually on disk (renamed,
  // deleted, typo) is itself drift in the allowlist — surface it as a real
  // failure rather than silently doing nothing.
  const staleAllowlistEntries = [...allowedUnregistered].filter((className) => !onDisk.has(className));

  const exportedMatch = indexSource.match(/export const ALL_MIGRATIONS = \[([\s\S]*?)\] as const;/);
  const exportedNames = exportedMatch
    ? exportedMatch[1].split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  const orphanedInIndex = exportedNames.filter((name) => !onDisk.has(name));

  return {
    ok: missingFromIndex.length === 0 && orphanedInIndex.length === 0 && staleAllowlistEntries.length === 0,
    missingFromIndex,
    orphanedInIndex,
    unregisteredIntentional,
    staleAllowlistEntries,
  };
}

function main() {
  const supabaseMigrationsDir = path.join(REPO_ROOT, 'supabase', 'migrations');
  const typeormMigrationsDir = path.join(REPO_ROOT, 'apps', 'api', 'src', 'database', 'migrations');
  const datasourcePath = path.join(REPO_ROOT, 'apps', 'api', 'src', 'database', 'datasource.ts');
  const indexPath = path.join(typeormMigrationsDir, 'index.ts');

  const supabaseFiles = readdirSync(supabaseMigrationsDir);
  const typeormFiles = readdirSync(typeormMigrationsDir).filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts') && f !== 'index.ts');
  const datasourceSource = readFileSync(datasourcePath, 'utf8');
  const indexSource = readFileSync(indexPath, 'utf8');
  const classNamesOnDisk = typeormFiles
    .map((f) => readFileSync(path.join(typeormMigrationsDir, f), 'utf8').match(/export class (\w+)/)?.[1])
    .filter(Boolean);

  const registryParity = checkRegistryParity(classNamesOnDisk, indexSource);

  const results = [
    ['supabase/migrations/ matches the frozen allowlist', checkSupabaseMigrationsAllowlist(supabaseFiles)],
    ['no TypeORM/Supabase migration name or timestamp collision', checkNoParallelTimestampCollision(typeormFiles, supabaseFiles)],
    ['datasource.ts still points at the canonical runner/tracking table', checkCanonicalRunnerConfig(datasourceSource)],
    ['migrations/index.ts registry matches disk exactly (unexplained drift only)', registryParity],
  ];

  let failed = false;
  for (const [label, result] of results) {
    if (result.ok) {
      console.log(`  ✓  ${label}`);
    } else {
      failed = true;
      console.error(`  ✗  ${label}`);
      console.error(`     ${JSON.stringify(result, null, 2).split('\n').join('\n     ')}`);
    }
  }

  if (registryParity.unregisteredIntentional.length > 0) {
    console.log(`  ℹ  ${registryParity.unregisteredIntentional.length} migration(s) deliberately unregistered (INTENTIONALLY_UNREGISTERED_MIGRATIONS):`);
    for (const name of registryParity.unregisteredIntentional) console.log(`     - ${name}`);
  }

  if (failed) {
    console.error('\nMigration source-of-truth guard FAILED — see apps/api/DATABASE.md for the canonical-migrations policy.');
    process.exitCode = 1;
    return;
  }
  console.log('\nMigration source-of-truth guard PASSED.');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main();
}
