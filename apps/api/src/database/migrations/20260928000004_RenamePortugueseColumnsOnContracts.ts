import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260928000004_RenamePortugueseColumnsOnContracts
 *
 * Technical-language mandate (technical = English, UX = PT-BR): the Portuguese
 * column names of the contract cluster.
 *
 *   contracts.arquivo_url             -> file_url
 *   contracts.exclusivo               -> exclusive
 *   contracts.versoes                 -> versions
 *   contract_templates.conteudo       -> content
 *   contract_templates.tipo_servico   -> service_type
 *   contract_templates.variaveis      -> variables   (contract_service_types already says variables)
 *   contract_service_types.conteudo   -> content
 *
 * contracts.versions holds the file version history the web writes; each
 * element's keys are renamed too:
 *   versao -> version, criado_em -> created_at, notas -> notes, autor -> author
 * (url unchanged). Array order is preserved (WITH ORDINALITY).
 *
 * No index, constraint, view, function or policy references the renamed
 * columns (checked against a freshly migrated catalog). Every step is guarded,
 * so the migration is idempotent, and down() restores the previous names and
 * element keys.
 */
const COLUMNS: ReadonlyArray<[table: string, from: string, to: string]> = [
  ['contracts', 'arquivo_url', 'file_url'],
  ['contracts', 'exclusivo', 'exclusive'],
  ['contracts', 'versoes', 'versions'],
  ['contract_templates', 'conteudo', 'content'],
  ['contract_templates', 'tipo_servico', 'service_type'],
  ['contract_templates', 'variaveis', 'variables'],
  ['contract_service_types', 'conteudo', 'content'],
];

const VERSION_KEYS: ReadonlyArray<[string, string]> = [
  ['versao', 'version'],
  ['criado_em', 'created_at'],
  ['notas', 'notes'],
  ['autor', 'author'],
];

function renameColumn(table: string, from: string, to: string): string {
  return `
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = '${table}' AND column_name = '${from}'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = '${table}' AND column_name = '${to}'
      ) THEN
        ALTER TABLE "${table}" RENAME COLUMN "${from}" TO "${to}";
      END IF;
    END $$;`;
}

/**
 * Renames keys inside every object element of a jsonb array column. An element
 * that already has the target key keeps it (the source key is dropped).
 */
function renameArrayElementKeys(table: string, column: string, pairs: ReadonlyArray<[string, string]>): string {
  let element = 'e.elem';
  for (const [from, to] of pairs) {
    element = `(CASE WHEN jsonb_typeof(${element}) = 'object' AND ${element} ? '${from}' THEN
        (CASE WHEN ${element} ? '${to}' THEN ${element} - '${from}'
              ELSE (${element} - '${from}') || jsonb_build_object('${to}', ${element} -> '${from}') END)
      ELSE ${element} END)`;
  }
  const sources = pairs.map(([from]) => `'${from}'`).join(', ');
  return `
    UPDATE "${table}" t
       SET "${column}" = (
         SELECT COALESCE(jsonb_agg(${element} ORDER BY e.ord), '[]'::jsonb)
           FROM jsonb_array_elements(t."${column}") WITH ORDINALITY AS e(elem, ord)
       )
     WHERE jsonb_typeof(t."${column}") = 'array'
       AND EXISTS (
         SELECT 1 FROM jsonb_array_elements(t."${column}") AS x(elem)
          WHERE jsonb_typeof(x.elem) = 'object' AND x.elem ?| ARRAY[${sources}]
       );`;
}

export class RenamePortugueseColumnsOnContracts20260928000004 implements MigrationInterface {
  name = 'RenamePortugueseColumnsOnContracts20260928000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [table, from, to] of COLUMNS) await queryRunner.query(renameColumn(table, from, to));
    await queryRunner.query(renameArrayElementKeys('contracts', 'versions', VERSION_KEYS));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(renameArrayElementKeys('contracts', 'versions', VERSION_KEYS.map(([a, b]) => [b, a])));
    for (const [table, from, to] of [...COLUMNS].reverse()) await queryRunner.query(renameColumn(table, to, from));
  }
}
