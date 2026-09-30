import { MigrationInterface, QueryRunner } from 'typeorm';
import { assertMigrationRoleBypassesRls } from '../migration-guards';

/**
 * 20260930000001_AddEnglishRoleSlugAliases
 *
 * RBAC naming normalization, EXPAND step only (technical = English, UX = PT-BR). The Portuguese
 * role slugs are persisted machine identifiers (roles.slug, org_members.role, JWT app_metadata.role,
 * workflow role arrays) and authorization depends on them, so they are renamed in expand-contract
 * form, never in place. This step adds the English slugs as GLOBAL alias rows that point to the
 * Portuguese role through canonical_role_id (the same mechanism as artista -> artist):
 *
 *   juridico -> legal, comercial -> sales, produtor -> producer,
 *   colaborador -> collaborator, rh_manager -> hr_manager
 *
 * (radio, tv, marketing, marketing_manager, artist are already English; artista stays a legacy
 * alias of artist.)
 *
 * Authorization equivalence: each alias row copies name and hierarchy_level from the canonical row,
 * is_system = true and is_assignable = FALSE. A non-assignable row cannot be granted through
 * UsersService (assertCanAssignRole) nor listed as invitable, so no member can hold an English
 * slug: the rows are inert. role_permissions are NOT copied — an alias inherits through
 * canonical_role_id (MembershipRoleResolverService resolves alias -> canonical role_id).
 *
 * Widening guard (fail-closed pre-flight, aborts before any write): the application now maps the
 * English slugs to real levels in ROLE_HIERARCHY, whereas before they were unknown (level 0, deny).
 * So up() refuses when any org_members.role already equals an English slug, when a tenant custom
 * role uses one, when a live global row with such a slug is not the exact alias, or when a
 * canonical Portuguese role is missing/archived. Nothing is renamed, deleted or backfilled here
 * (org_members.role backfill and the retirement of the Portuguese slugs are separate steps).
 *
 * down(): deletes only the alias rows created here (global, canonical_role_id set to the expected
 * Portuguese role) and REFUSES when any of them is referenced (org_members role/role_id,
 * tenant_invitations, role_permissions, role_inheritance, another role's canonical_role_id).
 * Inserts are guarded by NOT EXISTS on (global, slug); lock_timeout bounds waits.
 *
 * Deterministic end state: an exact pre-existing global alias row that is assignable or archived is
 * UPDATEd to is_assignable=false, archived_at=NULL (global rows only). down() still deletes the alias
 * rows (it cannot know their pre-up drift, and an inert alias is the only supported state).
 */
const ALIASES: ReadonlyArray<[alias: string, canonical: string]> = [
  ['legal', 'juridico'],
  ['sales', 'comercial'],
  ['producer', 'produtor'],
  ['collaborator', 'colaborador'],
  ['hr_manager', 'rh_manager'],
];

const ALIAS_SLUGS = ALIASES.map(([alias]) => alias);
const ALIAS_VALUES_SQL = ALIASES.map(([alias, canonical]) => `('${alias}', '${canonical}')`).join(', ');

interface CountRow {
  slug: string;
  source: string;
  n: number;
}

function summarize(rows: readonly CountRow[]): string {
  return rows.map((row) => `${row.slug}:${row.source}=${row.n}`).join(', ');
}

export class AddEnglishRoleSlugAliases20260930000001 implements MigrationInterface {
  name = 'AddEnglishRoleSlugAliases20260930000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);

    // 1) canonical Portuguese roles must exist, live and not archived.
    const missing: Array<{ canonical: string }> = await queryRunner.query(
      `SELECT v.canonical
         FROM (VALUES ${ALIAS_VALUES_SQL}) AS v(alias, canonical)
        WHERE NOT EXISTS (
          SELECT 1 FROM "roles" c
           WHERE c."slug" = v.canonical AND c."tenant_id" IS NULL
             AND c."deleted_at" IS NULL AND c."archived_at" IS NULL
        )`,
    );
    if (missing.length > 0) {
      throw new Error(
        `${this.name}: canonical role(s) missing or archived: ${missing.map((m) => m.canonical).join(', ')}. ` +
          'Run the RBAC seed/migrations first; refusing to create dangling aliases.',
      );
    }

    // 2) widening guard: nothing may already hold or shadow an English slug.
    const conflicts: CountRow[] = await queryRunner.query(
      `SELECT "role" AS slug, 'org_members.role' AS source, count(*)::int AS n
         FROM "org_members" WHERE "role" = ANY($1::text[]) GROUP BY "role"
       UNION ALL
       SELECT "slug", 'tenant_custom_role', count(*)::int
         FROM "roles" WHERE "tenant_id" IS NOT NULL AND "deleted_at" IS NULL AND "slug" = ANY($1::text[]) GROUP BY "slug"
       UNION ALL
       SELECT r."slug", 'global_row_not_expected_alias', count(*)::int
         FROM "roles" r
         JOIN (VALUES ${ALIAS_VALUES_SQL}) AS v(alias, canonical) ON v.alias = r."slug"
         LEFT JOIN "roles" c ON c."id" = r."canonical_role_id"
        WHERE r."tenant_id" IS NULL AND r."deleted_at" IS NULL
          AND (c."slug" IS DISTINCT FROM v.canonical OR c."hierarchy_level" IS DISTINCT FROM r."hierarchy_level")
        GROUP BY r."slug"`,
      [ALIAS_SLUGS],
    );
    if (conflicts.length > 0) {
      throw new Error(
        `${this.name}: refusing to add English role aliases because they would change existing authorization ` +
          `(${summarize(conflicts)}). Resolve these rows first (see docs of the RBAC expand-contract plan).`,
      );
    }

    // 3) expand: global alias rows, same level as the canonical role, not assignable, guarded per (global, slug).
    await queryRunner.query(
      `INSERT INTO "roles" ("tenant_id", "canonical_role_id", "slug", "name", "hierarchy_level", "is_system", "is_assignable")
       SELECT NULL::uuid, c."id", v.alias, c."name", c."hierarchy_level", TRUE, FALSE
         FROM (VALUES ${ALIAS_VALUES_SQL}) AS v(alias, canonical)
         JOIN "roles" c ON c."slug" = v.canonical AND c."tenant_id" IS NULL
                       AND c."deleted_at" IS NULL AND c."archived_at" IS NULL
        WHERE NOT EXISTS (
          SELECT 1 FROM "roles" e
           WHERE e."slug" = v.alias AND e."tenant_id" IS NULL AND e."deleted_at" IS NULL
        )`,
    );

    // 3b) deterministic repair: an exact global alias row (right canonical, same level; guaranteed by the
    // guard above) that drifted to assignable or archived is forced to inert (is_assignable=false,
    // archived_at NULL). Scoped to global, live rows of the five alias slugs only.
    await queryRunner.query(
      `UPDATE "roles" r
          SET "is_assignable" = FALSE, "archived_at" = NULL
         FROM (VALUES ${ALIAS_VALUES_SQL}) AS v(alias, canonical), "roles" c
        WHERE r."slug" = v.alias AND r."tenant_id" IS NULL AND r."deleted_at" IS NULL
          AND c."id" = r."canonical_role_id" AND c."slug" = v.canonical AND c."tenant_id" IS NULL
          AND (r."is_assignable" IS DISTINCT FROM FALSE OR r."archived_at" IS NOT NULL)`,
    );

    // 4) read-after-write: every alias row exists exactly once, points at its canonical role, same level, inert.
    const verified: Array<{ n: number }> = await queryRunner.query(
      `SELECT count(*)::int AS n
         FROM "roles" r
         JOIN (VALUES ${ALIAS_VALUES_SQL}) AS v(alias, canonical) ON v.alias = r."slug"
         JOIN "roles" c ON c."id" = r."canonical_role_id" AND c."slug" = v.canonical
        WHERE r."tenant_id" IS NULL AND r."deleted_at" IS NULL
          AND r."hierarchy_level" = c."hierarchy_level"
          AND r."is_assignable" = FALSE AND r."archived_at" IS NULL`,
    );
    if (verified[0]?.n !== ALIASES.length) {
      throw new Error(`${this.name}: expected ${ALIASES.length} verified alias rows, found ${verified[0]?.n}`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);

    const candidates: Array<{ id: string; slug: string }> = await queryRunner.query(
      `SELECT r."id", r."slug"
         FROM "roles" r
         JOIN (VALUES ${ALIAS_VALUES_SQL}) AS v(alias, canonical) ON v.alias = r."slug"
         JOIN "roles" c ON c."id" = r."canonical_role_id" AND c."slug" = v.canonical
        WHERE r."tenant_id" IS NULL AND r."canonical_role_id" IS NOT NULL AND r."slug" = ANY($1::text[])`,
      [ALIAS_SLUGS],
    );
    if (candidates.length === 0) return;
    const ids = candidates.map((row) => row.id);
    const slugs = candidates.map((row) => row.slug);

    const references: CountRow[] = await queryRunner.query(
      `SELECT r."slug", 'org_members.role_id' AS source, count(*)::int AS n
         FROM "org_members" m JOIN "roles" r ON r."id" = m."role_id" WHERE m."role_id" = ANY($1::uuid[]) GROUP BY r."slug"
       UNION ALL
       SELECT "role", 'org_members.role', count(*)::int
         FROM "org_members" WHERE "role" = ANY($2::text[]) GROUP BY "role"
       UNION ALL
       SELECT r."slug", 'tenant_invitations.role_id', count(*)::int
         FROM "tenant_invitations" i JOIN "roles" r ON r."id" = i."role_id" WHERE i."role_id" = ANY($1::uuid[]) GROUP BY r."slug"
       UNION ALL
       SELECT r."slug", 'role_permissions', count(*)::int
         FROM "role_permissions" p JOIN "roles" r ON r."id" = p."role_id" WHERE p."role_id" = ANY($1::uuid[]) GROUP BY r."slug"
       UNION ALL
       SELECT r."slug", 'role_inheritance', count(*)::int
         FROM "role_inheritance" h
         JOIN "roles" r ON r."id" IN (h."child_role_id", h."parent_role_id")
        WHERE r."id" = ANY($1::uuid[]) GROUP BY r."slug"
       UNION ALL
       SELECT r."slug", 'roles.canonical_role_id', count(*)::int
         FROM "roles" o JOIN "roles" r ON r."id" = o."canonical_role_id" WHERE o."canonical_role_id" = ANY($1::uuid[]) GROUP BY r."slug"`,
      [ids, slugs],
    );
    if (references.length > 0) {
      throw new Error(
        `${this.name}: refusing down() because English role aliases are still referenced (${summarize(references)}). ` +
          'Revert the members/invitations/permissions to the Portuguese slug first; nothing was deleted.',
      );
    }

    await queryRunner.query(`DELETE FROM "roles" WHERE "id" = ANY($1::uuid[]) AND "canonical_role_id" IS NOT NULL AND "slug" = ANY($2::text[])`, [
      ids,
      slugs,
    ]);
  }
}
