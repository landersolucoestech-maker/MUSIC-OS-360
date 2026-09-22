import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Naming-closure Cluster D audit: leads.cidade/estado are live, DTO-exposed,
 * form-editable columns (real inputs in LeadFormModal.tsx, distinct from the
 * per-service-type `evento`/`campanha`/`influenciador` sub-payloads' own
 * unrelated cidade/estado jsonb keys inside payload_servico, not touched
 * here). leads.pais is a third physical column, DTO-exposed but with zero
 * real form input (report-form-contracts.ts's LEADS_CONTRACT already
 * excludes it: "fixado em 'Brasil' pelo formulário -- não é um input do
 * usuário") -- surveyed on DEV: the only distinct non-null value across all
 * 62 rows is the literal string 'Brasil'. Renamed and normalized to the
 * ISO 3166-1 alpha-2 code, matching the existing `rights_holders.country`
 * precedent, via an explicit one-value mapping (not a heuristic) --
 * intentionally narrow: only the exact literal 'Brasil' is touched; any
 * other stored value is left as-is rather than guessed.
 */
export class RenameLeadsGeoFieldsToEnglish20260921000004 implements MigrationInterface {
  name = 'RenameLeadsGeoFieldsToEnglish20260921000004';

  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'cidade'
        ) THEN
          ALTER TABLE "leads" RENAME COLUMN "cidade" TO "city";
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'estado'
        ) THEN
          ALTER TABLE "leads" RENAME COLUMN "estado" TO "state";
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'pais'
        ) THEN
          ALTER TABLE "leads" RENAME COLUMN "pais" TO "country";
        END IF;
      END $$;
    `);
    await qr.query(`
      UPDATE "leads" SET "country" = 'BR' WHERE "country" = 'Brasil'
    `);
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`
      UPDATE "leads" SET "country" = 'Brasil' WHERE "country" = 'BR'
    `);
    await qr.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'city'
        ) THEN
          ALTER TABLE "leads" RENAME COLUMN "city" TO "cidade";
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'state'
        ) THEN
          ALTER TABLE "leads" RENAME COLUMN "state" TO "estado";
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'country'
        ) THEN
          ALTER TABLE "leads" RENAME COLUMN "country" TO "pais";
        END IF;
      END $$;
    `);
  }
}
