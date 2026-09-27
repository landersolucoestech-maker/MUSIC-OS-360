import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Normalizes the authorship of `works`.
 *
 * Real evidence (2026-07-18 audit):
 *   - `works.participantes` (jsonb) is the rich, active authorship source of the
 *     interactive form (ObraFormModal.tsx), with a fixed, known shape
 *     per item: { id, nome, classeFuncao, link, percentual }. A list of
 *     related records must not live in a single jsonb column —
 *     it becomes the child table `work_participants`.
 *   - `works.detentores` and `works.co_compositores` have NO active
 *     writer: no input in the form, absent from CreateWorkDto/UpdateWorkDto,
 *     and marked `importable: false` in the Reports contract (not writable
 *     even through bulk import). They are orphan columns — no real flow
 *     has populated them since the current contract exists. `up()` validates that there is no
 *     remaining incompatible data before removing them (fail-fast).
 *   - `works.compositor` and `works.editora` REMAIN: they have a real writer
 *     (bulk import via Reports, `importable: true` in the contract) and a real
 *     reader (`catalog-metadata-validator`, `external-data-exchange`).
 *
 * A form participant never needs to be a registered entity
 * (ParticipanteForm has no artista_id) — which is why `nome` is free text,
 * not a mandatory FK.
 */
export class WorkParticipantsNormalization20260718000011 implements MigrationInterface {
  name = 'WorkParticipantsNormalization20260718000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Fail-fast: aborts if `participantes` contains an item in an unknown
    //    format (outside the {id,nome,classeFuncao,link,percentual} shape).
    const badShape: Array<{ id: string }> = await queryRunner.query(`
      SELECT w.id
      FROM works w, jsonb_array_elements(COALESCE(w.participantes, '[]'::jsonb)) AS item
      WHERE NOT (item ? 'nome')
      LIMIT 20
    `);
    if (badShape.length > 0) {
      throw new Error(
        `WorkParticipantsNormalization: ${badShape.length}+ work(s) with a participants ` +
        `item in an unknown format (no "nome" key) — e.g.: ${badShape.map((r) => r.id).join(', ')}. ` +
        `Migration aborted; fix the data manually before re-running.`,
      );
    }

    // ── 2. Fail-fast: aborts if `detentores`/`co_compositores` hold remaining
    //    data (no active writer populates them — any value today
    //    would be legacy predating the current contract and needs manual triage
    //    before the column is removed).
    const orphanData: Array<{ count: string }> = await queryRunner.query(`
      SELECT count(*)::text AS count FROM works
      WHERE (detentores IS NOT NULL AND btrim(detentores) <> '')
         OR (co_compositores IS NOT NULL AND btrim(co_compositores) <> '')
    `);
    if (Number(orphanData[0]?.count ?? '0') > 0) {
      throw new Error(
        `WorkParticipantsNormalization: ${orphanData[0].count} work(s) have data in ` +
        `detentores/co_compositores. No active writer populates these columns today — ` +
        `manual triage required (migrate to work_participants/rights_holders or ` +
        `confirm discarding) before removing the columns. Migration aborted.`,
      );
    }

    // ── 3. Create the child table ──────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS work_participants (
        id           uuid PRIMARY KEY,
        tenant_id    uuid NOT NULL,
        work_id      uuid NOT NULL REFERENCES works(id) ON DELETE CASCADE,
        nome         varchar(255) NOT NULL,
        classe_funcao varchar(100) NOT NULL,
        link         text,
        percentual   numeric(6,3),
        ordem        integer NOT NULL DEFAULT 0,
        created_at   timestamp NOT NULL DEFAULT now(),
        updated_at   timestamp NOT NULL DEFAULT now(),
        CONSTRAINT chk_work_participants_percentual
          CHECK (percentual IS NULL OR (percentual >= 0 AND percentual <= 100))
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_work_participants_tenant_work ON work_participants (tenant_id, work_id)`);

    // ── 4. Backfill: one row per works.participantes item ────────────────
    await queryRunner.query(`
      INSERT INTO work_participants (id, tenant_id, work_id, nome, classe_funcao, link, percentual, ordem)
      SELECT
        COALESCE(NULLIF(elem.item->>'id', '')::uuid, gen_random_uuid()),
        w.tenant_id,
        w.id,
        elem.item->>'nome',
        COALESCE(NULLIF(elem.item->>'classeFuncao', ''), 'não_informado'),
        NULLIF(elem.item->>'link', ''),
        NULLIF(elem.item->>'percentual', '')::numeric,
        elem.ordinality - 1
      FROM works w, jsonb_array_elements(COALESCE(w.participantes, '[]'::jsonb)) WITH ORDINALITY AS elem(item, ordinality)
      ON CONFLICT (id) DO NOTHING
    `);

    // ── 5. Verifies the backfill lost no item ─────────────────────────────────
    const [{ source_count, target_count }] = await queryRunner.query(`
      SELECT
        (SELECT COALESCE(SUM(jsonb_array_length(COALESCE(participantes, '[]'::jsonb))), 0) FROM works)::text AS source_count,
        (SELECT COUNT(*) FROM work_participants)::text AS target_count
    `);
    if (source_count !== target_count) {
      throw new Error(
        `WorkParticipantsNormalization: backfill incompleto — works.participantes tinha ` +
        `${source_count} items, work_participants received ${target_count}. Migration aborted ` +
        `before removing the source columns.`,
      );
    }

    // ── 6. RLS on the child table (same pattern as 20260613000008) ──────────────
    await queryRunner.query(`ALTER TABLE work_participants ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policy WHERE polname = 'tenant_isolation' AND polrelid = 'public.work_participants'::regclass
        ) THEN
          CREATE POLICY "tenant_isolation" ON work_participants
            FOR ALL
            USING (tenant_id = private_get_tenant_id())
            WITH CHECK (tenant_id = private_get_tenant_id());
        END IF;
      END $$;
    `);

    // ── 7. Removes the source columns, already migrated/proven orphans ──────────
    await queryRunner.query(`
      ALTER TABLE works
        DROP COLUMN IF EXISTS participantes,
        DROP COLUMN IF EXISTS detentores,
        DROP COLUMN IF EXISTS co_compositores
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE works
        ADD COLUMN IF NOT EXISTS participantes jsonb,
        ADD COLUMN IF NOT EXISTS detentores text,
        ADD COLUMN IF NOT EXISTS co_compositores text
    `);
    await queryRunner.query(`
      UPDATE works w SET participantes = COALESCE(sub.items, '[]'::jsonb)
      FROM (
        SELECT work_id, jsonb_agg(
          jsonb_build_object(
            'id', id, 'nome', nome, 'classeFuncao', classe_funcao,
            'link', link, 'percentual', percentual::text
          ) ORDER BY ordem
        ) AS items
        FROM work_participants
        GROUP BY work_id
      ) sub
      WHERE w.id = sub.work_id
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS work_participants`);
  }
}
