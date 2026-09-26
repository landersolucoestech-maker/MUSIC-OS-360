import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 13A / M3 — financial accounts, counterparties and cost centers
 * (Phase 12 §2.3–2.5). They replace the legacy free-text fields
 * (conta_origem/destino, fornecedor_cliente, centro_custo) — which are NOT
 * recreated as the main model.
 *
 * - An account balance is NEVER persisted (derived: opening_balance + Σ settled).
 * - A counterparty may reference real registrations via a typed COMPOSITE FK
 *   (artist_id OR client_id — at most one), without FK-less polymorphism.
 * - Deactivation/soft delete preserve history (I9: RESTRICT FKs in M4).
 */
export class FinancialPartiesAccounts20260718000003 implements MigrationInterface {
  name = 'FinancialPartiesAccounts20260718000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "financial_accounts" (
        "id"                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"            uuid NOT NULL,
        "name"                 varchar(120) NOT NULL,
        "type"                 "account_type" NOT NULL,
        "currency"             char(3) NOT NULL DEFAULT 'BRL' CHECK ("currency" ~ '^[A-Z]{3}$'),
        "opening_balance"      numeric(15,2) NULL,
        "opening_balance_date" date NULL,
        "is_active"            boolean NOT NULL DEFAULT true,
        "created_at"           timestamptz NOT NULL DEFAULT now(),
        "updated_at"           timestamptz NOT NULL DEFAULT now(),
        "created_by"           uuid NULL,
        "updated_by"           uuid NULL,
        "deleted_at"           timestamptz NULL,
        CONSTRAINT "uq_financial_accounts_tenant_id_id" UNIQUE ("tenant_id", "id"),
        CONSTRAINT "ck_financial_accounts_opening_pair" CHECK (
          ("opening_balance" IS NULL) = ("opening_balance_date" IS NULL)
        )
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_financial_accounts_tenant_name"
        ON "financial_accounts" ("tenant_id", "name") WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "counterparties" (
        "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"  uuid NOT NULL,
        "name"       varchar(255) NOT NULL,
        "type"       "counterparty_type" NOT NULL,
        "document"   varchar(32) NULL,
        "country"    char(2) NULL,
        "artist_id"  uuid NULL,
        "client_id"  uuid NULL,
        "is_active"  boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid NULL,
        "updated_by" uuid NULL,
        "deleted_at" timestamptz NULL,
        CONSTRAINT "uq_counterparties_tenant_id_id" UNIQUE ("tenant_id", "id"),
        CONSTRAINT "ck_counterparties_single_ref" CHECK (num_nonnulls("artist_id", "client_id") <= 1),
        CONSTRAINT "fk_counterparties_artist"
          FOREIGN KEY ("tenant_id", "artist_id") REFERENCES "artists" ("tenant_id", "id"),
        CONSTRAINT "fk_counterparties_client"
          FOREIGN KEY ("tenant_id", "client_id") REFERENCES "clients" ("tenant_id", "id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_counterparties_tenant_name"
        ON "counterparties" ("tenant_id", "name") WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "cost_centers" (
        "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"  uuid NOT NULL,
        "name"       varchar(120) NOT NULL,
        "code"       varchar(30) NULL,
        "is_active"  boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid NULL,
        "updated_by" uuid NULL,
        "deleted_at" timestamptz NULL,
        CONSTRAINT "uq_cost_centers_tenant_id_id" UNIQUE ("tenant_id", "id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_cost_centers_tenant_name"
        ON "cost_centers" ("tenant_id", "name") WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "cost_centers"`);
    await queryRunner.query(`DROP TABLE "counterparties"`);
    await queryRunner.query(`DROP TABLE "financial_accounts"`);
  }
}
