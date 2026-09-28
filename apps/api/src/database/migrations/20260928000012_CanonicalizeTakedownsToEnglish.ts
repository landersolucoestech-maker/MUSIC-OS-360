import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260928000012_CanonicalizeTakedownsToEnglish
 *
 * Technical-language mandate (technical = English, UX = PT-BR) for
 * `takedowns` (CZ-034):
 *
 *   plataforma -> platform, motivo -> reason, resposta -> response,
 *   obra_afetada -> affected_work, artista -> artist_name,
 *   prioridade -> priority, url_infracao -> infringing_url,
 *   evidencias -> evidence, data_identificacao -> identified_at
 *
 * Persisted values (PT-BR labels live in the web UI):
 *   type: enviado -> sent, recebido -> received
 *   priority: alta -> high, media -> medium, baixa -> low
 * (`status` is already English and CHECK-constrained.)
 *
 * No index, view, function or policy references the renamed columns (checked
 * against a freshly migrated catalog). Every step is guarded, so the migration
 * is idempotent; down() restores the previous names and values.
 */
const COLUMNS: ReadonlyArray<[from: string, to: string]> = [
  ['plataforma', 'platform'],
  ['motivo', 'reason'],
  ['resposta', 'response'],
  ['obra_afetada', 'affected_work'],
  ['artista', 'artist_name'],
  ['prioridade', 'priority'],
  ['url_infracao', 'infringing_url'],
  ['evidencias', 'evidence'],
  ['data_identificacao', 'identified_at'],
];

const VALUES: ReadonlyArray<[column: string, legacy: string, canonical: string]> = [
  ['type', 'enviado', 'sent'],
  ['type', 'recebido', 'received'],
  ['priority', 'alta', 'high'],
  ['priority', 'media', 'medium'],
  ['priority', 'baixa', 'low'],
];

function renameColumn(from: string, to: string): string {
  return `
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'takedowns' AND column_name = '${from}'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'takedowns' AND column_name = '${to}'
      ) THEN
        ALTER TABLE "takedowns" RENAME COLUMN "${from}" TO "${to}";
      END IF;
    END $$;`;
}

export class CanonicalizeTakedownsToEnglish20260928000012 implements MigrationInterface {
  name = 'CanonicalizeTakedownsToEnglish20260928000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [from, to] of COLUMNS) await queryRunner.query(renameColumn(from, to));
    for (const [column, legacy, canonical] of VALUES) {
      await queryRunner.query(`UPDATE "takedowns" SET "${column}" = $1 WHERE "${column}" = $2`, [canonical, legacy]);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [column, legacy, canonical] of VALUES) {
      await queryRunner.query(`UPDATE "takedowns" SET "${column}" = $1 WHERE "${column}" = $2`, [legacy, canonical]);
    }
    for (const [from, to] of [...COLUMNS].reverse()) await queryRunner.query(renameColumn(to, from));
  }
}
