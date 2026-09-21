import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Naming-mission audit found leads.tipo_cliente/tipo_servico are live,
 * DTO-exposed, actively-written columns (3 non-null rows each on DEV at
 * authoring time) -- unlike origem_lead/probabilidade_fechamento/
 * proximo_follow_up on the same table, which are dead/JSONB-shadowed and
 * remain a separate, unresolved NEEDS_DATA_RECONCILIATION finding, not
 * touched here. Renames to service_type/client_type end to end: entity,
 * CreateLeadDto/UpdateLeadDto (camelCase serviceType/clientType, matching
 * every other status-adjacent DTO field in this codebase), leads.service.ts's
 * read/write mapping, report-form-contracts.ts's LEADS_CONTRACT,
 * verify-canonical-column-order.ts, and every apps/web/src/modules/leads
 * consumer (confirmed scoped: the only other live tipoCliente/tipoServico
 * occurrences repo-wide are transactions.tipo_cliente, a distinct
 * "counterparty type" concept on a different table, and an unrelated local
 * variable in ContractWizard.tsx -- neither touched).
 *
 * Plain rename, no data transformation: existing values need no
 * translation (they're already English-ish enum-like tokens, e.g.
 * 'artist'/'marketingMusical', not Portuguese words needing conversion).
 */
export class RenameLeadsTipoClienteTipoServicoToEnglish20260920000007 implements MigrationInterface {
  name = 'RenameLeadsTipoClienteTipoServicoToEnglish20260920000007';

  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'tipo_cliente'
        ) THEN
          ALTER TABLE "leads" RENAME COLUMN "tipo_cliente" TO "client_type";
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'tipo_servico'
        ) THEN
          ALTER TABLE "leads" RENAME COLUMN "tipo_servico" TO "service_type";
        END IF;
      END $$;
    `);
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'client_type'
        ) THEN
          ALTER TABLE "leads" RENAME COLUMN "client_type" TO "tipo_cliente";
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'service_type'
        ) THEN
          ALTER TABLE "leads" RENAME COLUMN "service_type" TO "tipo_servico";
        END IF;
      END $$;
    `);
  }
}
