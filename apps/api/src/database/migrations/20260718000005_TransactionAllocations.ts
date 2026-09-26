import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 13A / M5 — transaction_allocations (Phase 12 §2.7) + fn_largest_remainder
 * (§10, normative algorithm) + sums constraint trigger (I5/I7).
 *
 * Approved Model 4 with PARALLEL DIMENSIONS (project/artist/phonogram/release):
 * each dimension closes up to 100% separately; dimensions are NEVER summed with
 * each other (I13). The remainder (<100%) is the implicit "Sem vínculo" (unallocated) group — NO
 * physical row is created for it (explicit Phase 12/13A decision).
 *
 * allocated_amount is computed AT WRITE TIME by the backend (largest remainder) and
 * PERSISTED; the DEFERRED trigger checks the aggregate per (transaction, dimension)
 * at commit — the SQL function fn_largest_remainder is available for data
 * import and validation, with the SAME algorithm as the TypeScript version
 * (apps/api/src/modules/financial/domain/largest-remainder.ts).
 */
export class TransactionAllocations20260718000005 implements MigrationInterface {
  name = 'TransactionAllocations20260718000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "transaction_allocations" (
        "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"        uuid NOT NULL,
        "transaction_id"   uuid NOT NULL,
        "dimension"        "allocation_dimension" NOT NULL,
        "project_id"       uuid NULL,
        "artist_id"        uuid NULL,
        "phonogram_id"     uuid NULL,
        "release_id"       uuid NULL,
        "percentage"       numeric(7,4) NOT NULL,
        "allocated_amount" numeric(15,2) NOT NULL,
        "version"          integer NOT NULL DEFAULT 1,
        "created_at"       timestamptz NOT NULL DEFAULT now(),
        "updated_at"       timestamptz NOT NULL DEFAULT now(),
        "created_by"       uuid NULL,
        "updated_by"       uuid NULL,
        CONSTRAINT "uq_transaction_allocations_tenant_id_id" UNIQUE ("tenant_id", "id"),
        CONSTRAINT "ck_txalloc_percentage_range" CHECK ("percentage" > 0 AND "percentage" <= 100),
        CONSTRAINT "ck_txalloc_amount_positive" CHECK ("allocated_amount" > 0),
        CONSTRAINT "ck_txalloc_dimension_target" CHECK (
          ("dimension" = 'project'   AND "project_id"   IS NOT NULL AND num_nonnulls("artist_id", "phonogram_id", "release_id") = 0) OR
          ("dimension" = 'artist'    AND "artist_id"    IS NOT NULL AND num_nonnulls("project_id", "phonogram_id", "release_id") = 0) OR
          ("dimension" = 'phonogram' AND "phonogram_id" IS NOT NULL AND num_nonnulls("project_id", "artist_id", "release_id") = 0) OR
          ("dimension" = 'release'   AND "release_id"   IS NOT NULL AND num_nonnulls("project_id", "artist_id", "phonogram_id") = 0)
        ),
        CONSTRAINT "uq_txalloc_target_per_dimension"
          UNIQUE NULLS NOT DISTINCT
          ("tenant_id", "transaction_id", "dimension", "project_id", "artist_id", "phonogram_id", "release_id"),
        CONSTRAINT "fk_txalloc_transaction"
          FOREIGN KEY ("tenant_id", "transaction_id")
          REFERENCES "financial_transactions" ("tenant_id", "id") ON DELETE CASCADE,
        CONSTRAINT "fk_txalloc_project"
          FOREIGN KEY ("tenant_id", "project_id") REFERENCES "projects" ("tenant_id", "id"),
        CONSTRAINT "fk_txalloc_artist"
          FOREIGN KEY ("tenant_id", "artist_id") REFERENCES "artists" ("tenant_id", "id"),
        CONSTRAINT "fk_txalloc_phonogram"
          FOREIGN KEY ("tenant_id", "phonogram_id") REFERENCES "phonograms" ("tenant_id", "id"),
        CONSTRAINT "fk_txalloc_release"
          FOREIGN KEY ("tenant_id", "release_id") REFERENCES "releases" ("tenant_id", "id")
      )
    `);
    // Note: the CASCADE of fk_txalloc_transaction is intentional and limited —
    // allocations are satellites of the transaction; the physical deletion of the transaction
    // itself is already blocked by the M4 trigger, so the cascading effect only applies
    // to administrative maintenance via the migrator.

    await queryRunner.query(`
      CREATE INDEX "idx_txalloc_tenant_transaction" ON "transaction_allocations" ("tenant_id", "transaction_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_txalloc_tenant_project" ON "transaction_allocations" ("tenant_id", "dimension", "project_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_txalloc_tenant_artist" ON "transaction_allocations" ("tenant_id", "dimension", "artist_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_txalloc_tenant_phonogram" ON "transaction_allocations" ("tenant_id", "dimension", "phonogram_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_txalloc_tenant_release" ON "transaction_allocations" ("tenant_id", "dimension", "release_id")
    `);

    // Normative largest-remainder algorithm (Phase 12 §10) — deterministic:
    // tie-break by largest fraction and, when equal, the LOWEST input index.
    await queryRunner.query(`
      CREATE FUNCTION "fn_largest_remainder"("p_amount" numeric, "p_percentages" numeric[])
      RETURNS numeric[]
      LANGUAGE plpgsql IMMUTABLE AS $$
      DECLARE
        v_n integer := coalesce(array_length("p_percentages", 1), 0);
        v_sum_pct numeric := 0;
        v_target_cents bigint;
        v_floors bigint[] := '{}';
        v_fracs numeric[] := '{}';
        v_raw numeric;
        v_floor bigint;
        v_residue bigint;
        v_result numeric[] := '{}';
        i integer;
        v_pick integer;
        v_best numeric;
      BEGIN
        IF "p_amount" IS NULL OR "p_amount" <= 0 THEN
          RAISE EXCEPTION 'fn_largest_remainder: amount deve ser > 0';
        END IF;
        IF v_n = 0 THEN
          RAISE EXCEPTION 'fn_largest_remainder: lista de percentuais vazia';
        END IF;
        FOR i IN 1..v_n LOOP
          IF "p_percentages"[i] IS NULL OR "p_percentages"[i] <= 0 OR "p_percentages"[i] > 100 THEN
            RAISE EXCEPTION 'fn_largest_remainder: percentual inválido na posição %', i;
          END IF;
          v_sum_pct := v_sum_pct + "p_percentages"[i];
        END LOOP;
        IF v_sum_pct > 100.0000 THEN
          RAISE EXCEPTION 'fn_largest_remainder: soma de percentuais % excede 100', v_sum_pct;
        END IF;

        -- alvo em centavos: round(amount × Σpct / 100, 2) × 100
        v_target_cents := round(("p_amount" * v_sum_pct / 100) * 100)::bigint;

        FOR i IN 1..v_n LOOP
          v_raw := "p_amount" * "p_percentages"[i]; -- (amount×pct/100)×100 = centavos fracionários
          v_floor := trunc(v_raw)::bigint;
          v_floors := v_floors || v_floor;
          v_fracs := v_fracs || (v_raw - v_floor);
        END LOOP;

        v_residue := v_target_cents - (SELECT sum(f) FROM unnest(v_floors) AS f);

        WHILE v_residue > 0 LOOP
          v_pick := NULL; v_best := -1;
          FOR i IN 1..v_n LOOP
            IF v_fracs[i] > v_best THEN
              v_best := v_fracs[i];
              v_pick := i;
            END IF;
          END LOOP;
          v_floors[v_pick] := v_floors[v_pick] + 1;
          v_fracs[v_pick] := -2; -- consumido nesta rodada
          v_residue := v_residue - 1;
        END LOOP;

        FOR i IN 1..v_n LOOP
          IF v_floors[i] = 0 THEN
            RAISE EXCEPTION 'fn_largest_remainder: rateio inviável — parcela da posição % resulta em R$ 0,00', i;
          END IF;
          v_result := v_result || (v_floors[i]::numeric / 100);
        END LOOP;
        RETURN v_result;
      END $$
    `);

    // I5 + I7 per (transaction, dimension), evaluated at COMMIT (deferred) to
    // allow writing/replacing the full set in the same SQL transaction.
    await queryRunner.query(`
      CREATE FUNCTION "fn_txalloc_check_sums"() RETURNS trigger
      LANGUAGE plpgsql AS $$
      DECLARE
        v_tenant uuid; v_txid uuid; v_dimension "allocation_dimension";
        v_tx record;
        v_sum_pct numeric; v_sum_amount numeric; v_expected numeric;
      BEGIN
        IF TG_OP = 'DELETE' THEN
          v_tenant := OLD."tenant_id"; v_txid := OLD."transaction_id"; v_dimension := OLD."dimension";
        ELSE
          v_tenant := NEW."tenant_id"; v_txid := NEW."transaction_id"; v_dimension := NEW."dimension";
        END IF;

        SELECT "type", "amount" INTO v_tx
          FROM "financial_transactions"
         WHERE "tenant_id" = v_tenant AND "id" = v_txid;
        IF v_tx IS NULL THEN
          RETURN NULL; -- transação removida na mesma tx (CASCADE administrativo)
        END IF;
        IF v_tx."type" = 'transfer' THEN
          RAISE EXCEPTION 'transaction_allocations: transferências não recebem alocação (I2)';
        END IF;

        SELECT coalesce(sum("percentage"), 0), coalesce(sum("allocated_amount"), 0)
          INTO v_sum_pct, v_sum_amount
          FROM "transaction_allocations"
         WHERE "tenant_id" = v_tenant AND "transaction_id" = v_txid AND "dimension" = v_dimension;

        IF v_sum_pct > 100.0000 THEN
          RAISE EXCEPTION 'transaction_allocations: soma da dimensão % é %%% (máximo 100) — I5',
            v_dimension, v_sum_pct;
        END IF;

        v_expected := round(v_tx."amount" * v_sum_pct / 100, 2);
        IF v_sum_amount <> v_expected THEN
          RAISE EXCEPTION 'transaction_allocations: Σ allocated_amount (%) difere do esperado (%) para a dimensão % — I7 (use o maior resto)',
            v_sum_amount, v_expected, v_dimension;
        END IF;
        RETURN NULL;
      END $$
    `);
    await queryRunner.query(`
      CREATE CONSTRAINT TRIGGER "trg_txalloc_check_sums"
        AFTER INSERT OR UPDATE OR DELETE ON "transaction_allocations"
        DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW EXECUTE FUNCTION "fn_txalloc_check_sums"()
    `);

    await queryRunner.query(`
      CREATE TRIGGER "trg_txalloc_version_lock"
        BEFORE UPDATE ON "transaction_allocations"
        FOR EACH ROW EXECUTE FUNCTION "fn_financial_version_lock"()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER "trg_txalloc_version_lock" ON "transaction_allocations"`);
    await queryRunner.query(`DROP TRIGGER "trg_txalloc_check_sums" ON "transaction_allocations"`);
    await queryRunner.query(`DROP FUNCTION "fn_txalloc_check_sums"()`);
    await queryRunner.query(`DROP FUNCTION "fn_largest_remainder"(numeric, numeric[])`);
    await queryRunner.query(`DROP TABLE "transaction_allocations"`);
  }
}
