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
const DEPARTMENTS: ReadonlyArray<[legacy: string, canonical: string, seededName: string]> = [
  ['diretoria', 'executive-board', 'Diretoria'],
  ['administrativo', 'administration', 'Administrativo'],
  ['financeiro', 'finance', 'Financeiro'],
  ['contabilidade', 'accounting', 'Contabilidade'],
  ['juridico', 'legal', 'Jurídico'],
  ['comercial', 'sales', 'Comercial'],
  ['catalogo', 'catalog', 'Catálogo'],
  ['operacoes', 'operations', 'Operações'],
  ['producao', 'production', 'Produção'],
  ['rh', 'human-resources', 'RH'],
  ['atendimento', 'customer-service', 'Atendimento'],
  ['tecnologia', 'technology', 'Tecnologia'],
];
const POSITIONS: ReadonlyArray<[legacy: string, canonical: string, seededName: string]> = [
  ['diretor-financeiro', 'finance-director', 'Diretor Financeiro'],
  ['gerente-financeiro', 'finance-manager', 'Gerente Financeiro'],
  ['analista-financeiro', 'financial-analyst', 'Analista Financeiro'],
  ['coordenador-marketing', 'marketing-coordinator', 'Coordenador de Marketing'],
  ['advogado', 'lawyer', 'Advogado'],
  ['gestor-catalogo', 'catalog-manager', 'Gestor de Catálogo'],
];
const JOB_FUNCTIONS: ReadonlyArray<[legacy: string, canonical: string, seededName: string]> = [
  ['editor-video', 'video-editor', 'Editor de Vídeo'],
  ['fotografo', 'photographer', 'Fotógrafo'],
  ['gestor-trafego', 'traffic-manager', 'Gestor de Tráfego'],
  ['produtor-musical', 'music-producer', 'Produtor Musical'],
  ['curador', 'curator', 'Curador'],
];
const JOB_FUNCTION_CATEGORIES: ReadonlyArray<[legacy: string, canonical: string]> = [
  ['criacao', 'creative'],
  ['producao', 'production'],
];

/**
 * up(): every live row with the legacy slug (unless the tenant already has the
 * canonical one). down(): only rows that still carry the seeded default name, so a
 * tenant's own `finance`/`legal`/... row created after up() is never renamed.
 */
function renameSlug(table: string, from: string, to: string, seededName: string | null): [string, string[]] {
  const nameGuard = seededName === null ? '' : ' AND t."name" = $3';
  return [
    `UPDATE "${table}" t SET "slug" = $2
     WHERE t."slug" = $1 AND t."deleted_at" IS NULL${nameGuard}
       AND NOT EXISTS (
         SELECT 1 FROM "${table}" o WHERE o."tenant_id" = t."tenant_id" AND o."slug" = $2 AND o."deleted_at" IS NULL
       )`,
    seededName === null ? [from, to] : [from, to, seededName],
  ];
}

/** Job-function slugs seeded by seed 05 (canonical spelling): their category is the seeded one. */
const SEEDED_JOB_FUNCTION_SLUGS = ['designer', 'videomaker', 'motion-designer', 'social-media', 'anr', ...JOB_FUNCTIONS.map(([, canonical]) => canonical)];

async function apply(queryRunner: QueryRunner, reverse: boolean): Promise<void> {
  await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
  for (const [table, entries] of [
    ['departments', DEPARTMENTS],
    ['positions', POSITIONS],
    ['job_functions', JOB_FUNCTIONS],
  ] as const) {
    for (const [legacy, canonical, seededName] of entries) {
      await queryRunner.query(...(reverse
        ? renameSlug(table, canonical, legacy, seededName)
        : renameSlug(table, legacy, canonical, null)));
    }
  }
  for (const [legacy, canonical] of JOB_FUNCTION_CATEGORIES) {
    if (reverse) {
      // Categories go back only on seeded job functions (slugs already reverted above or kept).
      const seeded = [...SEEDED_JOB_FUNCTION_SLUGS, ...JOB_FUNCTIONS.map(([l]) => l)];
      await queryRunner.query(`UPDATE "job_functions" SET "category" = $2 WHERE "category" = $1 AND "slug" = ANY($3)`, [canonical, legacy, seeded]);
    } else {
      await queryRunner.query(`UPDATE "job_functions" SET "category" = $2 WHERE "category" = $1`, [legacy, canonical]);
    }
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
