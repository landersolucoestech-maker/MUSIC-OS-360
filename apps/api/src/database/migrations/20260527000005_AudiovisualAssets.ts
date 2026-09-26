import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Audiovisual Assets — the project's file library.
 *
 * Unlike deliverables (which are final deliveries to the client), assets are:
 *   - visual references
 *   - location photos
 *   - BTS (backstage)
 *   - moodboards
 *   - inspirations
 *   - documents
 *
 * The upload itself is done by the client directly to the storage provider
 * (Supabase/R2/S3). This table only stores metadata + the final URL.
 */
export class AudiovisualAssets20260527000005 implements MigrationInterface {
  name = 'AudiovisualAssets20260527000005';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS audiovisual_assets (
        id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id                UUID NOT NULL,
        audiovisual_project_id   UUID NOT NULL,
        name                     VARCHAR(500) NOT NULL,
        kind                     VARCHAR(30) NOT NULL DEFAULT 'other',
        file_url                 TEXT NOT NULL,
        thumbnail_url            TEXT,
        mime_type                VARCHAR(100),
        size_bytes               BIGINT,
        description              TEXT,
        tags                     JSONB NOT NULL DEFAULT '[]'::jsonb,
        metadata                 JSONB NOT NULL DEFAULT '{}'::jsonb,
        uploaded_by              VARCHAR(255),
        created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at               TIMESTAMPTZ,
        CONSTRAINT chk_av_assets_kind CHECK (
          kind IN ('reference','bts','inspiration','moodboard','location_photo','document','raw_footage','other')
        )
      );
      CREATE INDEX IF NOT EXISTS idx_av_assets_tenant  ON audiovisual_assets (tenant_id);
      CREATE INDEX IF NOT EXISTS idx_av_assets_project ON audiovisual_assets (tenant_id, audiovisual_project_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_av_assets_kind    ON audiovisual_assets (tenant_id, kind);
      CREATE INDEX IF NOT EXISTS idx_av_assets_deleted ON audiovisual_assets (tenant_id, deleted_at);
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS audiovisual_assets;`);
  }
}
