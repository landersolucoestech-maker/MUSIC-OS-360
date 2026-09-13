import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkSupabaseMigrationsAllowlist,
  checkNoParallelTimestampCollision,
  checkCanonicalRunnerConfig,
  checkRegistryParity,
  SUPABASE_MIGRATIONS_ALLOWLIST,
} from './verify-migration-source-of-truth.mjs';

test('allowlist: exactly the frozen legacy files -> PASS', () => {
  const result = checkSupabaseMigrationsAllowlist(SUPABASE_MIGRATIONS_ALLOWLIST);
  assert.equal(result.ok, true);
  assert.deepEqual(result.unexpected, []);
});

test('allowlist: an extra .sql file appears -> FAIL', () => {
  const result = checkSupabaseMigrationsAllowlist([
    ...SUPABASE_MIGRATIONS_ALLOWLIST,
    '20260801000000_new_backfill.sql',
  ]);
  assert.equal(result.ok, false);
  assert.deepEqual(result.unexpected, ['20260801000000_new_backfill.sql']);
});

test('allowlist: non-.sql files (e.g. README, .gitkeep) are ignored', () => {
  const result = checkSupabaseMigrationsAllowlist([...SUPABASE_MIGRATIONS_ALLOWLIST, 'README.md', '.gitkeep']);
  assert.equal(result.ok, true);
});

test('collision: no overlap between TypeORM and Supabase files -> PASS', () => {
  const result = checkNoParallelTimestampCollision(
    ['20260731000001_HardenRbacCatalogRls.ts'],
    SUPABASE_MIGRATIONS_ALLOWLIST,
  );
  assert.equal(result.ok, true);
});

test('collision: same timestamp prefix hand-mirrored into supabase/migrations -> FAIL', () => {
  const result = checkNoParallelTimestampCollision(
    ['20260731000001_HardenRbacCatalogRls.ts'],
    ['20260731000001_harden_rbac_catalog_rls.sql'],
  );
  assert.equal(result.ok, false);
  assert.equal(result.collisions.length, 1);
  assert.equal(result.collisions[0].typeormTimestamp, '20260731000001');
});

test('collision: same normalized name but different timestamp -> FAIL', () => {
  const result = checkNoParallelTimestampCollision(
    ['20260731000001_HardenRbacCatalogRls.ts'],
    ['20990101000000_hardenrbaccatalogrls.sql'],
  );
  assert.equal(result.ok, false);
  assert.equal(result.collisions.length, 1);
});

test('collision: allowlisted legacy file coincidentally shares a name -> PASS (already-reviewed history)', () => {
  const result = checkNoParallelTimestampCollision(
    ['20240101000000_InitialSchema.ts'],
    ['20260521071214_initial_schema.sql'],
  );
  assert.equal(result.ok, true);
});

test('runner config: canonical table name and shared registry import present -> PASS', () => {
  const source = `
    import { ALL_MIGRATIONS } from './migrations/index';
    migrations: [...ALL_MIGRATIONS],
    migrationsTableName: 'musicos360_migrations',
  `;
  const result = checkCanonicalRunnerConfig(source);
  assert.equal(result.ok, true);
});

test('runner config: tracking table name silently changed -> FAIL', () => {
  const source = `
    import { ALL_MIGRATIONS } from './migrations/index';
    migrations: [...ALL_MIGRATIONS],
    migrationsTableName: 'some_other_table',
  `;
  const result = checkCanonicalRunnerConfig(source);
  assert.equal(result.ok, false);
  assert.match(result.reasons[0], /musicos360_migrations/);
});

test('runner config: no longer imports the shared registry (e.g. reverted to a private list or glob) -> FAIL', () => {
  const source = `
    migrations: [path.join(__dirname, 'migrations', '*.{ts,js}')],
    migrationsTableName: 'musicos360_migrations',
  `;
  const result = checkCanonicalRunnerConfig(source);
  assert.equal(result.ok, false);
  assert.match(result.reasons[0], /ALL_MIGRATIONS/);
});

test('registry parity: every file on disk is exported, every export has a file -> PASS', () => {
  const indexSource = `
    import { Foo20260101000000 } from './20260101000000_Foo';
    export const ALL_MIGRATIONS = [
      Foo20260101000000,
    ] as const;
  `;
  const result = checkRegistryParity(['Foo20260101000000'], indexSource, []);
  assert.equal(result.ok, true);
});

test('registry parity: a file on disk was never added to the registry -> FAIL', () => {
  const indexSource = `export const ALL_MIGRATIONS = [] as const;`;
  const result = checkRegistryParity(['Foo20260101000000'], indexSource, []);
  assert.equal(result.ok, false);
  assert.deepEqual(result.missingFromIndex, ['Foo20260101000000']);
});

test('registry parity: unregistered file IS on the intentional-exclusion allowlist -> PASS, reported separately', () => {
  const indexSource = `export const ALL_MIGRATIONS = [] as const;`;
  const result = checkRegistryParity(['Deferred20260101000000'], indexSource, ['Deferred20260101000000']);
  assert.equal(result.ok, true);
  assert.deepEqual(result.missingFromIndex, []);
  assert.deepEqual(result.unregisteredIntentional, ['Deferred20260101000000']);
});

test('registry parity: allowlist entry with no backing file on disk (stale/renamed) -> FAIL', () => {
  const indexSource = `export const ALL_MIGRATIONS = [] as const;`;
  const result = checkRegistryParity([], indexSource, ['GoneMissing20260101000000']);
  assert.equal(result.ok, false);
  assert.deepEqual(result.staleAllowlistEntries, ['GoneMissing20260101000000']);
});

test('registry parity: the real project allowlist entries are still valid (guards against silent renames)', () => {
  const indexSource = `export const ALL_MIGRATIONS = [] as const;`;
  const onDisk = [
    'DropOrphanContactsSatelliteTables20260713000002',
    'PROPOSAL_BackfillArtistGoalStatusToEnglish20260910900001',
  ];
  const result = checkRegistryParity(onDisk, indexSource);
  assert.equal(result.ok, true);
  assert.deepEqual(result.missingFromIndex, []);
  assert.deepEqual(result.staleAllowlistEntries, []);
  assert.equal(result.unregisteredIntentional.length, 2);
});

test('registry parity: the registry references a class with no backing file -> FAIL', () => {
  const indexSource = `
    import { Ghost20260101000000 } from './20260101000000_Ghost';
    export const ALL_MIGRATIONS = [
      Ghost20260101000000,
    ] as const;
  `;
  const result = checkRegistryParity([], indexSource);
  assert.equal(result.ok, false);
  assert.deepEqual(result.orphanedInIndex, ['Ghost20260101000000']);
});

test('registry parity: a class name with an underscore separator (real-world exception) is not mishandled', () => {
  const indexSource = `
    import { RemoveDeadStructuresD1D8_20260705000003 } from './20260705000003_RemoveDeadStructuresD1D8';
    export const ALL_MIGRATIONS = [
      RemoveDeadStructuresD1D8_20260705000003,
    ] as const;
  `;
  const result = checkRegistryParity(['RemoveDeadStructuresD1D8_20260705000003'], indexSource, []);
  assert.equal(result.ok, true);
});
