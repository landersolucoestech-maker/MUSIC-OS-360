import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260927000002_RenameLegacyPortugueseIndexAndConstraintNames
 *
 * Technical-language mandate: index and constraint names that still carry
 * the Portuguese name of a column that was already renamed to English
 * (e.g. fk_phonograms_artista_id is a FOREIGN KEY on phonograms.artist_id).
 * Only the object name changes — definitions, columns and ON DELETE
 * behavior are untouched. RENAME is metadata-only.
 *
 * Every step is guarded: it runs only when the legacy name exists and the
 * canonical name is free, so the migration is idempotent and safe on
 * environments where an object was never created under the legacy name.
 *
 * Objects whose column is itself still Portuguese are renamed together with
 * that column's table migration (idx_ecad_reports_periodo,
 * idx_leads_payload_servico, chk_artists_status_cadastro).
 */
const INDEXES: ReadonlyArray<[string, string]> = [
  ['idx_transactions_artista_id', 'idx_transactions_artist_id'],
  ['idx_transactions_tipo', 'idx_transactions_tenant_type'],
  ['idx_artist_goals_artista_id', 'idx_artist_goals_artist_id'],
  ['idx_briefings_campanha_id', 'idx_briefings_campaign_id'],
  ['idx_works_artista_id', 'idx_works_artist_id'],
  ['idx_phonograms_obra_id', 'idx_phonograms_work_id'],
  ['idx_phonograms_artista_id', 'idx_phonograms_artist_id'],
  ['idx_releases_artista_id', 'idx_releases_artist_id'],
  ['idx_leads_cliente_id', 'idx_leads_client_id'],
  ['idx_leads_tiposervico', 'idx_leads_service_type'],
  ['idx_leads_cidade', 'idx_leads_city'],
  ['idx_leads_estado', 'idx_leads_state'],
  ['idx_contracts_artista_id', 'idx_contracts_artist_id'],
  ['idx_shares_obra_id', 'idx_shares_work_id'],
  ['idx_licenses_tenant_obra', 'idx_licenses_tenant_work'],
];

/** [table, legacy name, canonical name] */
const CONSTRAINTS: ReadonlyArray<[string, string, string]> = [
  ['works', 'fk_works_artista_id', 'fk_works_artist_id'],
  ['phonograms', 'fk_phonograms_artista_id', 'fk_phonograms_artist_id'],
  ['phonograms', 'fk_phonograms_obra_id', 'fk_phonograms_work_id'],
  ['releases', 'fk_releases_artista_id', 'fk_releases_artist_id'],
  ['briefings', 'fk_briefings_campanha_id', 'fk_briefings_campaign_id'],
  ['contracts', 'fk_contracts_artista_id', 'fk_contracts_artist_id'],
  ['shares', 'fk_shares_obra_id', 'fk_shares_work_id'],
];

function renameIndex(from: string, to: string): string {
  return `
    DO $$
    BEGIN
      IF to_regclass('public.${from}') IS NOT NULL AND to_regclass('public.${to}') IS NULL THEN
        ALTER INDEX "public"."${from}" RENAME TO "${to}";
      END IF;
    END $$;`;
}

function renameConstraint(table: string, from: string, to: string): string {
  return `
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = to_regclass('public.${table}') AND conname = '${from}'
      ) AND NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = to_regclass('public.${table}') AND conname = '${to}'
      ) THEN
        ALTER TABLE "public"."${table}" RENAME CONSTRAINT "${from}" TO "${to}";
      END IF;
    END $$;`;
}

export class RenameLegacyPortugueseIndexAndConstraintNames20260927000002 implements MigrationInterface {
  name = 'RenameLegacyPortugueseIndexAndConstraintNames20260927000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [from, to] of INDEXES) await queryRunner.query(renameIndex(from, to));
    for (const [table, from, to] of CONSTRAINTS) await queryRunner.query(renameConstraint(table, from, to));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [table, from, to] of CONSTRAINTS) await queryRunner.query(renameConstraint(table, to, from));
    for (const [from, to] of INDEXES) await queryRunner.query(renameIndex(to, from));
  }
}
