import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260928000015_CanonicalizeSharesToEnglish
 *
 * Technical-language mandate (technical = English, UX = PT-BR) for `shares`
 * (CZ-037), and the fix of a broken status contract.
 *
 * Columns: artista_externo -> external_artist_name, pagador -> payer,
 *   pagador_contato -> payer_contact, origem_acordo -> agreement_source,
 *   data_prevista -> expected_at, acordo_notas -> agreement_notes,
 *   acordo_url -> agreement_url, versao -> version, historico -> history.
 * artista_project_id duplicated artist_id (the web wrote the same value to
 *   both): artist_id is backfilled from it where empty (forward-only, no data
 *   loss) and the mirror becomes legacy_artist_project_id (no longer written;
 *   canonical map blocker for dropping it).
 * Constraint chk_shares_percentual_range -> chk_shares_percentage_range.
 *
 * Status: the financial share form used Portuguese statuses (pendente,
 *   parcial, enviado, ...) that chk_shares_status rejected, so every financial share
 *   save failed. ShareStatus gains the financial lifecycle in English
 *   (partial, sent, accepted, received, refused, error, cancelled) and the CHECK is
 *   recreated with the full set; any legacy PT value is mapped first.
 * Values (PT-BR labels live in the web UI):
 *   direction: a_receber -> receivable, a_enviar -> payable
 *   party_role: autor -> author, compositor -> composer, interprete ->
 *     performer, produtor -> producer, editora -> publisher; default 'author'
 *   type (participant function): compositor -> composer, interprete ->
 *     performer, produtor -> producer, editora -> publisher, gravadora ->
 *     record_label, empresario -> manager, outro -> other
 *
 * history[] entry keys (append-only audit trail written by the web):
 *   versao -> version, data -> date, autor -> author, descricao -> description,
 *   acao -> action, usuario -> user, observacao -> note,
 *   valor_anterior -> previous_value, valor_novo -> new_value.
 *   `percentual` inside old entries stays (already classified DADO_HISTORICO;
 *   readers fall back to it).
 *
 * No index, view, function or policy references the renamed columns (checked
 * against a freshly migrated catalog). Every step is guarded, so the migration
 * is idempotent; down() reverses every step except the artist_id backfill.
 */
const COLUMNS: ReadonlyArray<[from: string, to: string]> = [
  ['artista_externo', 'external_artist_name'],
  ['artista_project_id', 'legacy_artist_project_id'],
  ['pagador', 'payer'],
  ['pagador_contato', 'payer_contact'],
  ['origem_acordo', 'agreement_source'],
  ['data_prevista', 'expected_at'],
  ['acordo_notas', 'agreement_notes'],
  ['acordo_url', 'agreement_url'],
  ['versao', 'version'],
  ['historico', 'history'],
];

const LEGACY_STATUSES = ['active', 'inactive', 'pending', 'settled'];
const STATUSES = [...LEGACY_STATUSES, 'partial', 'sent', 'accepted', 'received', 'refused', 'error', 'cancelled'];

const VALUES: ReadonlyArray<[column: string, legacy: string, canonical: string]> = [
  ['status', 'pendente', 'pending'],
  ['status', 'parcial', 'partial'],
  ['status', 'enviado', 'sent'],
  ['status', 'aceito', 'accepted'],
  ['status', 'recebido', 'received'],
  ['status', 'recusado', 'refused'],
  ['status', 'erro', 'error'],
  ['status', 'cancelado', 'cancelled'],
  ['direction', 'a_receber', 'receivable'],
  ['direction', 'a_enviar', 'payable'],
  ['party_role', 'autor', 'author'],
  ['party_role', 'compositor', 'composer'],
  ['party_role', 'interprete', 'performer'],
  ['party_role', 'produtor', 'producer'],
  ['party_role', 'editora', 'publisher'],
  ['type', 'compositor', 'composer'],
  ['type', 'interprete', 'performer'],
  ['type', 'produtor', 'producer'],
  ['type', 'editora', 'publisher'],
  ['type', 'gravadora', 'record_label'],
  ['type', 'empresario', 'manager'],
  ['type', 'outro', 'other'],
];

const HISTORY_KEYS: ReadonlyArray<[legacy: string, canonical: string]> = [
  ['versao', 'version'],
  ['data', 'date'],
  ['autor', 'author'],
  ['descricao', 'description'],
  ['acao', 'action'],
  ['usuario', 'user'],
  ['observacao', 'note'],
  ['valor_anterior', 'previous_value'],
  ['valor_novo', 'new_value'],
];

/** Renames the keys of every object entry of shares.history (order preserved). */
function remapHistoryKeys(pairs: ReadonlyArray<[from: string, to: string]>): string {
  const mapping = pairs.map(([from, to]) => `('${from}', '${to}')`).join(', ');
  return `
    UPDATE "shares" s SET "history" = (
      SELECT jsonb_agg(
        CASE WHEN jsonb_typeof(e.elem) = 'object' THEN (
          SELECT COALESCE(jsonb_object_agg(COALESCE(m.to_key, kv.key), kv.value), '{}'::jsonb)
          FROM jsonb_each(e.elem) AS kv
          LEFT JOIN (VALUES ${mapping}) AS m(from_key, to_key) ON m.from_key = kv.key
        ) ELSE e.elem END
        ORDER BY e.ord)
      FROM jsonb_array_elements(s."history") WITH ORDINALITY AS e(elem, ord)
    )
    WHERE jsonb_typeof(s."history") = 'array' AND jsonb_array_length(s."history") > 0`;
}

function renameColumn(from: string, to: string): string {
  return `
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'shares' AND column_name = '${from}'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'shares' AND column_name = '${to}'
      ) THEN
        ALTER TABLE "shares" RENAME COLUMN "${from}" TO "${to}";
      END IF;
    END $$;`;
}

function renameConstraint(from: string, to: string): string {
  return `
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.shares'::regclass AND conname = '${from}')
         AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.shares'::regclass AND conname = '${to}') THEN
        ALTER TABLE "shares" RENAME CONSTRAINT "${from}" TO "${to}";
      END IF;
    END $$;`;
}

async function replaceStatusCheck(q: QueryRunner, values: string[]): Promise<void> {
  await q.query(`ALTER TABLE "shares" DROP CONSTRAINT IF EXISTS "chk_shares_status"`);
  await q.query(
    `ALTER TABLE "shares" ADD CONSTRAINT "chk_shares_status" CHECK ("status" IN (${values.map((v) => `'${v}'`).join(', ')}))`,
  );
}

export class CanonicalizeSharesToEnglish20260928000015 implements MigrationInterface {
  name = 'CanonicalizeSharesToEnglish20260928000015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'shares' AND column_name = 'artista_project_id'
        ) THEN
          UPDATE "shares" SET "artist_id" = "artista_project_id"
           WHERE "artist_id" IS NULL AND "artista_project_id" IS NOT NULL;
        END IF;
      END $$;`);
    for (const [from, to] of COLUMNS) await queryRunner.query(renameColumn(from, to));
    await queryRunner.query(renameConstraint('chk_shares_percentual_range', 'chk_shares_percentage_range'));

    await queryRunner.query(`ALTER TABLE "shares" DROP CONSTRAINT IF EXISTS "chk_shares_status"`);
    for (const [column, legacy, canonical] of VALUES) {
      await queryRunner.query(`UPDATE "shares" SET "${column}" = $1 WHERE "${column}" = $2`, [canonical, legacy]);
    }
    await replaceStatusCheck(queryRunner, STATUSES);
    await queryRunner.query(`ALTER TABLE "shares" ALTER COLUMN "party_role" SET DEFAULT 'author'`);
    await queryRunner.query(remapHistoryKeys(HISTORY_KEYS));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(remapHistoryKeys(HISTORY_KEYS.map(([legacy, canonical]) => [canonical, legacy])));
    await queryRunner.query(`ALTER TABLE "shares" ALTER COLUMN "party_role" SET DEFAULT 'autor'`);
    await queryRunner.query(`ALTER TABLE "shares" DROP CONSTRAINT IF EXISTS "chk_shares_status"`);
    for (const [column, legacy, canonical] of VALUES) {
      if (column === 'status') continue;
      await queryRunner.query(`UPDATE "shares" SET "${column}" = $1 WHERE "${column}" = $2`, [legacy, canonical]);
    }
    // The financial statuses never existed before this migration (the old CHECK
    // rejected them); they fall back to 'pending' so the old CHECK can be restored.
    await queryRunner.query(`UPDATE "shares" SET "status" = 'pending' WHERE "status" <> ALL($1::text[])`, [LEGACY_STATUSES]);
    await replaceStatusCheck(queryRunner, LEGACY_STATUSES);
    await queryRunner.query(renameConstraint('chk_shares_percentage_range', 'chk_shares_percentual_range'));
    for (const [from, to] of [...COLUMNS].reverse()) await queryRunner.query(renameColumn(to, from));
  }
}
