import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000015_RenameNomePfNomeFantasiaOnClients
 *
 * Cluster D (naming-normalization mandate, `nome` -> semantic English
 * decomposition): clients.nome_pf (the individual/pessoa-física
 * contact's own legal name, used when tipo_pessoa === 'pessoa_fisica')
 * renamed to individual_name; clients.nome_fantasia (a company's trade
 * name / DBA, used when tipo_pessoa === 'pessoa_juridica') renamed to
 * trade_name. Both are plain varchar passthroughs, not covered by
 * ClientsService.mapClient() (only nome/tipo_pessoa/categoria/
 * endereco_completo are explicitly mapped there — these two pass
 * through the `...c` spread unmapped, same as razao_social).
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameNomePfNomeFantasiaOnClients20260918000015 implements MigrationInterface {
  name = 'RenameNomePfNomeFantasiaOnClients20260918000015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'clients' AND column_name = 'nome_pf'
        ) THEN
          ALTER TABLE "clients" RENAME COLUMN "nome_pf" TO "individual_name";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'clients' AND column_name = 'nome_fantasia'
        ) THEN
          ALTER TABLE "clients" RENAME COLUMN "nome_fantasia" TO "trade_name";
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'clients' AND column_name = 'trade_name'
        ) THEN
          ALTER TABLE "clients" RENAME COLUMN "trade_name" TO "nome_fantasia";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'clients' AND column_name = 'individual_name'
        ) THEN
          ALTER TABLE "clients" RENAME COLUMN "individual_name" TO "nome_pf";
        END IF;
      END $$;
    `);
  }
}
