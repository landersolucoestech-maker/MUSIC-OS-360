/**
 * seeds/04_rbac_seed.ts  (PHASE 8 — Enterprise RBAC)
 *
 * Populates the GLOBAL authorization catalog (tenant-independent):
 *   - permissions     → union of the resource:action keys of the legacy ROLE_PERMISSIONS matrix;
 *   - roles           → ensures the 25 global roles (20 + 5 non-assignable English aliases) (idempotent; preserves hierarchy_level);
 *   - role_permissions → derived EXACTLY from ROLE_PERMISSIONS, guaranteeing parity.
 *
 * Aliases (artista→artist, tenant_owner→owner) do NOT receive their own role_permissions:
 * they inherit from the canonical role via roles.canonical_role_id (resolved in PHASE 5).
 *
 * Idempotent: can run N times without duplicating. Creates no custom roles.
 */
import { DataSource } from 'typeorm';
import { ROLE_PERMISSIONS, ROLE_HIERARCHY } from '../../core/rbac/rbac.service';
import { ENGLISH_ROLE_ALIASES } from '../../core/rbac/role-hierarchy';

/** Aliases → canonical role. Excluded from the role_permissions seed (they inherit from the canonical role). */
const ALIASES: Record<string, string> = {
  artista: 'artist',
  tenant_owner: 'owner',
  // RBAC expand step (English naming): English alias -> Portuguese slug still persisted in
  // org_members.role. Single source: ENGLISH_ROLE_ALIASES (pinned by role-hierarchy.spec.ts).
  ...ENGLISH_ROLE_ALIASES,
};

/** PT-BR display names of the global roles (aligned with migration M2). */
const ROLE_NAMES: Record<string, string> = {
  super_admin: 'Super Administrador',
  tenant_owner: 'Proprietário do Tenant',
  owner: 'Proprietário',
  admin: 'Administrador',
  manager: 'Gerente',
  editor: 'Editor',
  financial: 'Financeiro',
  accounting: 'Contabilidade',
  juridico: 'Jurídico',
  marketing_manager: 'Gerente de Marketing',
  rh_manager: 'Gerente de RH',
  marketing: 'Marketing',
  comercial: 'Comercial',
  produtor: 'Produtor',
  radio: 'Rádio',
  tv: 'TV',
  artist: 'Artista',
  artista: 'Artista (legado)',
  colaborador: 'Colaborador',
  viewer: 'Visualizador',
  // English aliases share the PT-BR display name of their canonical role.
  legal: 'Jurídico',
  sales: 'Comercial',
  producer: 'Produtor',
  collaborator: 'Colaborador',
  hr_manager: 'Gerente de RH',
};

// English aliases stay non-assignable until the org_members backfill (expand step): no member can hold them.
const NON_ASSIGNABLE = new Set<string>(['super_admin', ...Object.keys(ENGLISH_ROLE_ALIASES)]);

const FINANCIAL_PERMISSION_GRANTS: Record<string, string[]> = {
  'financial_category:read': [
    'super_admin', 'owner', 'admin', 'manager', 'editor', 'financial', 'accounting',
    'juridico', 'marketing_manager', 'marketing', 'comercial', 'produtor', 'radio',
    'tv', 'artist', 'colaborador', 'rh_manager', 'viewer',
  ],
  'financial_category:create': ['super_admin', 'owner', 'admin', 'manager', 'editor', 'financial', 'accounting'],
  'financial_category:update': ['super_admin', 'owner', 'admin', 'manager', 'editor', 'financial', 'accounting'],
  'financial_category:delete': ['super_admin', 'owner', 'admin', 'manager'],
  'financial_category:reorder': ['super_admin', 'owner', 'admin', 'manager', 'editor', 'financial', 'accounting'],

  'financial_rule:read': [
    'super_admin', 'owner', 'admin', 'manager', 'editor', 'financial', 'accounting',
    'juridico', 'marketing_manager', 'marketing', 'comercial', 'produtor', 'radio',
    'tv', 'artist', 'colaborador', 'rh_manager', 'viewer',
  ],
  'financial_rule:create': ['super_admin', 'owner', 'admin', 'manager'],
  'financial_rule:update': ['super_admin', 'owner', 'admin', 'manager'],
  'financial_rule:delete': ['super_admin', 'owner', 'admin'],
  'financial_rule:trigger': ['super_admin', 'owner', 'admin', 'manager', 'editor', 'financial', 'accounting'],

  'financial_category_rule:read': [
    'super_admin', 'owner', 'admin', 'manager', 'editor', 'financial', 'accounting',
    'juridico', 'marketing_manager', 'marketing', 'comercial', 'produtor', 'radio',
    'tv', 'artist', 'colaborador', 'rh_manager', 'viewer',
  ],
  'financial_category_rule:create': ['super_admin', 'owner', 'admin', 'manager', 'editor', 'financial', 'accounting'],
  'financial_category_rule:update': ['super_admin', 'owner', 'admin', 'manager', 'editor', 'financial', 'accounting'],
  'financial_category_rule:delete': ['super_admin', 'owner', 'admin', 'manager'],
};

// Role lists by legacy hierarchy threshold (canonical; aliases inherit from the canonical one).
//   viewer+    (level >= 10) = all canonical roles
//   financial+ (level >= 60) = super_admin..accounting
//   manager+   (level >= 70) = super_admin..manager
const VIEWER_PLUS = [
  'super_admin', 'owner', 'admin', 'manager', 'editor', 'financial', 'accounting',
  'juridico', 'marketing_manager', 'marketing', 'comercial', 'produtor', 'radio',
  'tv', 'artist', 'colaborador', 'rh_manager', 'viewer',
];
const FINANCIAL_PLUS = ['super_admin', 'owner', 'admin', 'manager', 'editor', 'financial', 'accounting'];
const MANAGER_PLUS = ['super_admin', 'owner', 'admin', 'manager'];

// PHASE 8.3: transactions/invoices permissions at parity with the controllers' @RequireRole
// baseline (read→viewer+, create/update→financial+, cancel→manager+). DELETE is not mapped:
// the DELETE route has cancel/soft-delete semantics → *:cancel is used, not *:delete.
const TRANSACTION_INVOICE_PERMISSION_GRANTS: Record<string, string[]> = {
  'transaction:read': VIEWER_PLUS,
  'transaction:create': FINANCIAL_PLUS,
  'transaction:update': FINANCIAL_PLUS,
  'transaction:cancel': MANAGER_PLUS,
  'invoice:read': VIEWER_PLUS,
  'invoice:create': FINANCIAL_PLUS,
  'invoice:update': FINANCIAL_PLUS,
  'invoice:cancel': MANAGER_PLUS,
};

// PHASE 8.4: contracts/contract-templates permissions at parity with the controllers'
// @RequireRole baseline (read→viewer+, create/update→editor+, cancel/archive→manager+).
// editor+ (level >= 60) is exactly the same set as financial+ (editor and financial = level 60).
// DELETE does not become *:delete: the semantics are cancellation (contract) / archiving (template).
const EDITOR_PLUS = FINANCIAL_PLUS;
const CONTRACT_PERMISSION_GRANTS: Record<string, string[]> = {
  'contract:read': VIEWER_PLUS,
  'contract:create': EDITOR_PLUS,
  'contract:update': EDITOR_PLUS,
  'contract:cancel': MANAGER_PLUS,
  'contract_template:read': VIEWER_PLUS,
  'contract_template:create': EDITOR_PLUS,
  'contract_template:update': EDITOR_PLUS,
  'contract_template:archive': MANAGER_PLUS,
  'contract_service_type:read': VIEWER_PLUS,
  'contract_service_type:create': EDITOR_PLUS,
  'contract_service_type:update': EDITOR_PLUS,
  'contract_service_type:archive': MANAGER_PLUS,
};

// PHASE 8.5: closes the critical catalog×controller GAP. Granular CRUD of the already migrated controllers
// (works/phonograms/shares/clients/contacts/leads/lead-interactions/licensing/events/projects/
// artist-goals) at EXACT parity with each route's @RequireRole:
//   read→viewer+, create/update→editor+, delete→manager+.
// Exceptions derived from the controllers (source of truth): contact has no DELETE route;
// lead_interaction has no PATCH/update route → they do not receive those keys.
const GRANULAR_CRUD_PERMISSION_GRANTS: Record<string, string[]> = {
  'work:read': VIEWER_PLUS, 'work:create': EDITOR_PLUS, 'work:update': EDITOR_PLUS, 'work:delete': MANAGER_PLUS,
  'phonogram:read': VIEWER_PLUS, 'phonogram:create': EDITOR_PLUS, 'phonogram:update': EDITOR_PLUS, 'phonogram:delete': MANAGER_PLUS,
  'share:read': VIEWER_PLUS, 'share:create': EDITOR_PLUS, 'share:update': EDITOR_PLUS, 'share:delete': MANAGER_PLUS,
  'client:read': VIEWER_PLUS, 'client:create': EDITOR_PLUS, 'client:update': EDITOR_PLUS, 'client:delete': MANAGER_PLUS,
  'contact:read': VIEWER_PLUS, 'contact:create': EDITOR_PLUS, 'contact:update': EDITOR_PLUS,
  'lead:read': VIEWER_PLUS, 'lead:create': EDITOR_PLUS, 'lead:update': EDITOR_PLUS, 'lead:delete': MANAGER_PLUS,
  'lead_interaction:read': VIEWER_PLUS, 'lead_interaction:create': EDITOR_PLUS, 'lead_interaction:delete': MANAGER_PLUS,
  'license:read': VIEWER_PLUS, 'license:create': EDITOR_PLUS, 'license:update': EDITOR_PLUS, 'license:delete': MANAGER_PLUS,
  'event:read': VIEWER_PLUS, 'event:create': EDITOR_PLUS, 'event:update': EDITOR_PLUS, 'event:delete': MANAGER_PLUS,
  'project:read': VIEWER_PLUS, 'project:create': EDITOR_PLUS, 'project:update': EDITOR_PLUS, 'project:delete': MANAGER_PLUS,
  'artist_goal:read': VIEWER_PLUS, 'artist_goal:create': EDITOR_PLUS, 'artist_goal:update': EDITOR_PLUS, 'artist_goal:delete': MANAGER_PLUS,
};

// PHASE 8.6: realigns the DISTRIBUTION of artist:* and inventory:* to their controllers'
// @RequireRole baseline (read→viewer+, create/update→editor+, delete→manager+). These permissions already exist
// in the catalog (coming from the legacy matrix with a narrower distribution); here we only ADD
// the missing grants via ON CONFLICT DO NOTHING. No new permission is created; nothing is removed.
const ARTIST_INVENTORY_PERMISSION_GRANTS: Record<string, string[]> = {
  'artist:read': VIEWER_PLUS, 'artist:create': EDITOR_PLUS, 'artist:update': EDITOR_PLUS, 'artist:delete': MANAGER_PLUS,
  'inventory:read': VIEWER_PLUS, 'inventory:create': EDITOR_PLUS, 'inventory:update': EDITOR_PLUS, 'inventory:delete': MANAGER_PLUS,
};

export interface RbacSeedResult {
  permissions: number;
  roles: number;
  rolePermissions: number;
}

export async function seedRbac(ds: DataSource): Promise<RbacSeedResult> {
  // ── 1) permissions: catalog = union of the legacy matrix keys ────────────────
  const keys = new Set<string>();
  for (const perms of Object.values(ROLE_PERMISSIONS)) {
    for (const key of perms) keys.add(key);
  }
  for (const key of Object.keys(FINANCIAL_PERMISSION_GRANTS)) {
    keys.add(key);
  }
  for (const key of Object.keys(TRANSACTION_INVOICE_PERMISSION_GRANTS)) {
    keys.add(key);
  }
  for (const key of Object.keys(CONTRACT_PERMISSION_GRANTS)) {
    keys.add(key);
  }
  for (const key of Object.keys(GRANULAR_CRUD_PERMISSION_GRANTS)) {
    keys.add(key);
  }
  for (const key of keys) {
    const [resource, action] = key.split(':');
    await ds.query(
      `INSERT INTO "permissions" ("resource", "action", "key")
       VALUES ($1, $2, $3)
       ON CONFLICT ("resource", "action") DO NOTHING`,
      [resource, action, key],
    );
  }

  // ── 2) roles: ensures the 20 global roles (idempotent; preserves hierarchy_level) ──
  for (const slug of Object.keys(ROLE_HIERARCHY)) {
    const level = ROLE_HIERARCHY[slug];
    const name = ROLE_NAMES[slug] ?? slug;
    const assignable = !NON_ASSIGNABLE.has(slug);
    // An English alias must never shadow a live tenant custom role with the same slug (the
    // migration pre-flight refuses this state; the seed skips the alias instead of widening it).
    if (Object.prototype.hasOwnProperty.call(ENGLISH_ROLE_ALIASES, slug)) {
      const [collision] = (await ds.query(
        `SELECT 1 FROM "roles" WHERE "slug" = $1::varchar AND "tenant_id" IS NOT NULL AND "deleted_at" IS NULL LIMIT 1`,
        [slug],
      )) as unknown[];
      if (collision) {
        console.warn(`[rbac-seed] skipping global alias role "${slug}": a live tenant custom role uses this slug; rename it first`);
        continue;
      }
    }
    await ds.query(
      `INSERT INTO "roles" ("tenant_id", "slug", "name", "hierarchy_level", "is_system", "is_assignable")
       SELECT NULL::uuid, $1::varchar, $2::varchar, $3::int, TRUE, $4::boolean
       WHERE NOT EXISTS (
         SELECT 1 FROM "roles" WHERE "slug" = $1::varchar AND "tenant_id" IS NULL AND "deleted_at" IS NULL
       )`,
      [slug, name, level, assignable],
    );
  }

  // ── 2b) aliases → canonical_role_id ─────────────────────────────────────────
  for (const [alias, canonical] of Object.entries(ALIASES)) {
    await ds.query(
      `UPDATE "roles" a
          SET "canonical_role_id" = c."id"
         FROM "roles" c
        WHERE a."slug" = $1 AND c."slug" = $2
          AND a."tenant_id" IS NULL AND c."tenant_id" IS NULL
          AND a."canonical_role_id" IS NULL`,
      [alias, canonical],
    );
  }

  // ── 3) role_permissions: EXACT parity with ROLE_PERMISSIONS (except aliases) ─
  for (const [slug, perms] of Object.entries(ROLE_PERMISSIONS)) {
    if (ALIASES[slug]) continue; // alias inherits from the canonical role
    for (const key of perms) {
      await ds.query(
        `INSERT INTO "role_permissions" ("role_id", "permission_id")
         SELECT r."id", p."id"
           FROM "roles" r, "permissions" p
          WHERE r."slug" = $1 AND r."tenant_id" IS NULL AND r."deleted_at" IS NULL
            AND p."key" = $2
         ON CONFLICT ("role_id", "permission_id") DO NOTHING`,
        [slug, key],
      );
    }
  }

  // PHASE 8.1: incremental financial permissions without changing the legacy matrix.
  for (const [key, slugs] of Object.entries(FINANCIAL_PERMISSION_GRANTS)) {
    for (const slug of slugs) {
      if (ALIASES[slug]) continue; // aliases inherit from the canonical role
      await ds.query(
        `INSERT INTO "role_permissions" ("role_id", "permission_id")
         SELECT r."id", p."id"
           FROM "roles" r, "permissions" p
          WHERE r."slug" = $1 AND r."tenant_id" IS NULL AND r."deleted_at" IS NULL
            AND p."key" = $2
         ON CONFLICT ("role_id", "permission_id") DO NOTHING`,
        [slug, key],
      );
    }
  }

  // PHASE 8.3: transactions/invoices permissions at parity with the controllers' baseline.
  for (const [key, slugs] of Object.entries(TRANSACTION_INVOICE_PERMISSION_GRANTS)) {
    for (const slug of slugs) {
      if (ALIASES[slug]) continue; // aliases inherit from the canonical role
      await ds.query(
        `INSERT INTO "role_permissions" ("role_id", "permission_id")
         SELECT r."id", p."id"
           FROM "roles" r, "permissions" p
          WHERE r."slug" = $1 AND r."tenant_id" IS NULL AND r."deleted_at" IS NULL
            AND p."key" = $2
         ON CONFLICT ("role_id", "permission_id") DO NOTHING`,
        [slug, key],
      );
    }
  }

  // PHASE 8.4: contracts/contract-templates permissions at parity with the controllers' baseline.
  for (const [key, slugs] of Object.entries(CONTRACT_PERMISSION_GRANTS)) {
    for (const slug of slugs) {
      if (ALIASES[slug]) continue; // aliases inherit from the canonical role
      await ds.query(
        `INSERT INTO "role_permissions" ("role_id", "permission_id")
         SELECT r."id", p."id"
           FROM "roles" r, "permissions" p
          WHERE r."slug" = $1 AND r."tenant_id" IS NULL AND r."deleted_at" IS NULL
            AND p."key" = $2
         ON CONFLICT ("role_id", "permission_id") DO NOTHING`,
        [slug, key],
      );
    }
  }

  // PHASE 8.5: granular CRUD of the migrated controllers (closes the catalog×controller gap).
  for (const [key, slugs] of Object.entries(GRANULAR_CRUD_PERMISSION_GRANTS)) {
    for (const slug of slugs) {
      if (ALIASES[slug]) continue; // aliases inherit from the canonical role
      await ds.query(
        `INSERT INTO "role_permissions" ("role_id", "permission_id")
         SELECT r."id", p."id"
           FROM "roles" r, "permissions" p
          WHERE r."slug" = $1 AND r."tenant_id" IS NULL AND r."deleted_at" IS NULL
            AND p."key" = $2
         ON CONFLICT ("role_id", "permission_id") DO NOTHING`,
        [slug, key],
      );
    }
  }

  // PHASE 8.6: realignment of the artist:* and inventory:* distribution (adds missing grants).
  for (const [key, slugs] of Object.entries(ARTIST_INVENTORY_PERMISSION_GRANTS)) {
    for (const slug of slugs) {
      if (ALIASES[slug]) continue; // aliases inherit from the canonical role
      await ds.query(
        `INSERT INTO "role_permissions" ("role_id", "permission_id")
         SELECT r."id", p."id"
           FROM "roles" r, "permissions" p
          WHERE r."slug" = $1 AND r."tenant_id" IS NULL AND r."deleted_at" IS NULL
            AND p."key" = $2
         ON CONFLICT ("role_id", "permission_id") DO NOTHING`,
        [slug, key],
      );
    }
  }

  const [{ permissions }] = (await ds.query(`SELECT count(*)::int AS permissions FROM "permissions"`)) as Array<{ permissions: number }>;
  const [{ roles }] = (await ds.query(`SELECT count(*)::int AS roles FROM "roles" WHERE "tenant_id" IS NULL`)) as Array<{ roles: number }>;
  const [{ rolepermissions }] = (await ds.query(`SELECT count(*)::int AS rolepermissions FROM "role_permissions"`)) as Array<{ rolepermissions: number }>;

  return { permissions, roles, rolePermissions: rolepermissions };
}
