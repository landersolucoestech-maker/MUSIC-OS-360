import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reconciles a real schema-drift finding from a 2026-09-20 forensic audit:
 * 20260713000002_DropOrphanContactsSatelliteTables.ts DROPs `contacts` +
 * 3 satellites (`contact_attachments`, `contact_contracts`, `contact_timeline`),
 * but is deliberately NOT registered in ALL_MIGRATIONS (see its own header
 * comment). Despite that, DEV's `musicos360_migrations` tracking table
 * already has a row for it (id=91, sitting in exact chronological sequence
 * between CreateOperationalListItems20260713000001 [id=90] and
 * MakeShareRegistryFieldsNullable20260715000001 [id=92] -- serial ids reflect
 * insertion order, not the "timestamp" field, so this is strong evidence the
 * row was inserted by the same batch/runner that applied its neighbors, in a
 * since-reverted registration state, not hand-crafted after the fact) -- and
 * the 4 tables are confirmed absent from DEV's live schema. So DEV already
 * converged to the "dropped" end state through some run of the migration
 * runner, while the *currently committed* ALL_MIGRATIONS would NOT reproduce
 * that on a fresh database: a fresh/staging/CI database built from today's
 * registered migrations would still CREATE these 4 tables (via
 * 20260528000002_LeadsContactsOperationalRefactor, which IS registered) and
 * never drop them.
 *
 * This migration does NOT retroactively register or edit 20260713000002 --
 * migrations are append-only history, and DEV's existing tracking row for it
 * stays exactly as-is (accurate: that file's DDL did run against DEV at some
 * point; falsifying/deleting that row to make counts match would be exactly
 * the "faked audit trail" the governing rules forbid). Instead, this is a
 * NEW, idempotent, state-checked convergence migration that brings every
 * environment -- DEV (tables already absent -- NO-OP), a fresh database or
 * any environment that never ran 20260713000002 out-of-band (tables present,
 * confirmed empty at authoring time -- safe to drop), or any environment
 * with genuine live data in these tables (must ABORT, not silently destroy
 * data) -- to the same end state, without assuming DEV's specific history
 * applies everywhere.
 *
 * Precondition-checked, never a blind DROP:
 *  1. For each of the 4 tables, if present, its row count (including
 *     soft-deleted rows -- deleted_at is not a reason to allow data loss)
 *     must be exactly 0. ANY table with rows aborts the ENTIRE migration
 *     before a single DROP runs.
 *  2. No foreign key from a table outside this set of 4 may reference any of
 *     them -- an external dependency means something still actually relies
 *     on this schema, which invalidates the "orphan" premise for this
 *     environment. Also aborts before any DROP.
 *  3. DROP TABLE IF EXISTS (no CASCADE) is used, so if any other undetected
 *     dependent object (e.g. a view) exists, Postgres's own default RESTRICT
 *     behavior fails the migration rather than silently cascading.
 *
 * Runs inside this project's normal `transaction: 'each'` migration
 * execution -- a failed precondition throws before any DROP, so the
 * transaction rolls back and nothing is partially applied.
 */
export class ReconcileOrphanContactsSatelliteTablesConvergence20260920000002
  implements MigrationInterface
{
  name = 'ReconcileOrphanContactsSatelliteTablesConvergence20260920000002';

  // FK-safe drop order: children (satellites) before the parent (`contacts`).
  private readonly TABLES = [
    'contact_attachments',
    'contact_contracts',
    'contact_timeline',
    'contacts',
  ] as const;

  public async up(qr: QueryRunner): Promise<void> {
    for (const table of this.TABLES) {
      const reg = await qr.query(`SELECT to_regclass($1) AS reg`, [`public.${table}`]);
      if (!reg[0]?.reg) continue; // absent on this environment -- nothing to converge for this table

      const count = await qr.query(`SELECT count(*)::int AS n FROM "${table}"`);
      const n = count[0]?.n ?? 0;
      if (n > 0) {
        throw new Error(
          `ReconcileOrphanContactsSatelliteTablesConvergence: "${table}" contains ${n} row(s). ` +
            'Aborting before any DROP -- this migration only ever removes confirmed-empty orphan ' +
            'tables. Investigate why this environment has live data in a table considered dead ' +
            'everywhere else (see 20260713000002_DropOrphanContactsSatelliteTables.ts for the ' +
            'domain history/decision) before deciding how to proceed.',
        );
      }
    }

    const unexpectedFks = await qr.query(
      `
      SELECT tc.table_name AS referencing_table, ccu.table_name AS referenced_table
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
       WHERE tc.constraint_type = 'FOREIGN KEY'
         AND tc.table_schema = 'public'
         AND ccu.table_name = ANY($1::text[])
         AND tc.table_name != ALL($1::text[])
      `,
      [this.TABLES],
    );
    if (unexpectedFks.length > 0) {
      throw new Error(
        'ReconcileOrphanContactsSatelliteTablesConvergence: unexpected foreign key(s) into the ' +
          `orphan contacts satellite tables from outside that set: ${JSON.stringify(unexpectedFks)}. ` +
          'Aborting -- investigate before dropping.',
      );
    }

    for (const table of this.TABLES) {
      await qr.query(`DROP TABLE IF EXISTS "${table}"`);
    }
  }

  public async down(_qr: QueryRunner): Promise<void> {
    // Intentionally a no-op: this migration only ever drops tables already proven empty (or already
    // absent) at run time. Recreating empty, unused tables on rollback provides no real reversibility
    // value and would silently resurrect RLS policies/grants nothing writes to. The full reconstruction
    // (schema + RLS + grants), if ever genuinely needed, remains 20260713000002's own down().
  }
}
