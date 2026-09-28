import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260928000025_RenameOrgStructureSlugsToEnglish
 *
 * Technical-language mandate (technical = English, UX = PT-BR): the default
 * org-chart slugs seeded per tenant (seed 05) were Portuguese. `slug` is a
 * technical identifier (the PT-BR text lives in `name`); nothing in the API or
 * web reads these slugs (the org chart grants no permission — seed 05 header).
 *
 * Renames departments / positions / job_functions slugs and job_functions
 * category values. A slug is renamed only when the tenant has no live row with
 * the target slug (uq_*_tenant_slug), so the migration never violates the
 * unique index; down() reverses under the same guard. Guarded and reversible.
 */
const DEPARTMENTS: ReadonlyArray<[legacy: string, canonical: string]> = [
  ['diretoria', 'executive-board'],
  ['administrativo', 'administration'],
  ['financeiro', 'finance'],
  ['contabilidade', 'accounting'],
  ['juridico', 'legal'],
  ['comercial', 'sales'],
  ['catalogo', 'catalog'],
  ['operacoes', 'operations'],
  ['producao', 'production'],
  ['rh', 'human-resources'],
  ['atendimento', 'customer-service'],
  ['tecnologia', 'technology'],
];
const POSITIONS: ReadonlyArray<[legacy: string, canonical: string]> = [
  ['diretor-financeiro', 'finance-director'],
  ['gerente-financeiro', 'finance-manager'],
  ['analista-financeiro', 'financial-analyst'],
  ['coordenador-marketing', 'marketing-coordinator'],
  ['advogado', 'lawyer'],
  ['gestor-catalogo', 'catalog-manager'],
];
const JOB_FUNCTIONS: ReadonlyArray<[legacy: string, canonical: string]> = [
  ['editor-video', 'video-editor'],
  ['fotografo', 'photographer'],
  ['gestor-trafego', 'traffic-manager'],
  ['produtor-musical', 'music-producer'],
  ['curador', 'curator'],
];
const JOB_FUNCTION_CATEGORIES: ReadonlyArray<[legacy: string, canonical: string]> = [
  ['criacao', 'creative'],
  ['producao', 'production'],
];

function renameSlug(table: string, from: string, to: string): [string, string[]] {
  return [
    `UPDATE "${table}" t SET "slug" = $2
     WHERE t."slug" = $1 AND t."deleted_at" IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM "${table}" o WHERE o."tenant_id" = t."tenant_id" AND o."slug" = $2 AND o."deleted_at" IS NULL
       )`,
    [from, to],
  ];
}

async function apply(queryRunner: QueryRunner, reverse: boolean): Promise<void> {
  await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
  const pick = ([legacy, canonical]: readonly [string, string]): [string, string] =>
    reverse ? [canonical, legacy] : [legacy, canonical];
  for (const [table, pairs] of [
    ['departments', DEPARTMENTS],
    ['positions', POSITIONS],
    ['job_functions', JOB_FUNCTIONS],
  ] as const) {
    for (const pair of pairs) {
      const [from, to] = pick(pair);
      await queryRunner.query(...renameSlug(table, from, to));
    }
  }
  for (const pair of JOB_FUNCTION_CATEGORIES) {
    const [from, to] = pick(pair);
    await queryRunner.query(`UPDATE "job_functions" SET "category" = $2 WHERE "category" = $1`, [from, to]);
  }
}

export class RenameOrgStructureSlugsToEnglish20260928000025 implements MigrationInterface {
  name = 'RenameOrgStructureSlugsToEnglish20260928000025';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await apply(queryRunner, false);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await apply(queryRunner, true);
  }
}
