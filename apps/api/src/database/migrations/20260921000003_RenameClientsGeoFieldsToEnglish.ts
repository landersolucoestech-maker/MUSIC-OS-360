import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Naming-closure Cluster D audit: clients.cidade/estado are live, DTO-exposed
 * columns (2/21 and 1/21 non-null on DEV at authoring time) already reached
 * via an English CreateClientDto/UpdateClientDto boundary (city/state) --
 * ClientsService.normalizeClientPayload() manually translated city->cidade,
 * state->estado on every write. Renames the physical columns to match the
 * DTO directly, eliminating that translation step. Plain rename, no data
 * transformation (free-text city name, 2-letter UF code -- neither needs
 * value conversion).
 *
 * clients has no `pais`/country column at all (verified against the live
 * entity) -- only leads does, handled by the sibling migration
 * 20260921000004_RenameLeadsGeoFieldsToEnglish.
 */
export class RenameClientsGeoFieldsToEnglish20260921000003 implements MigrationInterface {
  name = 'RenameClientsGeoFieldsToEnglish20260921000003';

  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'cidade'
        ) THEN
          ALTER TABLE "clients" RENAME COLUMN "cidade" TO "city";
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'estado'
        ) THEN
          ALTER TABLE "clients" RENAME COLUMN "estado" TO "state";
        END IF;
      END $$;
    `);
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'city'
        ) THEN
          ALTER TABLE "clients" RENAME COLUMN "city" TO "cidade";
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'state'
        ) THEN
          ALTER TABLE "clients" RENAME COLUMN "state" TO "estado";
        END IF;
      END $$;
    `);
  }
}
