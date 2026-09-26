/**
 * migration-classification.ts  (Part 72 — decoupling of externally managed migrations)
 *
 * Single canonical source: which category each migration belongs to. No other
 * file may decide this on its own (name pattern, timestamp,
 * heuristic) — always import `getMigrationCategory` from here.
 *
 * Context: `RealtimeBroadcastAuthorization20260801000001` alters
 * `realtime.messages`, a table belonging to the `realtime` schema —
 * managed by Supabase's Realtime extension, not by the application. In
 * real DEV/STAGING/PROD, that table belongs to the `supabase_realtime_admin` role,
 * not to the application's connection role (confirmed empirically in Part 72:
 * `error: must be owner of table messages`). The TypeORM migration runner
 * applies in order and stops at the first failure — so a pending
 * EXTERNAL_MANAGED migration blocked every later APPLICATION
 * migration, even without any real relation between them.
 *
 * Categories:
 *
 *  - APPLICATION: schema controlled entirely by MUSIC OS 360 (the `public`
 *    schema). Must be applicable by the normal application role. DEFAULT
 *    category — a migration is only something else if explicitly listed
 *    below.
 *
 *  - EXTERNAL_MANAGED: alters an object belonging to an externally managed
 *    service (e.g. Supabase's `realtime`, `auth`, `storage` schemas).
 *    It may require a privilege the normal connection role lacks. It must not
 *    block later APPLICATION migrations — only the functionality that
 *    depends on it. It needs its own physical verifier (see
 *    verify-realtime-external.ts), never just the tracking row.
 *
 *  - PRIVILEGED: requires a special administrative credential, but is still an
 *    object the application owns/controls (unlike EXTERNAL_MANAGED).
 *    It must not run silently; it needs a preflight and later
 *    verification. No migration uses this category yet.
 */

export enum MigrationCategory {
  APPLICATION = 'APPLICATION',
  EXTERNAL_MANAGED = 'EXTERNAL_MANAGED',
  PRIVILEGED = 'PRIVILEGED',
}

/** Never remove an entry from here without physically confirming that the migration no longer touches an external schema. */
const EXTERNAL_MANAGED_MIGRATIONS: ReadonlySet<string> = new Set([
  'RealtimeBroadcastAuthorization20260801000001',
]);

const PRIVILEGED_MIGRATIONS: ReadonlySet<string> = new Set([]);

export function getMigrationCategory(migrationName: string): MigrationCategory {
  if (EXTERNAL_MANAGED_MIGRATIONS.has(migrationName)) return MigrationCategory.EXTERNAL_MANAGED;
  if (PRIVILEGED_MIGRATIONS.has(migrationName)) return MigrationCategory.PRIVILEGED;
  return MigrationCategory.APPLICATION;
}

export function isApplicationMigration(migrationName: string): boolean {
  return getMigrationCategory(migrationName) === MigrationCategory.APPLICATION;
}

export function listExternalManagedMigrationNames(): string[] {
  return [...EXTERNAL_MANAGED_MIGRATIONS];
}
