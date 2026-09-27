import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PHASE 2C — Materializes the referential integrity of relations ALREADY declared
 * by the ORM (@ManyToOne/@JoinColumn) that had no physical FK in the database.
 *
 * A READ-ONLY pre-check run before this migration confirmed, for each FK:
 * existing referenced table, compatible uuid↔uuid types, no pre-existing
 * FK and ZERO orphans. Only SAFE FKs go in here.
 *
 * ON DELETE aligned with the ORM contract and the phase's rules:
 *   - NULLABLE columns → ON DELETE SET NULL (the relation is optional);
 *   - lead_interactions.lead_id (NOT NULL) → ON DELETE CASCADE — pure composition:
 *     the interaction log belongs to the lead and has no independent value.
 *
 * OUTSIDE this migration (REQUIRES A BUSINESS DECISION, not materialized):
 *   - payroll_entries.employee_id and leave_requests.employee_id: the ORM declares
 *     CASCADE, but cascading the deletion of payroll/leave when removing an employee
 *     destroys financial/HR history. RESTRICT vs CASCADE depends on a business
 *     rule — left for an explicit decision.
 *
 * No data is changed. Constraints have explicit names and are reversible.
 * An index is created only where it was missing (briefings.campanha_id) — the others already have one.
 */
export class AddDomainForeignKeys20260613000004 implements MigrationInterface {
  name = 'AddDomainForeignKeys20260613000004';

  // [table, column, ref_table, ref_column, onDelete, constraint_name]
  private static readonly FKS: ReadonlyArray<[string, string, string, string, 'SET NULL' | 'CASCADE', string]> = [
    ['works',             'artista_id',  'artists',   'id', 'SET NULL', 'fk_works_artista_id'],
    ['phonograms',        'artista_id',  'artists',   'id', 'SET NULL', 'fk_phonograms_artista_id'],
    ['phonograms',        'obra_id',     'works',     'id', 'SET NULL', 'fk_phonograms_obra_id'],
    ['contracts',         'artista_id',  'artists',   'id', 'SET NULL', 'fk_contracts_artista_id'],
    ['briefings',         'campanha_id', 'campaigns', 'id', 'SET NULL', 'fk_briefings_campanha_id'],
    ['releases',          'artista_id',  'artists',   'id', 'SET NULL', 'fk_releases_artista_id'],
    ['shares',            'obra_id',     'works',     'id', 'SET NULL', 'fk_shares_obra_id'],
    ['lead_interactions', 'lead_id',     'leads',     'id', 'CASCADE',  'fk_lead_interactions_lead_id'],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Missing index on the only FK column without an index (speeds up SET NULL/lookups).
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_briefings_campanha_id" ON "briefings" ("campanha_id")`,
    );

    for (const [table, col, refTable, refCol, onDelete, name] of AddDomainForeignKeys20260613000004.FKS) {
      // NOT VALID avoids a long validation lock; VALIDATE right after confirms
      // integrity (the pre-check guarantees zero orphans → always passes).
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${name}" ` +
        `FOREIGN KEY ("${col}") REFERENCES "${refTable}" ("${refCol}") ON DELETE ${onDelete} NOT VALID`,
      );
      await queryRunner.query(`ALTER TABLE "${table}" VALIDATE CONSTRAINT "${name}"`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [table, , , , , name] of AddDomainForeignKeys20260613000004.FKS) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${name}"`);
    }
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_briefings_campanha_id"`);
  }
}
