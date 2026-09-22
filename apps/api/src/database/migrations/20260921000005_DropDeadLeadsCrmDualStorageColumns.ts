import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Naming-closure Cluster E audit: leads.origem_lead/responsavel/prioridade/
 * temperatura/estimated_value/probabilidade_fechamento/proximo_follow_up
 * were a dual-storage location -- the same 7 concepts also live inside
 * dados_internos_crm (jsonb) under matching camelCase keys
 * (origemLead/responsavel/prioridade/temperatura/valorEstimado/
 * probabilidadeFechamento/proximoFollowUp). Live DEV data settled this
 * technically, no product decision needed:
 *
 *   - All 7 physical columns: 0 non-null rows out of 62 (100% dead).
 *   - dados_internos_crm.{responsavel,prioridade,temperatura,origemLead}:
 *     real data present (1-3 rows each) -- the actual real CRM form
 *     (LeadFormModal.tsx via LeadsPage.tsx's payloadToLead()) has always
 *     written these into the jsonb blob, never the physical columns.
 *   - dados_internos_crm.{valorEstimado,probabilidadeFechamento,
 *     proximoFollowUp}: 0 rows currently, but valorEstimado/proximoFollowUp
 *     have a live, reachable write path in payloadToLead() (simply never
 *     exercised with a real value yet) -- unlike probabilidadeFechamento,
 *     whose only writer (`InternalCRMFields` in
 *     apps/web/src/modules/leads/components/index.tsx) is dead code, never
 *     imported by the real LeadFormModal.tsx.
 *
 * None of the 7 physical columns were reachable through CreateLeadDto/
 * UpdateLeadDto at all (forbidNonWhitelisted rejects them) -- the only
 * writer of any of them anywhere in the codebase was origem_lead, via a
 * single internal repo.create() in LeadsService.submitPublicArtistApplication
 * (public-artist-application flow), now redirected to
 * dados_internos_crm.origemLead in the same commit that adds this migration,
 * making that path consistent with the rest of the app. report-form-
 * contracts.ts's LEADS_CONTRACT already read all 7 concepts exclusively via
 * the jsonb side.
 *
 * Zero data loss: every dropped column is 100% null. down() re-adds them
 * nullable (no data to restore, matching the up-front verified state).
 */
export class DropDeadLeadsCrmDualStorageColumns20260921000005 implements MigrationInterface {
  name = 'DropDeadLeadsCrmDualStorageColumns20260921000005';

  private readonly columns: Array<{ name: string; type: string }> = [
    { name: 'origem_lead', type: 'varchar(120)' },
    { name: 'responsavel', type: 'varchar(255)' },
    { name: 'prioridade', type: 'varchar(40)' },
    { name: 'temperatura', type: 'varchar(40)' },
    { name: 'estimated_value', type: 'numeric(15,2)' },
    { name: 'probabilidade_fechamento', type: 'numeric(5,2)' },
    { name: 'proximo_follow_up', type: 'timestamptz' },
  ];

  public async up(qr: QueryRunner): Promise<void> {
    for (const col of this.columns) {
      await qr.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = '${col.name}'
          ) THEN
            ALTER TABLE "leads" DROP COLUMN "${col.name}";
          END IF;
        END $$;
      `);
    }
  }

  public async down(qr: QueryRunner): Promise<void> {
    for (const col of this.columns) {
      await qr.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = '${col.name}'
          ) THEN
            ALTER TABLE "leads" ADD COLUMN "${col.name}" ${col.type};
          END IF;
        END $$;
      `);
    }
  }
}
