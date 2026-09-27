import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Registry (ABRAMUS/ECAD) — Phase 2: rights_holders + external_identifiers.
 *
 * Creates two NEW tables (no existing table touched/renamed) and runs a
 * best-effort, idempotent backfill: builds rights_holders from the existing
 * free-text `shares.titular_*` (only where a document number exists, deduped by
 * tenant + document) and links `shares.rights_holder_id`. Non-destructive — it
 * only fills the nullable column added in Phase 1; the snapshot `titular_nome`
 * stays untouched.
 *
 * `down()` unlinks the backfilled holders and drops the two tables.
 */
export class RegistryRightsHoldersIdentifiers20260601000002 implements MigrationInterface {
  name = 'RegistryRightsHoldersIdentifiers20260601000002';

  async up(qr: QueryRunner): Promise<void> {
    // ── rights_holders ───────────────────────────────────────────────────────
    await qr.query(`
      CREATE TABLE IF NOT EXISTS rights_holders (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id           UUID NOT NULL,
        legal_name          VARCHAR(255) NOT NULL,
        artistic_name       VARCHAR(255),
        document_type       VARCHAR(20),
        document_number     VARCHAR(30),
        email_encrypted     TEXT,
        phone_encrypted     TEXT,
        country             VARCHAR(2),
        ipi_cae             VARCHAR(20),
        society             VARCHAR(50),
        society_member_code VARCHAR(100),
        holder_type         VARCHAR(50) NOT NULL DEFAULT 'OTHER',
        metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),
        deleted_at          TIMESTAMP,
        created_by          VARCHAR(255),
        updated_by          VARCHAR(255),
        CONSTRAINT chk_rights_holders_holder_type CHECK (
          holder_type IN ('AUTHOR','COMPOSER','PUBLISHER','INTERPRETER','MUSICIAN',
            'PHONOGRAPHIC_PRODUCER','LABEL','ARRANGER','ADAPTER','TRANSLATOR','OTHER')
        )
      );
      CREATE INDEX IF NOT EXISTS idx_rights_holders_tenant ON rights_holders (tenant_id);
      CREATE INDEX IF NOT EXISTS idx_rights_holders_type   ON rights_holders (tenant_id, holder_type);
      CREATE UNIQUE INDEX IF NOT EXISTS uq_rights_holders_tenant_doc
        ON rights_holders (tenant_id, document_number)
        WHERE document_number IS NOT NULL AND deleted_at IS NULL;
    `);

    // ── external_identifiers ─────────────────────────────────────────────────
    await qr.query(`
      CREATE TABLE IF NOT EXISTS external_identifiers (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id        UUID NOT NULL,
        entity_type      VARCHAR(30) NOT NULL,
        entity_id        UUID NOT NULL,
        provider         VARCHAR(30) NOT NULL,
        identifier_type  VARCHAR(40) NOT NULL,
        identifier_value VARCHAR(100) NOT NULL,
        is_primary       BOOLEAN NOT NULL DEFAULT FALSE,
        metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMP NOT NULL DEFAULT NOW(),
        created_by       VARCHAR(255),
        CONSTRAINT chk_ext_id_entity_type CHECK (
          entity_type IN ('WORK','RECORDING','RIGHTS_HOLDER','RELEASE','SUBMISSION')
        ),
        CONSTRAINT chk_ext_id_provider CHECK (
          provider IN ('ABRAMUS','ECAD','CISAC','IFPI','PRO_MUSICA','ISRC','INTERNAL','OTHER')
        ),
        CONSTRAINT chk_ext_id_type CHECK (
          identifier_type IN ('ISWC','ISRC','IPI_CAE','ECAD_WORK_CODE','ABRAMUS_PROTOCOL',
            'SOCIETY_MEMBER_CODE','CATALOG_NUMBER','UPC','EAN','OTHER')
        )
      );
      CREATE INDEX IF NOT EXISTS idx_ext_id_tenant ON external_identifiers (tenant_id);
      CREATE INDEX IF NOT EXISTS idx_ext_id_entity ON external_identifiers (tenant_id, entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_ext_id_type   ON external_identifiers (tenant_id, identifier_type);
      -- ISRC unique per tenant
      CREATE UNIQUE INDEX IF NOT EXISTS uq_ext_id_isrc
        ON external_identifiers (tenant_id, identifier_value)
        WHERE identifier_type = 'ISRC';
      -- do not duplicate the same identifier on the same entity
      CREATE UNIQUE INDEX IF NOT EXISTS uq_ext_id_entity_value
        ON external_identifiers (tenant_id, entity_type, entity_id, identifier_type, identifier_value);
    `);

    // ── Best-effort backfill of rights_holders from shares.titular_* ─────────
    // Only where a document number exists (deduped per tenant+document).
    await qr.query(`
      INSERT INTO rights_holders (tenant_id, legal_name, document_number, holder_type, metadata)
      SELECT DISTINCT ON (s.tenant_id, s.titular_doc)
             s.tenant_id,
             COALESCE(NULLIF(TRIM(s.titular_nome), ''), 'Titular') AS legal_name,
             s.titular_doc,
             'OTHER',
             jsonb_build_object('backfilled_from', 'shares')
      FROM shares s
      WHERE s.titular_doc IS NOT NULL
        AND TRIM(s.titular_doc) <> ''
        AND NOT EXISTS (
          SELECT 1 FROM rights_holders rh
          WHERE rh.tenant_id = s.tenant_id AND rh.document_number = s.titular_doc
        )
      ORDER BY s.tenant_id, s.titular_doc, s.created_at;
    `);

    await qr.query(`
      UPDATE shares s
      SET rights_holder_id = rh.id
      FROM rights_holders rh
      WHERE s.rights_holder_id IS NULL
        AND s.titular_doc IS NOT NULL
        AND TRIM(s.titular_doc) <> ''
        AND rh.tenant_id = s.tenant_id
        AND rh.document_number = s.titular_doc;
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    // Unlink backfilled holders before dropping (column itself belongs to Phase 1).
    await qr.query(`
      UPDATE shares
      SET rights_holder_id = NULL
      WHERE rights_holder_id IN (
        SELECT id FROM rights_holders WHERE metadata->>'backfilled_from' = 'shares'
      );
    `);
    await qr.query(`DROP TABLE IF EXISTS external_identifiers;`);
    await qr.query(`DROP TABLE IF EXISTS rights_holders;`);
  }
}
