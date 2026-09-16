import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PROPOSAL — NOT REGISTERED IN index.ts, NOT EXECUTED.
 * Produced by a read-only audit (E-category schema review) of packages/types/src/enums.ts
 * PT-BR-valued status enums. See audit notes for full enum→column→risk table.
 *
 * Scope: `artist_goals.status` (ArtistGoalStatus) only — one of the audit's
 * identified "quick win" low-risk candidates:
 *   - 1 backend consumer, 0 frontend consumers (grep, 2026-09-10).
 *   - No DB CHECK constraint on this column today (varchar(50), unconstrained;
 *     confirmed by inspecting entities.ts + full migrations/ CHECK grep).
 *   - No RLS policy or trigger references the literal status value (RLS here
 *     is tenant_id-scoped only — see 20260719000... Rebuild*CanonicalFormOrder
 *     migrations for this table's policy).
 *   - Naturally low-cardinality per tenant (a handful of goals per artist),
 *     unlike transactions/leads/events.
 *   - IS registered in the Reports export catalog (entity-metadata.service.ts),
 *     so the raw column value DOES reach user-facing XLSX exports verbatim
 *     (this repo is XLSX-only, scripts/verify-xlsx-only.mjs; export-query-builder
 *     emits `SELECT "status" FROM ...` with no value
 *     translation layer) — this migration's backfill is what makes that
 *     export show the new English value; it is not merely a technical rename.
 *
 * This file implements ONLY step 2 of the 4-step expand/contract pattern this
 * repo already uses for persisted-value migrations (precedent:
 * 20260718000015_BackfillLegacySocietyCodesToExternalIdentifiers.ts +
 * 20260718000016_RemoveLegacySocietyCodeColumns.ts):
 *
 *   1. EXPAND (application code, not a migration): ship a release where
 *      writers/readers of `artist_goals.status` accept EITHER the current
 *      PT-BR values (em_andamento/concluido/cancelado/expirado) OR the new
 *      EN values (in_progress/completed/cancelled/expired). Do this BEFORE
 *      running this migration, and confirm it is deployed and stable.
 *   2. BACKFILL (this migration): idempotently rewrite existing PT-BR rows to
 *      the EN values. Safe to run repeatedly (WHERE clause only matches rows
 *      still holding an old value); safe to run while old app code AND new
 *      app code are both live, because step 1 already made both acceptable.
 *   3. CONTRACT (application code): ship a release where the app only WRITES
 *      the EN values. `packages/types/src/enums.ts` ArtistGoalStatus is
 *      updated to EN member values at this point, along with its 1 backend
 *      consumer.
 *   4. RESTRICT (a later migration, NOT this file): once step 3 has been
 *      live long enough that no straggler PT-BR row can reappear, optionally
 *      add `CHECK (status IN ('in_progress','completed','cancelled','expired'))`
 *      to make the invariant DB-enforced instead of assumed.
 *
 * Do NOT run this against production data. Do NOT register it in
 * migrations/index.ts. It requires explicit human authorization and step 1
 * (application-layer dual-accept) to already be deployed, per this repo's
 * data-governance rule (.claude/rules/data-governance.md): destructive/behind
 * -the-scenes value rewrites on a populated table are L5 and need an
 * authorized, verified rollout window plus a tested down-path.
 */
export class PROPOSAL_BackfillArtistGoalStatusToEnglish20260910900001 implements MigrationInterface {
  name = 'PROPOSAL_BackfillArtistGoalStatusToEnglish20260910900001';

  private readonly ptToEn: Array<[string, string]> = [
    ['em_andamento', 'in_progress'],
    ['concluido', 'completed'],
    ['cancelado', 'cancelled'],
    ['expirado', 'expired'],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [pt, en] of this.ptToEn) {
      const [{ affected }] = await queryRunner.query(
        `WITH updated AS (
           UPDATE artist_goals SET status = $2, updated_at = now()
           WHERE status = $1
           RETURNING id
         )
         SELECT count(*)::int AS affected FROM updated`,
        [pt, en],
      );
      // eslint-disable-next-line no-console
      console.log(`[PROPOSAL backfill] artist_goals.status '${pt}' -> '${en}': ${affected} row(s)`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [pt, en] of this.ptToEn) {
      await queryRunner.query(
        `UPDATE artist_goals SET status = $1, updated_at = now() WHERE status = $2`,
        [pt, en],
      );
    }
  }
}
