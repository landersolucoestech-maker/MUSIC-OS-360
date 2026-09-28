import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260928000013_CanonicalizeLicensesToEnglish
 *
 * Technical-language mandate (technical = English, UX = PT-BR) for `licenses`
 * (CZ-035):
 *
 *   obra_musical -> work_title, artista -> artist_name, cliente -> client_name,
 *   projeto -> project_name, tipo_uso -> usage_type, midia_destino -> target_media,
 *   territorio -> territory, valor -> amount, moeda -> currency
 *
 * Persisted values (the form stored slugified PT-BR labels; PT-BR labels live
 * in the web UI now):
 *   status: ativa -> active, negociacao -> negotiation, proposta -> proposal,
 *     expirada -> expired, pendente -> pending (column default 'pending')
 *   type: sync_publicidade -> sync_advertising, mecânica/mecanica -> mechanical
 *   target_media: tv_aberta -> free_tv, tv_fechada -> pay_tv,
 *     redes_sociais -> social_media, publicidade_digital -> digital_advertising,
 *     outro -> other
 *   territory: brasil -> brazil, américa_latina -> latin_america,
 *     mundial -> worldwide, estados_unidos -> united_states, europa -> europe,
 *     ásia -> asia
 *
 * No index, view, function or policy references the renamed columns (checked
 * against a freshly migrated catalog). Every step is guarded, so the migration
 * is idempotent; down() restores the previous names, the values the form
 * generated (slugified labels, accents included) and the default.
 */
const COLUMNS: ReadonlyArray<[from: string, to: string]> = [
  ['obra_musical', 'work_title'],
  ['artista', 'artist_name'],
  ['cliente', 'client_name'],
  ['projeto', 'project_name'],
  ['tipo_uso', 'usage_type'],
  ['midia_destino', 'target_media'],
  ['territorio', 'territory'],
  ['valor', 'amount'],
  ['moeda', 'currency'],
];

const VALUES: ReadonlyArray<[column: string, legacy: string[], canonical: string, down: string]> = [
  ['status', ['ativa'], 'active', 'ativa'],
  ['status', ['negociacao'], 'negotiation', 'negociacao'],
  ['status', ['proposta'], 'proposal', 'proposta'],
  ['status', ['expirada'], 'expired', 'expirada'],
  ['status', ['pendente'], 'pending', 'pendente'],
  ['type', ['sync_publicidade'], 'sync_advertising', 'sync_publicidade'],
  ['type', ['mecânica', 'mecanica'], 'mechanical', 'mecânica'],
  ['target_media', ['tv_aberta'], 'free_tv', 'tv_aberta'],
  ['target_media', ['tv_fechada'], 'pay_tv', 'tv_fechada'],
  ['target_media', ['redes_sociais'], 'social_media', 'redes_sociais'],
  ['target_media', ['publicidade_digital'], 'digital_advertising', 'publicidade_digital'],
  ['target_media', ['outro'], 'other', 'outro'],
  ['territory', ['brasil'], 'brazil', 'brasil'],
  ['territory', ['américa_latina', 'america_latina'], 'latin_america', 'américa_latina'],
  ['territory', ['mundial'], 'worldwide', 'mundial'],
  ['territory', ['estados_unidos'], 'united_states', 'estados_unidos'],
  ['territory', ['europa'], 'europe', 'europa'],
  ['territory', ['ásia'], 'asia', 'ásia'],
];

function renameColumn(from: string, to: string): string {
  return `
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'licenses' AND column_name = '${from}'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'licenses' AND column_name = '${to}'
      ) THEN
        ALTER TABLE "licenses" RENAME COLUMN "${from}" TO "${to}";
      END IF;
    END $$;`;
}

export class CanonicalizeLicensesToEnglish20260928000013 implements MigrationInterface {
  name = 'CanonicalizeLicensesToEnglish20260928000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [from, to] of COLUMNS) await queryRunner.query(renameColumn(from, to));
    for (const [column, legacy, canonical] of VALUES) {
      await queryRunner.query(`UPDATE "licenses" SET "${column}" = $1 WHERE "${column}" = ANY($2::text[])`, [canonical, legacy]);
    }
    await queryRunner.query(`ALTER TABLE "licenses" ALTER COLUMN "status" SET DEFAULT 'pending'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "licenses" ALTER COLUMN "status" SET DEFAULT 'pendente'`);
    for (const [column, , canonical, down] of VALUES) {
      await queryRunner.query(`UPDATE "licenses" SET "${column}" = $1 WHERE "${column}" = $2`, [down, canonical]);
    }
    for (const [from, to] of [...COLUMNS].reverse()) await queryRunner.query(renameColumn(to, from));
  }
}
