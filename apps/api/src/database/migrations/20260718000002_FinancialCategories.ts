import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 13A / M2 — financial classification (Phase 12 §2.1–2.2), REVISED in
 * Phase 13B (formal authorization) to resolve the proven conflict with the
 * legacy categories module (20260526000002_FinancialCategoriesEnterprise).
 *
 * CONFLICT CONTEXT: the legacy chain creates `financial_categories` (+5
 * satellites alive at this migration's point: category_centers [without center_id,
 * removed by D8], links, favorites, rules [post-D7 Enterprise shape] and
 * rule_runs). The legacy `financial_category_templates` and `financial_centers`
 * were already removed by the chain itself (D5/D8 in 20260705000003). Phase 12
 * classified the legacy module as SUPERSEDED by the new definition.
 *
 * STRATEGY (normative, per the authorization):
 *  1. fail-fast: the 6 legacy tables must EXIST, have the expected legacy
 *     SIGNATURE and hold 0 RECORDS; the new structure must not exist;
 *  2. catalog dependency check: no FK external to the set and
 *     no view may reference the tables; otherwise it ABORTS;
 *  3. removal in reverse dependency order, WITHOUT CASCADE;
 *  4. creation of the new official structure (global templates + tenant categories).
 *
 * down(): Option 1 of the authorization — FULL RESTORATION: removes the new
 * structure and faithfully recreates the 6 legacy tables in the exact shape of that point of the
 * chain (DDL transcribed from 20260526000002, adjusted by 20260705000003
 * D7/D8), with indexes, FORCE RLS and harmonized policies
 * (20260613000015). No seed/data at all.
 */
export class FinancialCategories20260718000002 implements MigrationInterface {
  name = 'FinancialCategories20260718000002';

  /** REVERSE dependency order for removal (satellites before the base). */
  private static readonly LEGACY_TABLES_REVERSE = [
    'financial_category_rule_runs',
    'financial_category_rules',
    'financial_category_favorites',
    'financial_category_links',
    'financial_category_centers',
    'financial_categories',
  ] as const;

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Fail-fast preconditions (existence, signature and zero records) ─────
    await queryRunner.query(`
      DO $$
      DECLARE
        v_table text;
        v_count bigint;
      BEGIN
        FOREACH v_table IN ARRAY ARRAY[
          'financial_category_rule_runs', 'financial_category_rules',
          'financial_category_favorites', 'financial_category_links',
          'financial_category_centers', 'financial_categories'
        ] LOOP
          IF to_regclass('public.' || v_table) IS NULL THEN
            RAISE EXCEPTION 'M2: tabela legada % ausente — ponto da cadeia inesperado; abortando sem alterar nada', v_table;
          END IF;
          EXECUTE format('SELECT count(*) FROM %I', v_table) INTO v_count;
          IF v_count <> 0 THEN
            RAISE EXCEPTION 'M2: tabela legada % possui % registro(s) — substituição proibida com dados; abortando', v_table, v_count;
          END IF;
        END LOOP;

        -- Assinatura legada da base (colunas distintivas presentes)…
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'financial_categories' AND column_name = 'slug'
        ) OR NOT EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'financial_categories' AND column_name = 'category_kind'
        ) OR NOT EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'financial_categories' AND column_name = 'depth_level'
        ) THEN
          RAISE EXCEPTION 'M2: financial_categories não tem a assinatura LEGADA esperada (slug/category_kind/depth_level) — abortando';
        END IF;
        -- …e colunas da estrutura NOVA ausentes (M2 ainda não aplicada).
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'financial_categories'
             AND column_name IN ('nature', 'includes_in_pnl')
        ) THEN
          RAISE EXCEPTION 'M2: financial_categories já possui colunas da estrutura nova — M2 aparenta já aplicada; abortando';
        END IF;
        IF to_regclass('public.financial_category_templates') IS NOT NULL THEN
          RAISE EXCEPTION 'M2: financial_category_templates já existe (legada deveria ter sido removida por D5; nova ainda não criada) — ambiente inesperado; abortando';
        END IF;
      END $$
    `);

    // ── 2. External dependencies in the catalog (FKs from outside the set, views) ─
    await queryRunner.query(`
      DO $$
      DECLARE
        v_offender text;
      BEGIN
        SELECT string_agg(conrelid::regclass::text || '.' || conname, ', ')
          INTO v_offender
          FROM pg_constraint
         WHERE contype = 'f'
           AND confrelid::regclass::text = ANY (ARRAY[
             'financial_categories', 'financial_category_centers',
             'financial_category_links', 'financial_category_favorites',
             'financial_category_rules', 'financial_category_rule_runs'
           ])
           AND conrelid::regclass::text <> ALL (ARRAY[
             'financial_categories', 'financial_category_centers',
             'financial_category_links', 'financial_category_favorites',
             'financial_category_rules', 'financial_category_rule_runs'
           ]);
        IF v_offender IS NOT NULL THEN
          RAISE EXCEPTION 'M2: FKs externas inesperadas referenciam o módulo legado (%) — abortando', v_offender;
        END IF;

        SELECT string_agg(DISTINCT view_name, ', ')
          INTO v_offender
          FROM information_schema.view_table_usage
         WHERE table_schema = 'public'
           AND table_name IN (
             'financial_categories', 'financial_category_centers',
             'financial_category_links', 'financial_category_favorites',
             'financial_category_rules', 'financial_category_rule_runs'
           );
        IF v_offender IS NOT NULL THEN
          RAISE EXCEPTION 'M2: views dependem do módulo legado (%) — abortando', v_offender;
        END IF;
      END $$
    `);

    // ── 3. Validated removal, reverse order, WITHOUT CASCADE ─────────────────────
    for (const table of FinancialCategories20260718000002.LEGACY_TABLES_REVERSE) {
      await queryRunner.query(`DROP TABLE "${table}"`);
    }

    // ── 4. New official structure (definition approved in Phase 12) ─────────────
    await queryRunner.query(`
      CREATE TABLE "financial_category_templates" (
        "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "parent_id"       uuid NULL REFERENCES "financial_category_templates" ("id"),
        "name"            varchar(120) NOT NULL,
        "nature"          "category_nature" NOT NULL,
        "includes_in_pnl" boolean NOT NULL DEFAULT true,
        "level"           smallint NOT NULL CHECK ("level" BETWEEN 1 AND 3),
        "sort_order"      integer NOT NULL DEFAULT 0,
        CONSTRAINT "uq_fincat_templates_parent_name" UNIQUE NULLS NOT DISTINCT ("parent_id", "name")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "financial_categories" (
        "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"       uuid NOT NULL,
        "parent_id"       uuid NULL,
        "template_id"     uuid NULL REFERENCES "financial_category_templates" ("id"),
        "name"            varchar(120) NOT NULL,
        "nature"          "category_nature" NOT NULL,
        "includes_in_pnl" boolean NOT NULL DEFAULT true,
        "level"           smallint NOT NULL CHECK ("level" BETWEEN 1 AND 3),
        "is_active"       boolean NOT NULL DEFAULT true,
        "sort_order"      integer NOT NULL DEFAULT 0,
        "created_at"      timestamptz NOT NULL DEFAULT now(),
        "updated_at"      timestamptz NOT NULL DEFAULT now(),
        "created_by"      uuid NULL,
        "updated_by"      uuid NULL,
        CONSTRAINT "uq_financial_categories_tenant_id_id" UNIQUE ("tenant_id", "id"),
        CONSTRAINT "uq_financial_categories_tenant_parent_name"
          UNIQUE NULLS NOT DISTINCT ("tenant_id", "parent_id", "name"),
        CONSTRAINT "fk_financial_categories_parent"
          FOREIGN KEY ("tenant_id", "parent_id")
          REFERENCES "financial_categories" ("tenant_id", "id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_financial_categories_tenant_parent"
        ON "financial_categories" ("tenant_id", "parent_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_financial_categories_tenant_active"
        ON "financial_categories" ("tenant_id", "is_active")
    `);

    await queryRunner.query(`
      CREATE FUNCTION "fn_fincat_level_guard"() RETURNS trigger
      LANGUAGE plpgsql AS $$
      DECLARE v_parent_level smallint;
      BEGIN
        IF NEW."parent_id" IS NULL THEN
          IF NEW."level" <> 1 THEN
            RAISE EXCEPTION 'financial_categories: categoria raiz deve ter level 1 (recebido %)', NEW."level";
          END IF;
        ELSE
          SELECT "level" INTO v_parent_level
            FROM "financial_categories"
           WHERE "tenant_id" = NEW."tenant_id" AND "id" = NEW."parent_id";
          IF v_parent_level IS NULL THEN
            RAISE EXCEPTION 'financial_categories: parent inexistente no tenant';
          END IF;
          IF NEW."level" <> v_parent_level + 1 THEN
            RAISE EXCEPTION 'financial_categories: level % incompatível com parent level %',
              NEW."level", v_parent_level;
          END IF;
        END IF;
        RETURN NEW;
      END $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_fincat_level_guard"
        BEFORE INSERT OR UPDATE OF "parent_id", "level" ON "financial_categories"
        FOR EACH ROW EXECUTE FUNCTION "fn_fincat_level_guard"()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ── Remove the new structure ───────────────────────────────────────────────
    await queryRunner.query(`DROP TRIGGER "trg_fincat_level_guard" ON "financial_categories"`);
    await queryRunner.query(`DROP FUNCTION "fn_fincat_level_guard"()`);
    await queryRunner.query(`DROP TABLE "financial_categories"`);
    await queryRunner.query(`DROP TABLE "financial_category_templates"`);

    // ── FULL restoration of the legacy module in the shape of that chain point ──
    // DDL transcribed from 20260526000002 (Enterprise), adjusted by 20260705000003:
    // D7 (rules without the flat columns) and D8 (junction without the center column).
    // No seeds, no data, no CASCADE.
    await queryRunner.query(`
      CREATE TABLE financial_categories (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id             UUID NOT NULL,
        parent_id             UUID,
        path                  TEXT NOT NULL,
        depth_level           INTEGER NOT NULL DEFAULT 0,
        tree_order            INTEGER NOT NULL DEFAULT 0,
        name                  VARCHAR(255) NOT NULL,
        slug                  VARCHAR(255) NOT NULL,
        code                  VARCHAR(80) NOT NULL,
        description           TEXT,
        color                 VARCHAR(40),
        icon                  VARCHAR(80),
        transaction_types     TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
        category_kind         VARCHAR(30) NOT NULL DEFAULT 'operational',
        system_category       BOOLEAN NOT NULL DEFAULT false,
        protected             BOOLEAN NOT NULL DEFAULT false,
        active                BOOLEAN NOT NULL DEFAULT true,
        archived              BOOLEAN NOT NULL DEFAULT false,
        allow_manual_usage    BOOLEAN NOT NULL DEFAULT true,
        allow_ai_suggestions  BOOLEAN NOT NULL DEFAULT true,
        usage_count           INTEGER NOT NULL DEFAULT 0,
        sort_order            INTEGER NOT NULL DEFAULT 0,
        metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_by            VARCHAR(255),
        updated_by            VARCHAR(255),
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at            TIMESTAMPTZ,
        CONSTRAINT chk_financial_categories_depth CHECK (depth_level >= 0),
        CONSTRAINT chk_financial_categories_kind CHECK (category_kind IN ('operational','managerial','accounting','tax','internal','automation','reporting')),
        CONSTRAINT chk_financial_categories_types CHECK (transaction_types <@ ARRAY['REVENUE','EXPENSE','INVESTMENT','TAX','TRANSFER']::TEXT[]),
        CONSTRAINT fk_financial_categories_parent FOREIGN KEY (parent_id) REFERENCES financial_categories(id) ON DELETE SET NULL
      );
      CREATE UNIQUE INDEX uq_financial_categories_slug_active ON financial_categories (tenant_id, slug) WHERE deleted_at IS NULL;
      CREATE UNIQUE INDEX uq_financial_categories_code_active ON financial_categories (tenant_id, code) WHERE deleted_at IS NULL;
      CREATE INDEX idx_financial_categories_parent_order ON financial_categories (tenant_id, parent_id, tree_order);
      CREATE INDEX idx_financial_categories_path ON financial_categories (tenant_id, path);
      CREATE INDEX idx_financial_categories_kind ON financial_categories (tenant_id, category_kind);
      CREATE INDEX idx_financial_categories_status ON financial_categories (tenant_id, active, archived, deleted_at);
      CREATE INDEX idx_financial_categories_types_gin ON financial_categories USING GIN (transaction_types);
      CREATE INDEX idx_financial_categories_metadata_gin ON financial_categories USING GIN (metadata)
    `);

    await queryRunner.query(`
      CREATE TABLE financial_category_centers (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id     UUID NOT NULL,
        category_id   UUID NOT NULL REFERENCES financial_categories(id) ON DELETE CASCADE,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_financial_category_centers_category ON financial_category_centers (tenant_id, category_id)
    `);

    await queryRunner.query(`
      CREATE TABLE financial_category_links (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       UUID NOT NULL,
        category_id     UUID NOT NULL REFERENCES financial_categories(id) ON DELETE CASCADE,
        entity_type     VARCHAR(80) NOT NULL,
        entity_id       UUID,
        entity_label    VARCHAR(255),
        relation_role   VARCHAR(40) NOT NULL,
        metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_by      VARCHAR(255),
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at      TIMESTAMPTZ,
        CONSTRAINT chk_financial_category_links_role CHECK (relation_role IN ('payable_to','receivable_from','vendor','customer','partner','beneficiary'))
      );
      CREATE INDEX idx_financial_category_links_category ON financial_category_links (tenant_id, category_id, deleted_at);
      CREATE INDEX idx_financial_category_links_entity ON financial_category_links (tenant_id, entity_type, entity_id, deleted_at);
      CREATE INDEX idx_financial_category_links_metadata_gin ON financial_category_links USING GIN (metadata)
    `);

    await queryRunner.query(`
      CREATE TABLE financial_category_favorites (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id     UUID NOT NULL,
        category_id   UUID NOT NULL REFERENCES financial_categories(id) ON DELETE CASCADE,
        user_id       VARCHAR(255) NOT NULL,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, category_id, user_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE financial_category_rules (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id           UUID NOT NULL,
        category_id         UUID REFERENCES financial_categories(id) ON DELETE SET NULL,
        name                VARCHAR(255) NOT NULL,
        description         TEXT,
        priority            INTEGER NOT NULL DEFAULT 100,
        active              BOOLEAN NOT NULL DEFAULT true,
        conditions          JSONB NOT NULL DEFAULT '{}'::jsonb,
        actions             JSONB NOT NULL DEFAULT '{}'::jsonb,
        last_triggered_at   TIMESTAMPTZ,
        trigger_count       INTEGER NOT NULL DEFAULT 0,
        created_by          VARCHAR(255),
        updated_by          VARCHAR(255),
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at          TIMESTAMPTZ
      );
      CREATE INDEX idx_financial_category_rules_active ON financial_category_rules (tenant_id, active, priority, deleted_at);
      CREATE INDEX idx_financial_category_rules_category ON financial_category_rules (tenant_id, category_id, deleted_at);
      CREATE INDEX idx_financial_category_rules_conditions_gin ON financial_category_rules USING GIN (conditions)
    `);

    await queryRunner.query(`
      CREATE TABLE financial_category_rule_runs (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id      UUID NOT NULL,
        rule_id        UUID REFERENCES financial_category_rules(id) ON DELETE SET NULL,
        category_id    UUID REFERENCES financial_categories(id) ON DELETE SET NULL,
        context        JSONB NOT NULL DEFAULT '{}'::jsonb,
        result         JSONB NOT NULL DEFAULT '{}'::jsonb,
        matched        BOOLEAN NOT NULL DEFAULT false,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_financial_category_rule_runs_rule ON financial_category_rule_runs (tenant_id, rule_id, created_at DESC)
    `);

    // RLS + harmonized policies (20260613000015) at this point of the chain.
    for (const table of [...FinancialCategories20260718000002.LEGACY_TABLES_REVERSE].reverse()) {
      await queryRunner.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
      await queryRunner.query(`
        CREATE POLICY tenant_isolation_${table} ON ${table}
          USING (tenant_id = private_get_tenant_id())
          WITH CHECK (tenant_id = private_get_tenant_id())
      `);
    }
  }
}
