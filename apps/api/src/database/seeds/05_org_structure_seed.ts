/**
 * seeds/05_org_structure_seed.ts  (PHASE 8 — Org chart)
 *
 * Creates, PER TENANT, the default org chart: departments, positions, job_functions.
 * Idempotent per (tenant_id, slug). Accented PT-BR display names.
 *
 * SECURITY: none of these grants permission — there is no FK to role/permission.
 * Only role_permissions grants access (seed 04).
 */
import { DataSource } from 'typeorm';

const DEPARTMENTS: Array<{ slug: string; name: string }> = [
  { slug: 'diretoria', name: 'Diretoria' },
  { slug: 'administrativo', name: 'Administrativo' },
  { slug: 'financeiro', name: 'Financeiro' },
  { slug: 'contabilidade', name: 'Contabilidade' },
  { slug: 'juridico', name: 'Jurídico' },
  { slug: 'marketing', name: 'Marketing' },
  { slug: 'comercial', name: 'Comercial' },
  { slug: 'catalogo', name: 'Catálogo' },
  { slug: 'anr', name: 'A&R' },
  { slug: 'operacoes', name: 'Operações' },
  { slug: 'producao', name: 'Produção' },
  { slug: 'audiovisual', name: 'Audiovisual' },
  { slug: 'rh', name: 'RH' },
  { slug: 'atendimento', name: 'Atendimento' },
  { slug: 'tecnologia', name: 'Tecnologia' },
];

/** Default positions; departmentSlug links to the department when applicable. */
const POSITIONS: Array<{ slug: string; name: string; departmentSlug: string | null }> = [
  { slug: 'diretor-financeiro', name: 'Diretor Financeiro', departmentSlug: 'financeiro' },
  { slug: 'gerente-financeiro', name: 'Gerente Financeiro', departmentSlug: 'financeiro' },
  { slug: 'analista-financeiro', name: 'Analista Financeiro', departmentSlug: 'financeiro' },
  { slug: 'coordenador-marketing', name: 'Coordenador de Marketing', departmentSlug: 'marketing' },
  { slug: 'designer', name: 'Designer', departmentSlug: 'marketing' },
  { slug: 'advogado', name: 'Advogado', departmentSlug: 'juridico' },
  { slug: 'gestor-catalogo', name: 'Gestor de Catálogo', departmentSlug: 'catalogo' },
];

const JOB_FUNCTIONS: Array<{ slug: string; name: string; category: string }> = [
  { slug: 'designer', name: 'Designer', category: 'criacao' },
  { slug: 'videomaker', name: 'Videomaker', category: 'audiovisual' },
  { slug: 'editor-video', name: 'Editor de Vídeo', category: 'audiovisual' },
  { slug: 'motion-designer', name: 'Motion Designer', category: 'audiovisual' },
  { slug: 'fotografo', name: 'Fotógrafo', category: 'audiovisual' },
  { slug: 'social-media', name: 'Social Media', category: 'marketing' },
  { slug: 'gestor-trafego', name: 'Gestor de Tráfego', category: 'marketing' },
  { slug: 'produtor-musical', name: 'Produtor Musical', category: 'producao' },
  { slug: 'curador', name: 'Curador', category: 'anr' },
  { slug: 'anr', name: 'A&R', category: 'anr' },
];

export interface OrgStructureSeedResult {
  tenants: number;
  perTenant: { departments: number; positions: number; jobFunctions: number };
}

export async function seedOrgStructure(ds: DataSource): Promise<OrgStructureSeedResult> {
  const tenants = (await ds.query(
    `SELECT "id" FROM "tenants" WHERE "deleted_at" IS NULL`,
  )) as Array<{ id: string }>;

  for (const { id: tenantId } of tenants) {
    for (const dep of DEPARTMENTS) {
      await ds.query(
        `INSERT INTO "departments" ("tenant_id", "slug", "name")
         SELECT $1::uuid, $2::varchar, $3::varchar
         WHERE NOT EXISTS (
           SELECT 1 FROM "departments" WHERE "tenant_id" = $1::uuid AND "slug" = $2::varchar AND "deleted_at" IS NULL
         )`,
        [tenantId, dep.slug, dep.name],
      );
    }

    for (const pos of POSITIONS) {
      await ds.query(
        `INSERT INTO "positions" ("tenant_id", "department_id", "slug", "name")
         SELECT $1::uuid,
                (SELECT "id" FROM "departments" WHERE "tenant_id" = $1::uuid AND "slug" = $4::varchar AND "deleted_at" IS NULL),
                $2::varchar, $3::varchar
         WHERE NOT EXISTS (
           SELECT 1 FROM "positions" WHERE "tenant_id" = $1::uuid AND "slug" = $2::varchar AND "deleted_at" IS NULL
         )`,
        [tenantId, pos.slug, pos.name, pos.departmentSlug],
      );
    }

    for (const fn of JOB_FUNCTIONS) {
      await ds.query(
        `INSERT INTO "job_functions" ("tenant_id", "slug", "name", "category")
         SELECT $1::uuid, $2::varchar, $3::varchar, $4::varchar
         WHERE NOT EXISTS (
           SELECT 1 FROM "job_functions" WHERE "tenant_id" = $1::uuid AND "slug" = $2::varchar AND "deleted_at" IS NULL
         )`,
        [tenantId, fn.slug, fn.name, fn.category],
      );
    }
  }

  return {
    tenants: tenants.length,
    perTenant: {
      departments: DEPARTMENTS.length,
      positions: POSITIONS.length,
      jobFunctions: JOB_FUNCTIONS.length,
    },
  };
}
