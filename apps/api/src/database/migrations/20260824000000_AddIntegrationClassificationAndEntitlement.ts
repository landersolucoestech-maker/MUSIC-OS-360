import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260824000000_AddIntegrationClassificationAndEntitlement
 *
 * Wave 2026-08-24: separates concepts that were collapsed in the catalog.
 *
 * ADDITIVE — nothing is deleted. The 4 reclassified providers keep their row,
 * credentials and history; they only stop being part of the commercial catalog.
 *
 * 1. `classification` — COMMERCIAL | INTERNAL_PLATFORM | PLATFORM_BILLING.
 *    "Future" is NOT a classification: it is COMMERCIAL + technical=planned +
 *    publication=coming_soon (e.g. ONErpm).
 *
 * 2. `technical_state` — the adapter's operational state, governable by the admin
 *    (planned…ready…retired). Distinct from the in-code capability (does an adapter exist?),
 *    which keeps vetoing a dishonest READY.
 *
 * 3. `publication_state` — goes from draft/published/retired to the real commercial
 *    rollout: hidden | coming_soon | beta | available |
 *    temporarily_unavailable.
 *
 * ENTITLEMENT IS NOT PART OF THIS: the list of integrations per plan lives in
 * `billing_plans.features.integrations` (the already existing canonical mechanism).
 * No entitlement table or column is created — the specification forbids a
 * second plans system.
 */
export class AddIntegrationClassificationAndEntitlement20260824000000 implements MigrationInterface {
  name = 'AddIntegrationClassificationAndEntitlement20260824000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "platform_integrations"
        ADD COLUMN IF NOT EXISTS "classification"  varchar(32) NOT NULL DEFAULT 'commercial',
        ADD COLUMN IF NOT EXISTS "technical_state" varchar(32) NOT NULL DEFAULT 'planned'
    `);

    // publication_state gains the commercial rollout vocabulary.
    await queryRunner.query(`
      ALTER TABLE "platform_integrations"
        DROP CONSTRAINT IF EXISTS "platform_integrations_publication_state_chk"
    `);
    await queryRunner.query(`
      UPDATE "platform_integrations" SET "publication_state" =
        CASE "publication_state"
          WHEN 'published' THEN 'available'
          WHEN 'draft'     THEN 'hidden'
          WHEN 'retired'   THEN 'hidden'
          ELSE "publication_state"
        END
    `);
    await queryRunner.query(`
      ALTER TABLE "platform_integrations"
        ALTER COLUMN "publication_state" SET DEFAULT 'hidden'
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='platform_integrations_classification_chk') THEN
          ALTER TABLE "platform_integrations" ADD CONSTRAINT "platform_integrations_classification_chk"
            CHECK ("classification" IN ('commercial','internal_platform','platform_billing'));
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='platform_integrations_technical_state_chk') THEN
          ALTER TABLE "platform_integrations" ADD CONSTRAINT "platform_integrations_technical_state_chk"
            CHECK ("technical_state" IN ('planned','in_development','configuring','awaiting_provider','homologating','ready','degraded','disabled','retired'));
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='platform_integrations_publication_state_chk2') THEN
          ALTER TABLE "platform_integrations" ADD CONSTRAINT "platform_integrations_publication_state_chk2"
            CHECK ("publication_state" IN ('hidden','coming_soon','beta','available','temporarily_unavailable'));
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_platform_integrations_classification"
        ON "platform_integrations" ("classification")
    `);

    // ── Category for distributors (new commercial providers) ────────────────────
    await queryRunner.query(`
      INSERT INTO "integration_categories" ("slug","name","display_order")
      VALUES ('distribution','Distribuição Digital',55)
      ON CONFLICT ("slug") DO NOTHING
    `);

    // ── B/E: reclassification (they keep their row, credentials and history) ───
    await queryRunner.query(`
      UPDATE "platform_integrations"
         SET "classification"='internal_platform', "technical_state"='ready',
             "publication_state"='hidden',
             "view_audience"='{"mode":"none","plans":[],"tenantIds":[]}'::jsonb,
             "use_audience" ='{"mode":"none","plans":[],"tenantIds":[]}'::jsonb,
             "updated_at"=now()
       WHERE "provider_key" IN ('soundcharts','acrcloud','resend')
    `);
    await queryRunner.query(`
      UPDATE "platform_integrations"
         SET "classification"='platform_billing', "technical_state"='ready',
             "publication_state"='hidden',
             "view_audience"='{"mode":"none","plans":[],"tenantIds":[]}'::jsonb,
             "use_audience" ='{"mode":"none","plans":[],"tenantIds":[]}'::jsonb,
             "updated_at"=now()
       WHERE "provider_key"='stripe'
    `);

    // ── C: honest technical state, by evidence of a real adapter ──────────────
    const technical: Array<[string, string, string]> = [
      // provider,        technical_state,      publication_state
      ['autentique',      'ready',              'available'],
      // DocuSign has a real adapter, but no live E2E proven against the account.
      ['docusign',        'homologating',       'beta'],
      ['abramus',         'ready',              'available'],
      ['google_ads',      'ready',              'available'],
      ['meta_business',   'ready',              'available'],
      ['whatsapp',        'ready',              'available'],
      // No adapter in apps/api/src — Connect must stay impossible.
      ['clicksign',       'awaiting_provider',  'coming_soon'],
      ['ubc',             'awaiting_provider',  'coming_soon'],
      ['ecad',            'awaiting_provider',  'coming_soon'],
      ['nfe',             'awaiting_provider',  'coming_soon'],
    ];
    for (const [key, tech, pub] of technical) {
      await queryRunner.query(
        `UPDATE "platform_integrations"
            SET "technical_state"=$1, "publication_state"=$2, "classification"='commercial', "updated_at"=now()
          WHERE "provider_key"=$3`,
        [tech, pub, key],
      );
    }

    // ── Commercial bootstrap: planned providers, still without an adapter ───────
    const bootstrap: Array<[string, string, string, string]> = [
      // provider_key,  name,                   category_slug,  connection_kind
      ['spotify_ads',   'Spotify Ads',          'marketing',    'oauth'],
      ['onerpm',        'ONErpm',               'distribution', 'tenant_credentials'],
      ['symphonic',     'Symphonic',            'distribution', 'tenant_credentials'],
      ['somvibe',       'SomVibe',              'distribution', 'tenant_credentials'],
      ['musicpro',      'MusicPRO',             'distribution', 'tenant_credentials'],
      ['distrokid',     'DistroKid',            'distribution', 'tenant_credentials'],
      ['soundon',       'SoundOn',              'distribution', 'tenant_credentials'],
    ];
    for (const [key, name, cat, kind] of bootstrap) {
      await queryRunner.query(
        `INSERT INTO "platform_integrations"
           ("provider_key","name","category_id","connection_kind","required_env",
            "publication_state","view_audience","use_audience","is_core",
            "classification","technical_state")
         VALUES ($1,$2,(SELECT "id" FROM "integration_categories" WHERE "slug"=$3),
                 $4,'[]'::jsonb,'coming_soon',
                 '{"mode":"all","plans":[],"tenantIds":[]}'::jsonb,
                 '{"mode":"none","plans":[],"tenantIds":[]}'::jsonb,
                 false,'commercial','planned')
         ON CONFLICT ("provider_key") DO NOTHING`,
        [key, name, cat, kind],
      );
    }

    // Commercial providers in coming_soon stay visible ("Em breve") — VIEW open,
    // USE closed. What vetoes Connect is technical_state, not the audience.
    await queryRunner.query(`
      UPDATE "platform_integrations"
         SET "view_audience"='{"mode":"all","plans":[],"tenantIds":[]}'::jsonb, "updated_at"=now()
       WHERE "classification"='commercial' AND "publication_state"='coming_soon'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "platform_integrations" WHERE "provider_key" IN
      ('spotify_ads','onerpm','symphonic','somvibe','musicpro','distrokid','soundon')`);
    await queryRunner.query(`ALTER TABLE "platform_integrations"
      DROP CONSTRAINT IF EXISTS "platform_integrations_publication_state_chk2",
      DROP CONSTRAINT IF EXISTS "platform_integrations_technical_state_chk",
      DROP CONSTRAINT IF EXISTS "platform_integrations_classification_chk"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_platform_integrations_classification"`);
    await queryRunner.query(`
      UPDATE "platform_integrations" SET "publication_state" =
        CASE "publication_state"
          WHEN 'available' THEN 'published'
          WHEN 'beta'      THEN 'published'
          ELSE 'draft'
        END
    `);
    await queryRunner.query(`ALTER TABLE "platform_integrations"
      ALTER COLUMN "publication_state" SET DEFAULT 'draft'`);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='platform_integrations_publication_state_chk') THEN
          ALTER TABLE "platform_integrations" ADD CONSTRAINT "platform_integrations_publication_state_chk"
            CHECK ("publication_state" IN ('draft','published','retired'));
        END IF;
      END $$;
    `);
    await queryRunner.query(`ALTER TABLE "platform_integrations"
      DROP COLUMN IF EXISTS "technical_state", DROP COLUMN IF EXISTS "classification"`);
  }
}
