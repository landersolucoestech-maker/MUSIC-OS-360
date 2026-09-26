import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 13A / M4 — financial_transactions v2 (Phase 12 §2.6) + state
 * machine (§11) + immutability (I8) + optimistic locking, protected in the database.
 *
 * Binding decisions materialized:
 * - amount > 0 (I1; the sign comes from the type/nature of the category);
 * - competence_date mandatory (accrual basis) and settlement_date
 *   coherent with the status (I16);
 * - a transfer requires distinct source/destination accounts and needs no category;
 * - reversal = a linked INVERSE transaction (reversal_of_id), unique per original,
 *   never itself; original settled → reversed;
 * - soft delete restricted to 'pending' (settled is reversed, not deleted);
 * - the form's satellite columns kept 1-column-per-field (product rule
 *   2026-07-12); metadata only for non-structural extensions;
 * - language standard of the new domain: English/snake_case (Phase 12).
 *
 * Division of responsibility (Phase 13A Step 12): the database protects the
 * structural invariants; the ORCHESTRATION of the reversal (create the inverse + mirror
 * allocations + flip the original in the SAME SQL transaction) belongs to the backend.
 */
export class FinancialTransactions20260718000004 implements MigrationInterface {
  name = 'FinancialTransactions20260718000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "financial_transactions" (
        "id"                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"            uuid NOT NULL,
        "type"                 "transaction_type" NOT NULL,
        "status"               "transaction_status" NOT NULL DEFAULT 'pending',
        "description"          text NULL,
        "amount"               numeric(15,2) NOT NULL,
        "currency"             char(3) NOT NULL DEFAULT 'BRL' CHECK ("currency" ~ '^[A-Z]{3}$'),
        "category_id"          uuid NULL,
        "category_snapshot"    jsonb NOT NULL DEFAULT '{}',
        "competence_date"      date NOT NULL,
        "due_date"             date NULL,
        "settlement_date"      date NULL,
        "account_id"           uuid NULL,
        "counter_account_id"   uuid NULL,
        "counterparty_id"      uuid NULL,
        "cost_center_id"       uuid NULL,
        "contract_id"          uuid NULL,
        "event_id"             uuid NULL,
        "installment_group_id" uuid NULL,
        "installment_number"   smallint NULL,
        "installment_count"    smallint NULL,
        "installment_interval" "installment_interval" NULL,
        "reversal_of_id"       uuid NULL,
        "payment_method"       varchar(50) NULL,
        "payment_type"         varchar(50) NULL,
        "client_type"          varchar(50) NULL,
        "collecting_agency"    varchar(255) NULL,
        "investment_item"      varchar(255) NULL,
        "travel_reason"        varchar(255) NULL,
        "advertising_name"     varchar(255) NULL,
        "attachment_url"       text NULL,
        "attachment_name"      varchar(255) NULL,
        "metadata"             jsonb NOT NULL DEFAULT '{}',
        "version"              integer NOT NULL DEFAULT 1,
        "created_at"           timestamptz NOT NULL DEFAULT now(),
        "updated_at"           timestamptz NOT NULL DEFAULT now(),
        "created_by"           uuid NULL,
        "updated_by"           uuid NULL,
        "deleted_at"           timestamptz NULL,
        CONSTRAINT "uq_financial_transactions_tenant_id_id" UNIQUE ("tenant_id", "id"),
        CONSTRAINT "ck_fintx_amount_positive" CHECK ("amount" > 0),
        CONSTRAINT "ck_fintx_settlement_status" CHECK (
          ("status" = 'settled'   AND "settlement_date" IS NOT NULL) OR
          ("status" = 'pending'   AND "settlement_date" IS NULL) OR
          ("status" = 'cancelled' AND "settlement_date" IS NULL) OR
          ("status" = 'reversed')
        ),
        CONSTRAINT "ck_fintx_category_required" CHECK (
          "type" = 'transfer' OR "category_id" IS NOT NULL
        ),
        CONSTRAINT "ck_fintx_transfer_accounts" CHECK (
          ("type" = 'transfer' AND "account_id" IS NOT NULL
             AND "counter_account_id" IS NOT NULL
             AND "account_id" <> "counter_account_id")
          OR ("type" <> 'transfer' AND "counter_account_id" IS NULL)
        ),
        CONSTRAINT "ck_fintx_installments_triplet" CHECK (
          ("installment_group_id" IS NULL AND "installment_number" IS NULL
             AND "installment_count" IS NULL AND "installment_interval" IS NULL)
          OR ("installment_group_id" IS NOT NULL AND "installment_number" IS NOT NULL
             AND "installment_count" IS NOT NULL AND "installment_interval" IS NOT NULL
             AND "installment_number" BETWEEN 1 AND "installment_count")
        ),
        CONSTRAINT "ck_fintx_no_self_reversal" CHECK ("reversal_of_id" <> "id"),
        CONSTRAINT "uq_fintx_single_reversal" UNIQUE ("tenant_id", "reversal_of_id"),
        CONSTRAINT "fk_fintx_category"
          FOREIGN KEY ("tenant_id", "category_id") REFERENCES "financial_categories" ("tenant_id", "id"),
        CONSTRAINT "fk_fintx_account"
          FOREIGN KEY ("tenant_id", "account_id") REFERENCES "financial_accounts" ("tenant_id", "id"),
        CONSTRAINT "fk_fintx_counter_account"
          FOREIGN KEY ("tenant_id", "counter_account_id") REFERENCES "financial_accounts" ("tenant_id", "id"),
        CONSTRAINT "fk_fintx_counterparty"
          FOREIGN KEY ("tenant_id", "counterparty_id") REFERENCES "counterparties" ("tenant_id", "id"),
        CONSTRAINT "fk_fintx_cost_center"
          FOREIGN KEY ("tenant_id", "cost_center_id") REFERENCES "cost_centers" ("tenant_id", "id"),
        CONSTRAINT "fk_fintx_contract"
          FOREIGN KEY ("tenant_id", "contract_id") REFERENCES "contracts" ("tenant_id", "id"),
        CONSTRAINT "fk_fintx_event"
          FOREIGN KEY ("tenant_id", "event_id") REFERENCES "events" ("tenant_id", "id"),
        CONSTRAINT "fk_fintx_reversal_of"
          FOREIGN KEY ("tenant_id", "reversal_of_id") REFERENCES "financial_transactions" ("tenant_id", "id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_fintx_tenant_competence" ON "financial_transactions" ("tenant_id", "competence_date")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_fintx_tenant_settlement" ON "financial_transactions" ("tenant_id", "settlement_date")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_fintx_tenant_status" ON "financial_transactions" ("tenant_id", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_fintx_tenant_due_pending" ON "financial_transactions" ("tenant_id", "due_date")
        WHERE "status" = 'pending'
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_fintx_tenant_category" ON "financial_transactions" ("tenant_id", "category_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_fintx_tenant_account" ON "financial_transactions" ("tenant_id", "account_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_fintx_tenant_counterparty" ON "financial_transactions" ("tenant_id", "counterparty_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_fintx_tenant_cost_center" ON "financial_transactions" ("tenant_id", "cost_center_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_fintx_installment_group" ON "financial_transactions" ("tenant_id", "installment_group_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_fintx_tenant_live" ON "financial_transactions" ("tenant_id")
        WHERE "deleted_at" IS NULL
    `);

    // State machine + immutability (I8) + restricted soft delete.
    await queryRunner.query(`
      CREATE FUNCTION "fn_fintx_state_machine"() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          RAISE EXCEPTION 'financial_transactions: exclusão física proibida (use cancelamento/estorno)';
        END IF;

        IF NEW."status" <> OLD."status" THEN
          IF NOT (
            (OLD."status" = 'pending' AND NEW."status" IN ('settled', 'cancelled')) OR
            (OLD."status" = 'settled' AND NEW."status" = 'reversed')
          ) THEN
            RAISE EXCEPTION 'financial_transactions: transição de status % → % proibida',
              OLD."status", NEW."status";
          END IF;
        ELSIF OLD."status" IN ('cancelled', 'reversed') THEN
          RAISE EXCEPTION 'financial_transactions: registro em estado terminal (%) é imutável', OLD."status";
        END IF;

        -- Campos financeiros imutáveis após liquidação (I8). Vínculos
        -- gerenciais (counterparty/cost_center/descrição/anexos) permanecem
        -- editáveis com auditoria.
        IF OLD."status" IN ('settled', 'reversed') THEN
          IF NEW."type" IS DISTINCT FROM OLD."type"
             OR NEW."amount" IS DISTINCT FROM OLD."amount"
             OR NEW."currency" IS DISTINCT FROM OLD."currency"
             OR NEW."competence_date" IS DISTINCT FROM OLD."competence_date"
             OR (NEW."settlement_date" IS DISTINCT FROM OLD."settlement_date"
                 AND NOT (OLD."status" = 'settled' AND NEW."status" = 'reversed'))
             OR NEW."account_id" IS DISTINCT FROM OLD."account_id"
             OR NEW."counter_account_id" IS DISTINCT FROM OLD."counter_account_id"
             OR NEW."category_id" IS DISTINCT FROM OLD."category_id"
             OR NEW."reversal_of_id" IS DISTINCT FROM OLD."reversal_of_id" THEN
            RAISE EXCEPTION 'financial_transactions: campos financeiros de transação liquidada são imutáveis (estorne para corrigir)';
          END IF;
        END IF;

        IF NEW."deleted_at" IS NOT NULL AND OLD."deleted_at" IS NULL
           AND OLD."status" <> 'pending' THEN
          RAISE EXCEPTION 'financial_transactions: soft delete permitido somente em pending';
        END IF;

        RETURN NEW;
      END $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_fintx_state_machine"
        BEFORE UPDATE OR DELETE ON "financial_transactions"
        FOR EACH ROW EXECUTE FUNCTION "fn_fintx_state_machine"()
    `);

    // Structural reversal: the target must be settled and cannot itself be a
    // reversal (prevents chains/cycles). The full orchestration belongs to the backend.
    await queryRunner.query(`
      CREATE FUNCTION "fn_fintx_reversal_guard"() RETURNS trigger
      LANGUAGE plpgsql AS $$
      DECLARE v_target record;
      BEGIN
        IF NEW."reversal_of_id" IS NULL THEN RETURN NEW; END IF;
        IF NEW."status" <> 'settled' THEN
          RAISE EXCEPTION 'financial_transactions: transação de estorno nasce settled';
        END IF;
        SELECT "status", "reversal_of_id", "type", "amount", "currency" INTO v_target
          FROM "financial_transactions"
         WHERE "tenant_id" = NEW."tenant_id" AND "id" = NEW."reversal_of_id";
        IF v_target."reversal_of_id" IS NOT NULL THEN
          RAISE EXCEPTION 'financial_transactions: não é permitido estornar um estorno';
        END IF;
        IF v_target."status" <> 'settled' THEN
          RAISE EXCEPTION 'financial_transactions: só transações settled podem ser estornadas';
        END IF;
        IF NEW."amount" IS DISTINCT FROM v_target."amount"
           OR NEW."currency" IS DISTINCT FROM v_target."currency" THEN
          RAISE EXCEPTION 'financial_transactions: estorno deve espelhar valor e moeda da original';
        END IF;
        IF (v_target."type" = 'revenue' AND NEW."type" <> 'expense')
           OR (v_target."type" = 'expense' AND NEW."type" <> 'revenue')
           OR (v_target."type" = 'transfer' AND NEW."type" <> 'transfer') THEN
          RAISE EXCEPTION 'financial_transactions: estorno deve inverter a natureza da original';
        END IF;
        RETURN NEW;
      END $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_fintx_reversal_guard"
        BEFORE INSERT ON "financial_transactions"
        FOR EACH ROW WHEN (NEW."reversal_of_id" IS NOT NULL)
        EXECUTE FUNCTION "fn_fintx_reversal_guard"()
    `);

    // Optimistic locking: every UPDATE must advance exactly 1 version.
    await queryRunner.query(`
      CREATE FUNCTION "fn_financial_version_lock"() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW."version" IS DISTINCT FROM OLD."version" + 1 THEN
          RAISE EXCEPTION 'VERSION_CONFLICT: esperado version %, recebido %',
            OLD."version" + 1, NEW."version";
        END IF;
        NEW."updated_at" := now();
        RETURN NEW;
      END $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_fintx_version_lock"
        BEFORE UPDATE ON "financial_transactions"
        FOR EACH ROW EXECUTE FUNCTION "fn_financial_version_lock"()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER "trg_fintx_version_lock" ON "financial_transactions"`);
    await queryRunner.query(`DROP TRIGGER "trg_fintx_reversal_guard" ON "financial_transactions"`);
    await queryRunner.query(`DROP TRIGGER "trg_fintx_state_machine" ON "financial_transactions"`);
    await queryRunner.query(`DROP FUNCTION "fn_financial_version_lock"()`);
    await queryRunner.query(`DROP FUNCTION "fn_fintx_reversal_guard"()`);
    await queryRunner.query(`DROP FUNCTION "fn_fintx_state_machine"()`);
    await queryRunner.query(`DROP TABLE "financial_transactions"`);
  }
}
