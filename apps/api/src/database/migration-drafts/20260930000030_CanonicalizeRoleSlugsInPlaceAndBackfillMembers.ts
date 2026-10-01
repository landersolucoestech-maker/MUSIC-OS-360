import { MigrationInterface, QueryRunner } from 'typeorm';
import { assertMigrationRoleBypassesRls } from '../migration-guards';

/**
 * DRAFT, GATED, NOT REGISTERED (RBAC slice S4b). Design: docs/engineering/rbac-retirement-plan.md.
 *
 * This file lives under migration-drafts/ on purpose: it is NOT part of ALL_MIGRATIONS
 * (migrations/index.ts), so no runner executes it, and nothing imports it except its own spec.
 * Moving it to migrations/ and registering it is the S4b release step and is allowed only after every
 * gate in the plan is evidenced. As a second lock, up() and down() throw unless the operator exports
 * RBAC_S4B_CONFIRM=<CONFIRM_TOKEN> (set only after the gates, in the release environment).
 *
 * What it does (expand-contract, step "migrate"; Portuguese slugs are NOT deleted, they become inert
 * aliases of the canonical English rows and are retired later by S5):
 *  1. Pre-flight (fail-closed, before any write): the five (legacy, canonical) global role pairs are in
 *     exactly the S4a state (legacy row live; canonical English row is an inert alias of it, same
 *     level, unreferenced); no tenant custom role uses any of the slugs; every org_members row that
 *     holds a legacy or canonical slug has role_id equal to the legacy row id (a row that does not is
 *     reported with counts and NEVER guessed or converted).
 *  2. In place rename of the GLOBAL role rows (same id, so role_permissions, role_inheritance,
 *     org_members.role_id, tenant_invitations.role_id and every cache key stay valid):
 *       delete the five unreferenced inert English alias rows; UPDATE roles SET slug = <english> on the
 *       legacy row; INSERT an inert alias row under the legacy slug pointing (canonical_role_id) at the
 *       renamed row, so legacy slugs are still resolvable by MembershipRoleResolver until S5.
 *  3. org_members.role backfill legacy -> canonical (also artista -> artist), keyset batches of 500 by
 *     primary key, only where role_id is the canonical row. tenant_invitations stores role_id only (no
 *     role string), so nothing to rewrite there; if a role column ever exists it is rewritten the same way.
 *  4. Residue audit inside the same transaction: zero members with a legacy slug, zero members whose role
 *     string and role_id disagree, five renamed rows, five inert legacy aliases. Any mismatch throws and the
 *     whole migration rolls back (TypeORM transaction).
 *  Not touched on purpose: workflow_transitions.actor_role and audit rows (history), Supabase auth users
 *  (JWT app_metadata.role refreshes on next token issue; both slugs are accepted), Redis membership cache
 *  (TTL 60 s; operator flushes membership:* per plan after commit).
 *
 * down(): reverse, only while nothing references the inert legacy alias rows and every English member row
 * still has role_id = renamed row id; otherwise refuses and changes nothing. Messages are bounded (counts
 * by slug/source, no PII, at most MAX_MESSAGE characters).
 */
export const CONFIRM_ENV = 'RBAC_S4B_CONFIRM';
export const CONFIRM_TOKEN = 'retire-legacy-role-slugs-gates-satisfied';
export const BATCH_SIZE = 500;
export const MAX_MESSAGE = 600;

/** [legacy (persisted today), canonical English]. */
export const ROLE_SLUG_PAIRS: ReadonlyArray<[legacy: string, canonical: string]> = [
  ['juridico', 'legal'],
  ['comercial', 'sales'],
  ['produtor', 'producer'],
  ['colaborador', 'collaborator'],
  ['rh_manager', 'hr_manager'],
];
/** Member-only pair: `artista` is already a global alias row of `artist`; only org_members.role is rewritten. */
export const MEMBER_ONLY_PAIR: readonly [legacy: string, canonical: string] = ['artista', 'artist'];

const PAIRS_SQL = ROLE_SLUG_PAIRS.map(([l, c]) => `('${l}', '${c}')`).join(', ');
const LEGACY = ROLE_SLUG_PAIRS.map(([l]) => l);
const CANONICAL = ROLE_SLUG_PAIRS.map(([, c]) => c);

interface CountRow { slug: string; source: string; n: number }

export function bounded(text: string): string {
  return text.length <= MAX_MESSAGE ? text : `${text.slice(0, MAX_MESSAGE)}...(+${text.length - MAX_MESSAGE} chars)`;
}
function summarize(rows: readonly CountRow[]): string {
  return rows.map((r) => `${r.slug}:${r.source}=${r.n}`).join(', ');
}

export class CanonicalizeRoleSlugsInPlaceAndBackfillMembers20260930000030 implements MigrationInterface {
  name = 'CanonicalizeRoleSlugsInPlaceAndBackfillMembers20260930000030';

  private assertConfirmed(): void {
    if (process.env[CONFIRM_ENV] !== CONFIRM_TOKEN) {
      throw new Error(`${this.name}: gated draft. Set ${CONFIRM_ENV} only after the gates of docs/engineering/rbac-retirement-plan.md are evidenced.`);
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    this.assertConfirmed();
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);

    // 1a) each pair must be in exactly the S4a state.
    const badPairs: Array<{ legacy: string; problem: string }> = await queryRunner.query(
      `SELECT v.legacy, 'legacy_row_missing_or_archived' AS problem
         FROM (VALUES ${PAIRS_SQL}) AS v(legacy, canonical)
        WHERE NOT EXISTS (SELECT 1 FROM "roles" l WHERE l."slug" = v.legacy AND l."tenant_id" IS NULL
                           AND l."deleted_at" IS NULL AND l."archived_at" IS NULL)
       UNION ALL
       SELECT v.legacy, 'canonical_row_not_inert_alias_of_legacy'
         FROM (VALUES ${PAIRS_SQL}) AS v(legacy, canonical)
        WHERE NOT EXISTS (
          SELECT 1 FROM "roles" e JOIN "roles" l ON l."id" = e."canonical_role_id"
           WHERE e."slug" = v.canonical AND e."tenant_id" IS NULL AND e."deleted_at" IS NULL
             AND e."is_assignable" = FALSE AND e."hierarchy_level" = l."hierarchy_level"
             AND l."slug" = v.legacy AND l."tenant_id" IS NULL AND l."deleted_at" IS NULL)`,
    );
    if (badPairs.length > 0) {
      throw new Error(bounded(`${this.name}: role catalog is not in the S4a expand state (${badPairs.map((r) => `${r.legacy}:${r.problem}`).join(', ')}). Nothing was changed.`));
    }

    // 1b) nothing may reference the inert English alias rows, and no tenant role may use any involved slug.
    const conflicts: CountRow[] = await queryRunner.query(
      `SELECT e."slug", 'english_alias_referenced_by_members' AS source, count(*)::int AS n
         FROM "org_members" m JOIN "roles" e ON e."id" = m."role_id"
        WHERE e."slug" = ANY($1::text[]) AND e."tenant_id" IS NULL AND e."canonical_role_id" IS NOT NULL GROUP BY e."slug"
       UNION ALL
       SELECT e."slug", 'english_alias_referenced_by_invitations', count(*)::int
         FROM "tenant_invitations" i JOIN "roles" e ON e."id" = i."role_id"
        WHERE e."slug" = ANY($1::text[]) AND e."tenant_id" IS NULL AND e."canonical_role_id" IS NOT NULL GROUP BY e."slug"
       UNION ALL
       SELECT e."slug", 'english_alias_has_role_permissions', count(*)::int
         FROM "role_permissions" p JOIN "roles" e ON e."id" = p."role_id"
        WHERE e."slug" = ANY($1::text[]) AND e."tenant_id" IS NULL GROUP BY e."slug"
       UNION ALL
       SELECT e."slug", 'english_alias_in_role_inheritance', count(*)::int
         FROM "role_inheritance" h JOIN "roles" e ON e."id" IN (h."child_role_id", h."parent_role_id")
        WHERE e."slug" = ANY($1::text[]) AND e."tenant_id" IS NULL GROUP BY e."slug"
       UNION ALL
       SELECT e."slug", 'english_alias_is_canonical_target', count(*)::int
         FROM "roles" o JOIN "roles" e ON e."id" = o."canonical_role_id"
        WHERE e."slug" = ANY($1::text[]) AND e."tenant_id" IS NULL GROUP BY e."slug"
       UNION ALL
       SELECT "slug", 'tenant_custom_role', count(*)::int
         FROM "roles" WHERE "tenant_id" IS NOT NULL AND "deleted_at" IS NULL AND "slug" = ANY($2::text[]) GROUP BY "slug"`,
      [CANONICAL, [...LEGACY, ...CANONICAL, MEMBER_ONLY_PAIR[0], MEMBER_ONLY_PAIR[1]]],
    );
    if (conflicts.length > 0) {
      throw new Error(bounded(`${this.name}: refusing, conflicting references (${summarize(conflicts)}). Nothing was changed.`));
    }

    // 1c) members that hold an involved slug but whose role_id is not the canonical row: never guessed.
    const unconvertible: CountRow[] = await queryRunner.query(
      `SELECT m."role" AS slug, 'role_id_not_canonical_row' AS source, count(*)::int AS n
         FROM "org_members" m
         JOIN (VALUES ${PAIRS_SQL}, ('${MEMBER_ONLY_PAIR[0]}', '${MEMBER_ONLY_PAIR[1]}')) AS v(legacy, canonical)
           ON m."role" IN (v.legacy, v.canonical)
        WHERE m."role_id" IS DISTINCT FROM (
                SELECT t."id" FROM "roles" t
                 WHERE t."tenant_id" IS NULL AND t."deleted_at" IS NULL AND t."canonical_role_id" IS NULL
                   AND t."slug" IN (v.legacy, CASE WHEN v.legacy = '${MEMBER_ONLY_PAIR[0]}' THEN v.canonical END)
                 LIMIT 1)
        GROUP BY m."role"`,
    );
    if (unconvertible.length > 0) {
      throw new Error(bounded(`${this.name}: members with an unresolvable role/role_id pair must be fixed manually first (${summarize(unconvertible)}). Nothing was changed.`));
    }

    // 2) in-place rename (same id). Delete the five unreferenced inert English alias rows first (unique global slug).
    const deleted: Array<{ id: string }> = await queryRunner.query(
      `DELETE FROM "roles" e
        USING "roles" l, (VALUES ${PAIRS_SQL}) AS v(legacy, canonical)
        WHERE e."slug" = v.canonical AND e."tenant_id" IS NULL AND e."canonical_role_id" = l."id"
          AND l."slug" = v.legacy AND l."tenant_id" IS NULL AND e."is_assignable" = FALSE
       RETURNING e."id"`,
    );
    if (deleted.length !== ROLE_SLUG_PAIRS.length) {
      throw new Error(`${this.name}: expected to remove ${ROLE_SLUG_PAIRS.length} inert alias rows, removed ${deleted.length}`);
    }
    const renamed: Array<{ id: string }> = await queryRunner.query(
      `UPDATE "roles" l SET "slug" = v.canonical
         FROM (VALUES ${PAIRS_SQL}) AS v(legacy, canonical)
        WHERE l."slug" = v.legacy AND l."tenant_id" IS NULL AND l."deleted_at" IS NULL AND l."canonical_role_id" IS NULL
       RETURNING l."id"`,
    );
    if (renamed.length !== ROLE_SLUG_PAIRS.length) {
      throw new Error(`${this.name}: expected to rename ${ROLE_SLUG_PAIRS.length} rows, renamed ${renamed.length}`);
    }
    await queryRunner.query(
      `INSERT INTO "roles" ("tenant_id", "canonical_role_id", "slug", "name", "hierarchy_level", "is_system", "is_assignable")
       SELECT NULL::uuid, c."id", v.legacy, c."name", c."hierarchy_level", TRUE, FALSE
         FROM (VALUES ${PAIRS_SQL}) AS v(legacy, canonical)
         JOIN "roles" c ON c."slug" = v.canonical AND c."tenant_id" IS NULL AND c."deleted_at" IS NULL
        WHERE NOT EXISTS (SELECT 1 FROM "roles" x WHERE x."slug" = v.legacy AND x."tenant_id" IS NULL AND x."deleted_at" IS NULL)`,
    );

    // 3) org_members.role backfill, keyset batches.
    for (const [legacy, canonical] of [...ROLE_SLUG_PAIRS, MEMBER_ONLY_PAIR]) {
      await this.rewriteMemberRole(queryRunner, legacy, canonical);
    }
    const inviteRole: Array<{ ok: number }> = await queryRunner.query(
      `SELECT 1 AS ok FROM information_schema.columns WHERE table_name = 'tenant_invitations' AND column_name = 'role' LIMIT 1`,
    );
    if (inviteRole.length > 0) {
      for (const [legacy, canonical] of [...ROLE_SLUG_PAIRS, MEMBER_ONLY_PAIR]) {
        await queryRunner.query(`UPDATE "tenant_invitations" SET "role" = $2 WHERE "role" = $1`, [legacy, canonical]);
      }
    }

    // 4) residue audit: any finding rolls the whole migration back.
    const residue: CountRow[] = await queryRunner.query(
      `SELECT "role" AS slug, 'legacy_slug_left_in_org_members' AS source, count(*)::int AS n
         FROM "org_members" WHERE "role" = ANY($1::text[]) GROUP BY "role"
       UNION ALL
       SELECT m."role", 'role_string_and_role_id_disagree', count(*)::int
         FROM "org_members" m JOIN "roles" r ON r."id" = m."role_id"
        WHERE m."role" = ANY($2::text[]) AND r."slug" <> m."role" GROUP BY m."role"`,
      [[...LEGACY, MEMBER_ONLY_PAIR[0]], CANONICAL],
    );
    const shape: Array<{ renamed: number; aliases: number }> = await queryRunner.query(
      `SELECT (SELECT count(*)::int FROM "roles" r WHERE r."slug" = ANY($1::text[]) AND r."tenant_id" IS NULL
                 AND r."deleted_at" IS NULL AND r."canonical_role_id" IS NULL) AS renamed,
              (SELECT count(*)::int FROM "roles" a JOIN "roles" c ON c."id" = a."canonical_role_id"
                WHERE a."slug" = ANY($2::text[]) AND a."tenant_id" IS NULL AND a."deleted_at" IS NULL
                  AND a."is_assignable" = FALSE AND c."slug" = ANY($1::text[])) AS aliases`,
      [CANONICAL, LEGACY],
    );
    if (residue.length > 0 || shape[0]?.renamed !== ROLE_SLUG_PAIRS.length || shape[0]?.aliases !== ROLE_SLUG_PAIRS.length) {
      throw new Error(bounded(`${this.name}: residue audit failed (${summarize(residue)}; renamed=${shape[0]?.renamed}, aliases=${shape[0]?.aliases}). Rolled back.`));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    this.assertConfirmed();
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);

    const references: CountRow[] = await queryRunner.query(
      `SELECT a."slug", 'legacy_alias_referenced_by_members' AS source, count(*)::int AS n
         FROM "org_members" m JOIN "roles" a ON a."id" = m."role_id"
        WHERE a."slug" = ANY($1::text[]) AND a."tenant_id" IS NULL AND a."canonical_role_id" IS NOT NULL GROUP BY a."slug"
       UNION ALL
       SELECT a."slug", 'legacy_alias_referenced_by_invitations', count(*)::int
         FROM "tenant_invitations" i JOIN "roles" a ON a."id" = i."role_id"
        WHERE a."slug" = ANY($1::text[]) AND a."tenant_id" IS NULL AND a."canonical_role_id" IS NOT NULL GROUP BY a."slug"
       UNION ALL
       SELECT a."slug", 'legacy_alias_has_role_permissions', count(*)::int
         FROM "role_permissions" p JOIN "roles" a ON a."id" = p."role_id"
        WHERE a."slug" = ANY($1::text[]) AND a."tenant_id" IS NULL AND a."canonical_role_id" IS NOT NULL GROUP BY a."slug"
       UNION ALL
       SELECT r."slug", 'english_member_with_foreign_role_id', count(*)::int
         FROM "org_members" m LEFT JOIN "roles" r ON r."id" = m."role_id"
        WHERE m."role" = ANY($2::text[]) AND (r."id" IS NULL OR r."slug" <> m."role") GROUP BY r."slug"`,
      [LEGACY, CANONICAL],
    );
    if (references.length > 0) {
      throw new Error(bounded(`${this.name}: refusing down() (${summarize(references)}). Nothing was changed.`));
    }

    // artista is not restored: genuine `artist` members cannot be told apart, and both slugs are equivalent.
    for (const [legacy, canonical] of ROLE_SLUG_PAIRS) {
      await this.rewriteMemberRole(queryRunner, canonical, legacy);
    }
    await queryRunner.query(
      `DELETE FROM "roles" a WHERE a."slug" = ANY($1::text[]) AND a."tenant_id" IS NULL
          AND a."canonical_role_id" IS NOT NULL AND a."is_assignable" = FALSE`,
      [LEGACY],
    );
    await queryRunner.query(
      `UPDATE "roles" r SET "slug" = v.legacy
         FROM (VALUES ${PAIRS_SQL}) AS v(legacy, canonical)
        WHERE r."slug" = v.canonical AND r."tenant_id" IS NULL AND r."deleted_at" IS NULL AND r."canonical_role_id" IS NULL`,
    );
    await queryRunner.query(
      `INSERT INTO "roles" ("tenant_id", "canonical_role_id", "slug", "name", "hierarchy_level", "is_system", "is_assignable")
       SELECT NULL::uuid, l."id", v.canonical, l."name", l."hierarchy_level", TRUE, FALSE
         FROM (VALUES ${PAIRS_SQL}) AS v(legacy, canonical)
         JOIN "roles" l ON l."slug" = v.legacy AND l."tenant_id" IS NULL AND l."deleted_at" IS NULL
        WHERE NOT EXISTS (SELECT 1 FROM "roles" x WHERE x."slug" = v.canonical AND x."tenant_id" IS NULL AND x."deleted_at" IS NULL)`,
    );
    const back: Array<{ n: number }> = await queryRunner.query(
      `SELECT count(*)::int AS n FROM "roles" e JOIN "roles" l ON l."id" = e."canonical_role_id"
        WHERE e."slug" = ANY($1::text[]) AND e."tenant_id" IS NULL AND e."is_assignable" = FALSE AND l."slug" = ANY($2::text[])`,
      [CANONICAL, LEGACY],
    );
    if (back[0]?.n !== ROLE_SLUG_PAIRS.length) {
      throw new Error(`${this.name}: down() verification failed (aliases=${back[0]?.n}). Rolled back.`);
    }
  }

  /** Keyset-batched role string rewrite; only rows whose role_id is the role row the slug resolves to. */
  private async rewriteMemberRole(queryRunner: QueryRunner, from: string, to: string): Promise<void> {
    let last = '00000000-0000-0000-0000-000000000000';
    for (;;) {
      const batch: Array<{ id: string }> = await queryRunner.query(
        `SELECT m."id" FROM "org_members" m
          WHERE m."role" = $1 AND m."id" > $2::uuid
          ORDER BY m."id" LIMIT ${BATCH_SIZE}`,
        [from, last],
      );
      if (batch.length === 0) return;
      const ids = batch.map((row) => row.id);
      await queryRunner.query(
        `UPDATE "org_members" SET "role" = $2, "updated_at" = now()
          WHERE "id" = ANY($1::uuid[]) AND "role" = $3
            AND "role_id" = (SELECT r."id" FROM "roles" r
                              WHERE r."tenant_id" IS NULL AND r."deleted_at" IS NULL AND r."canonical_role_id" IS NULL
                                AND r."slug" IN ($2, $3) LIMIT 1)`,
        [ids, to, from],
      );
      last = ids[ids.length - 1];
    }
  }
}
