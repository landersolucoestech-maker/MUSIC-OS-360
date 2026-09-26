import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.tokens';
import { RbacDistributedCacheService } from './rbac-distributed-cache.service';

export interface MemberAuthzContext {
  role?: string | null;
  role_id?: string | null;
  tenant_id?: string | null;
}

export interface PermissionConflict {
  permission: string;
  conflictsWith: string;
}

export interface EffectivePermissionResolution {
  permissions: string[];
  inheritedPermissions: string[];
  dependencyPermissions: string[];
  conflicts: PermissionConflict[];
}

export interface PersistedPermissionResolution {
  permissions: string[];
  available: boolean;
  cacheHit: boolean;
  source: 'persisted_role_permissions';
  reason: string;
}

interface CacheEntry {
  result: EffectivePermissionResolution;
  expiresAt: number;
  roleIds: string[];
}

interface RoleRow {
  id: string;
  canonical_role_id: string | null;
}

interface EffectiveRoleRow {
  id: string;
  current_version: number;
  depth: number;
}

interface GrantedPermissionRow {
  id: string;
  key: string;
  role_id: string;
}

interface DependencyRow {
  id: string | null;
  key: string | null;
  depth: number;
  cycle: boolean;
  invalid: boolean;
}

interface ConflictRow {
  permission_key: string;
  conflicts_with_key: string;
}

interface GraphRoleRow {
  id: string;
  depth: number;
}

interface PermissionRoleRow {
  role_id: string;
  permission_depth: number;
}

class PermissionResolutionError extends Error {}

const EMPTY_RESOLUTION: EffectivePermissionResolution = {
  permissions: [],
  inheritedPermissions: [],
  dependencyPermissions: [],
  conflicts: [],
};

type DualReadPath = 'role_id' | 'fallback';
type DivergenceClass =
  | 'MATCH'
  | 'ALIAS'
  | 'DIVERGENTE'
  | 'REMOVIDA'
  | 'ARQUIVADA'
  | 'CROSS_TENANT'
  | 'NO_ROLE_ID';

interface RoleIdentity {
  slug: string;
  tenant_id: string | null;
  canonical_slug: string | null;
  archived: boolean;
  deleted: boolean;
}

interface IdentityCacheEntry {
  identity: RoleIdentity | null;
  expiresAt: number;
}

@Injectable()
export class PermissionResolverService implements OnModuleInit {
  private readonly logger = new Logger('PermissionResolver');
  private readonly cacheTtlMs = 60_000;
  private readonly cache = new Map<string, CacheEntry>();
  // STEP 12-H — lightweight role identity cache for divergence classification (dual-read).
  private readonly identityCache = new Map<string, IdentityCacheEntry>();

  constructor(
    @Inject(DATA_SOURCE) private readonly ds: DataSource | null,
    @Optional()
    private readonly distributedCache?: RbacDistributedCacheService,
  ) {}

  onModuleInit(): void {
    this.distributedCache?.onInvalidation((roleIds) => {
      this.evictRoleIds(roleIds);
      for (const roleId of roleIds) this.identityCache.delete(roleId);
    });
  }

  async resolvePersisted(
    member: MemberAuthzContext,
  ): Promise<PersistedPermissionResolution> {
    const roleId =
      typeof member.role_id === 'string' && member.role_id.length > 0
        ? member.role_id
        : null;
    const tenantId =
      typeof member.tenant_id === 'string' ? member.tenant_id : null;
    const ds = this.ds;

    if (!roleId) {
      return {
        permissions: [],
        available: false,
        cacheHit: false,
        source: 'persisted_role_permissions',
        reason: 'no_role_id',
      };
    }
    if (!ds?.isInitialized) {
      return {
        permissions: [],
        available: false,
        cacheHit: false,
        source: 'persisted_role_permissions',
        reason: 'database_unavailable',
      };
    }

    let cacheHit = false;
    try {
      const result = await this.loadFromDb(
        ds,
        roleId,
        tenantId,
        (hit) => {
          cacheHit = hit;
        },
      );
      return {
        permissions: result.permissions,
        available: true,
        cacheHit,
        source: 'persisted_role_permissions',
        reason:
          result.permissions.length > 0
            ? 'role_permissions_resolved'
            : 'role_has_no_active_permissions',
      };
    } catch (error) {
      this.logger.error(
        `Falha no resolver persistido (role_id=${roleId}): ${(error as Error).message}`,
      );
      return {
        permissions: [],
        available: false,
        cacheHit,
        source: 'persisted_role_permissions',
        reason: 'resolver_error',
      };
    }
  }

  /** Dual-read telemetry on by default; can be turned off via RBAC_DUAL_READ_TELEMETRY=false. */
  private telemetryEnabled(): boolean {
    return process.env['RBAC_DUAL_READ_TELEMETRY'] !== 'false';
  }

  /**
   * Backwards-compatible API consumed by the current authorization pipeline.
   */
  async resolve(
    member: MemberAuthzContext,
    legacyFallback: () => string[],
  ): Promise<string[]> {
    const detailed = await this.resolveDetailed(member, legacyFallback);
    return detailed.permissions;
  }

  /**
   * Extended resolution for governance and diagnostics. Conflicts are reported
   * but never remove or add permissions by themselves.
   */
  async resolveDetailed(
    member: MemberAuthzContext,
    legacyFallback: () => string[],
  ): Promise<EffectivePermissionResolution> {
    const roleId =
      typeof member.role_id === 'string' && member.role_id.length > 0
        ? member.role_id
        : null;
    const ds = this.ds;
    const tenantId = typeof member.tenant_id === 'string' ? member.tenant_id : null;

    if (!roleId || !ds || !ds.isInitialized) {
      const permissions = this.unique(legacyFallback());
      await this.observeDualRead({
        path: 'fallback', reason: roleId ? 'no_ds' : 'no_role_id',
        member, roleId, usedPermissions: permissions, legacyPermissions: permissions, ds, tenantId,
      });
      return { ...EMPTY_RESOLUTION, permissions };
    }

    try {
      const result = await this.loadFromDb(ds, roleId, tenantId);
      // PRIMARY path: role_id resolved permissions via the database.
      if (result.permissions.length > 0) {
        await this.observeDualRead({
          path: 'role_id', reason: 'role_id_resolved',
          member, roleId, usedPermissions: result.permissions, legacyPermissions: this.unique(legacyFallback()), ds, tenantId,
        });
        return result;
      }

      // role_id present but without active permissions (role removed/archived/without grants) → FALLBACK.
      const permissions = this.unique(legacyFallback());
      await this.observeDualRead({
        path: 'fallback', reason: 'role_id_no_active_perms',
        member, roleId, usedPermissions: permissions, legacyPermissions: permissions, ds, tenantId,
      });
      return { ...EMPTY_RESOLUTION, permissions };
    } catch (error) {
      if (error instanceof PermissionResolutionError) {
        this.logger.error(
          `Falha fechada na resolucao de permissoes (role_id=${roleId}): ${error.message}`,
        );
        return { ...EMPTY_RESOLUTION };
      }

      this.logger.warn(
        `Falha ao resolver permissoes via banco (role_id=${roleId}); aplicando matriz legada. ${(error as Error).message}`,
      );
      const permissions = this.unique(legacyFallback());
      await this.observeDualRead({
        path: 'fallback', reason: 'db_error',
        member, roleId, usedPermissions: permissions, legacyPermissions: permissions, ds, tenantId,
      });
      return { ...EMPTY_RESOLUTION, permissions };
    }
  }

  /**
   * STEP 12-H — dual-read telemetry + shadow + divergence classification.
   * Only OBSERVES/records: never changes the authorization decision nor the returned set.
   * - `path`: 'role_id' (primary) or 'fallback' (legacy role string).
   * - shadow: compares the set used (role_id/DB) with the legacy set (role string).
   * - divergence: compares the `role` string with the canonical role of `role_id`.
   */
  private async observeDualRead(input: {
    path: DualReadPath;
    reason: string;
    member: MemberAuthzContext;
    roleId: string | null;
    usedPermissions: string[];
    legacyPermissions: string[];
    ds: DataSource | null;
    tenantId: string | null;
  }): Promise<void> {
    if (!this.telemetryEnabled()) return;
    try {
      const used = new Set(input.usedPermissions);
      const legacy = new Set(input.legacyPermissions);
      const missingVsLegacy = input.legacyPermissions.filter((k) => !used.has(k));
      const extraVsLegacy = input.usedPermissions.filter((k) => !legacy.has(k));
      const divergence = await this.classifyDivergence(input.ds, input.roleId, input.member, input.tenantId);

      this.logger.log(
        JSON.stringify({
          event: 'rbac_dual_read',
          path: input.path,
          reason: input.reason,
          role: typeof input.member.role === 'string' ? input.member.role : null,
          role_id: input.roleId,
          tenant_id: input.tenantId,
          divergence,
          used_count: input.usedPermissions.length,
          legacy_count: input.legacyPermissions.length,
          // shadow: legacy keys missing from the set used (potential gating regression)
          missing_vs_legacy: missingVsLegacy.length,
          extra_vs_legacy: extraVsLegacy.length,
          gating_safe: missingVsLegacy.length === 0,
        }),
      );
    } catch {
      // telemetry never breaks the resolution
    }
  }

  /** Classifies the relationship between the `role` string and the canonical role of `role_id`. */
  private async classifyDivergence(
    ds: DataSource | null,
    roleId: string | null,
    member: MemberAuthzContext,
    tenantId: string | null,
  ): Promise<DivergenceClass> {
    if (!roleId || !ds || !ds.isInitialized) return 'NO_ROLE_ID';
    const identity = await this.loadRoleIdentity(ds, roleId);
    if (!identity) return 'REMOVIDA';
    if (identity.deleted) return 'REMOVIDA';
    if (identity.archived) return 'ARQUIVADA';
    if (identity.tenant_id !== null && tenantId !== null && identity.tenant_id !== tenantId) {
      return 'CROSS_TENANT';
    }
    const roleStr = typeof member.role === 'string' ? member.role : null;
    if (identity.canonical_slug) return 'ALIAS';
    if (roleStr && roleStr !== identity.slug) return 'DIVERGENTE';
    return 'MATCH';
  }

  private async loadRoleIdentity(ds: DataSource, roleId: string): Promise<RoleIdentity | null> {
    const now = Date.now();
    const cached = this.identityCache.get(roleId);
    if (cached && cached.expiresAt > now) return cached.identity;
    const rows = (await ds.query(
      `SELECT r."slug", r."tenant_id", r."archived_at", r."deleted_at", c."slug" AS canonical_slug
         FROM "roles" r
         LEFT JOIN "roles" c ON c."id" = r."canonical_role_id"
        WHERE r."id" = $1 LIMIT 1`,
      [roleId],
    )) as Array<{ slug: string; tenant_id: string | null; archived_at: Date | null; deleted_at: Date | null; canonical_slug: string | null }>;
    const identity: RoleIdentity | null = rows.length === 0 ? null : {
      slug: rows[0].slug,
      tenant_id: rows[0].tenant_id,
      canonical_slug: rows[0].canonical_slug,
      archived: rows[0].archived_at != null,
      deleted: rows[0].deleted_at != null,
    };
    this.identityCache.set(roleId, { identity, expiresAt: now + this.cacheTtlMs });
    return identity;
  }

  private async loadFromDb(
    ds: DataSource,
    roleId: string,
    tenantId: string | null,
    observeCache?: (hit: boolean) => void,
  ): Promise<EffectivePermissionResolution> {
    const roleRows = (await ds.query(
      `SELECT "id", "canonical_role_id"
         FROM "roles"
        WHERE "id" = $1
          AND "deleted_at" IS NULL
          AND "archived_at" IS NULL
          AND ("tenant_id" IS NULL OR "tenant_id" = $2)
        LIMIT 1`,
      [roleId, tenantId],
    )) as RoleRow[];

    if (roleRows.length === 0) return { ...EMPTY_RESOLUTION };

    const effectiveRoleId = roleRows[0].canonical_role_id ?? roleRows[0].id;
    const effectiveRoles = await this.loadEffectiveRoles(
      ds,
      effectiveRoleId,
      tenantId,
    );
    const roleIds = effectiveRoles.map((role) => role.id);
    const catalogFingerprint = await this.loadCatalogFingerprint(ds);
    const versionSignature = effectiveRoles
      .map((role) => `${role.id}:${role.current_version}`)
      .sort()
      .join(',');
    const cacheKey =
      `${tenantId ?? 'global'}:${effectiveRoleId}:` +
      `${versionSignature}:${catalogFingerprint}`;
    const now = Date.now();
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiresAt > now) {
      observeCache?.(true);
      return cached.result;
    }

    const distributed = await this.distributedCache?.get<EffectivePermissionResolution>(
      cacheKey,
    );
    if (distributed) {
      observeCache?.(true);
      this.cache.set(cacheKey, {
        result: distributed,
        expiresAt: now + this.cacheTtlMs,
        roleIds: this.unique([roleId, ...roleIds]),
      });
      return distributed;
    }
    observeCache?.(false);

    const grantedRows = (await ds.query(
      `SELECT DISTINCT p."id", p."key", rp."role_id"
         FROM "role_permissions" rp
         JOIN "permissions" p
           ON p."id" = rp."permission_id"
          AND p."deprecated_at" IS NULL
        WHERE rp."role_id" = ANY($1::uuid[])
        ORDER BY p."key", rp."role_id"`,
      [roleIds],
    )) as GrantedPermissionRow[];

    const directRows = grantedRows.filter(
      (row) => row.role_id === effectiveRoleId,
    );
    const inheritedRows = grantedRows.filter(
      (row) => row.role_id !== effectiveRoleId,
    );
    const grantedIds = this.unique(grantedRows.map((row) => row.id));
    const directPermissions = this.unique(directRows.map((row) => row.key));
    const inheritedPermissions = this.unique(
      inheritedRows.map((row) => row.key),
    );
    const dependencies = await this.loadDependencies(ds, grantedIds);
    const dependencyPermissions = this.unique(
      dependencies.map((row) => row.key as string),
    ).filter(
      (key) =>
        !directPermissions.includes(key) && !inheritedPermissions.includes(key),
    );
    const allPermissionIds = this.unique([
      ...grantedIds,
      ...dependencies.map((row) => row.id as string),
    ]);
    const permissions = this.unique([
      ...directPermissions,
      ...inheritedPermissions,
      ...dependencyPermissions,
    ]).sort();
    const conflicts = await this.loadConflicts(ds, allPermissionIds);

    if (conflicts.length > 0) {
      this.logger.warn(
        `Conflitos SoD detectados para role_id=${effectiveRoleId}: ${conflicts
          .map((conflict) => `${conflict.permission}<->${conflict.conflictsWith}`)
          .join(', ')}`,
      );
    }

    const result: EffectivePermissionResolution = {
      permissions,
      inheritedPermissions: inheritedPermissions.sort(),
      dependencyPermissions: dependencyPermissions.sort(),
      conflicts,
    };
    this.cache.set(cacheKey, {
      result,
      expiresAt: now + this.cacheTtlMs,
      roleIds: this.unique([roleId, ...roleIds]),
    });
    await this.distributedCache?.set(
      cacheKey,
      result,
      this.unique([roleId, ...roleIds]),
      Math.ceil(this.cacheTtlMs / 1_000),
    );
    return result;
  }

  private async loadEffectiveRoles(
    ds: DataSource,
    effectiveRoleId: string,
    tenantId: string | null,
  ): Promise<EffectiveRoleRow[]> {
    try {
      const rows = (await ds.query(
        `WITH RECURSIVE effective_roles AS (
           SELECT role."id", role."current_version", 0 AS depth,
                  ARRAY[role."id"]::uuid[] AS path
             FROM "roles" role
            WHERE role."id" = $1
              AND role."canonical_role_id" IS NULL
              AND role."deleted_at" IS NULL
              AND role."archived_at" IS NULL
              AND (role."tenant_id" IS NULL OR role."tenant_id" = $2)
           UNION ALL
           SELECT parent."id", parent."current_version", effective.depth + 1,
                  effective.path || parent."id"
             FROM effective_roles effective
             JOIN "role_inheritance" inheritance
               ON inheritance."child_role_id" = effective."id"
              AND inheritance."deleted_at" IS NULL
              AND (inheritance."tenant_id" IS NULL OR inheritance."tenant_id" = $2)
             JOIN "roles" parent
               ON parent."id" = inheritance."parent_role_id"
              AND parent."canonical_role_id" IS NULL
              AND parent."deleted_at" IS NULL
              AND parent."archived_at" IS NULL
              AND (parent."tenant_id" IS NULL OR parent."tenant_id" = $2)
            WHERE effective.depth < 33
              AND NOT parent."id" = ANY(effective.path)
         )
         SELECT "id", "current_version", MAX(depth)::integer AS depth
           FROM effective_roles
          GROUP BY "id", "current_version"
          ORDER BY depth, "id"`,
        [effectiveRoleId, tenantId],
      )) as EffectiveRoleRow[];

      if (rows.length === 0) {
        throw new PermissionResolutionError(
          'role canonica ativa nao encontrada',
        );
      }
      if (rows.some((row) => Number(row.depth) > 32)) {
        throw new PermissionResolutionError(
          'profundidade maxima de heranca de roles excedida',
        );
      }
      return rows.map((row) => ({
        id: row.id,
        current_version: Number(row.current_version),
        depth: Number(row.depth),
      }));
    } catch (error) {
      if (error instanceof PermissionResolutionError) throw error;
      throw new PermissionResolutionError((error as Error).message);
    }
  }

  private async loadDependencies(
    ds: DataSource,
    permissionIds: string[],
  ): Promise<DependencyRow[]> {
    if (permissionIds.length === 0) return [];

    try {
      const rows = (await ds.query(
        `WITH RECURSIVE dependency_tree AS (
           SELECT dependency."permission_id" AS source_id,
                  dependency."depends_on_permission_id" AS dependency_id,
                  target."key",
                  1 AS depth,
                  ARRAY[
                    dependency."permission_id",
                    dependency."depends_on_permission_id"
                  ]::uuid[] AS path,
                  dependency."depends_on_permission_id" = dependency."permission_id" AS cycle,
                  target."id" IS NULL OR target."deprecated_at" IS NOT NULL AS invalid
             FROM "permission_dependencies" dependency
             LEFT JOIN "permissions" target
               ON target."id" = dependency."depends_on_permission_id"
            WHERE dependency."permission_id" = ANY($1::uuid[])
           UNION ALL
           SELECT tree.source_id,
                  dependency."depends_on_permission_id",
                  target."key",
                  tree.depth + 1,
                  tree.path || dependency."depends_on_permission_id",
                  dependency."depends_on_permission_id" = ANY(tree.path),
                  target."id" IS NULL OR target."deprecated_at" IS NOT NULL
             FROM dependency_tree tree
             JOIN "permission_dependencies" dependency
               ON dependency."permission_id" = tree.dependency_id
             LEFT JOIN "permissions" target
               ON target."id" = dependency."depends_on_permission_id"
            WHERE tree.depth < 33
              AND NOT tree.cycle
              AND NOT tree.invalid
         )
         SELECT dependency_id AS "id", "key", depth, cycle, invalid
           FROM dependency_tree
          ORDER BY depth, dependency_id`,
        [permissionIds],
      )) as DependencyRow[];

      if (rows.some((row) => Boolean(row.invalid))) {
        throw new PermissionResolutionError(
          'dependencia aponta para permissao inexistente ou descontinuada',
        );
      }
      if (rows.some((row) => Boolean(row.cycle))) {
        throw new PermissionResolutionError(
          'ciclo detectado no catalogo de dependencias',
        );
      }
      if (rows.some((row) => Number(row.depth) > 32)) {
        throw new PermissionResolutionError(
          'profundidade maxima de dependencias excedida',
        );
      }
      return rows.map((row) => ({
        id: row.id,
        key: row.key,
        depth: Number(row.depth),
        cycle: Boolean(row.cycle),
        invalid: Boolean(row.invalid),
      }));
    } catch (error) {
      if (error instanceof PermissionResolutionError) throw error;
      throw new PermissionResolutionError((error as Error).message);
    }
  }

  private async loadConflicts(
    ds: DataSource,
    permissionIds: string[],
  ): Promise<PermissionConflict[]> {
    if (permissionIds.length < 2) return [];

    try {
      const rows = (await ds.query(
        `SELECT left_permission."key" AS permission_key,
                right_permission."key" AS conflicts_with_key
           FROM "permission_conflicts" conflict
           JOIN "permissions" left_permission
             ON left_permission."id" = conflict."permission_id"
            AND left_permission."deprecated_at" IS NULL
           JOIN "permissions" right_permission
             ON right_permission."id" = conflict."conflicts_with_permission_id"
            AND right_permission."deprecated_at" IS NULL
          WHERE conflict."permission_id" = ANY($1::uuid[])
            AND conflict."conflicts_with_permission_id" = ANY($1::uuid[])
          ORDER BY left_permission."key", right_permission."key"`,
        [permissionIds],
      )) as ConflictRow[];

      return rows.map((row) => ({
        permission: row.permission_key,
        conflictsWith: row.conflicts_with_key,
      }));
    } catch (error) {
      throw new PermissionResolutionError((error as Error).message);
    }
  }

  private async loadCatalogFingerprint(ds: DataSource): Promise<string> {
    try {
      const rows = (await ds.query(
        `SELECT md5(
           COALESCE((
             SELECT string_agg(
               permission."id"::text || ':' ||
               permission."since_version"::text || ':' ||
               COALESCE(permission."deprecated_at"::text, ''),
               ',' ORDER BY permission."id"
             )
             FROM "permissions" permission
           ), '') || '|' ||
           COALESCE((
             SELECT string_agg(
               role_permission."id"::text || ':' ||
               role_permission."role_id"::text || ':' ||
               role_permission."permission_id"::text || ':' ||
               role_permission."created_at"::text,
               ',' ORDER BY role_permission."id"
             )
             FROM "role_permissions" role_permission
           ), '') || '|' ||
           COALESCE((
             SELECT string_agg(
               dependency."id"::text || ':' || dependency."created_at"::text,
               ',' ORDER BY dependency."id"
             )
             FROM "permission_dependencies" dependency
           ), '') || '|' ||
           COALESCE((
             SELECT string_agg(
               conflict."id"::text || ':' || conflict."created_at"::text,
               ',' ORDER BY conflict."id"
             )
             FROM "permission_conflicts" conflict
           ), '')
         ) AS fingerprint`,
      )) as Array<{ fingerprint: string }>;
      return rows[0]?.fingerprint ?? 'empty';
    } catch (error) {
      throw new PermissionResolutionError((error as Error).message);
    }
  }

  private unique(values: string[]): string[] {
    return Array.from(new Set(values));
  }

  private evictRoleIds(roleIds: Set<string>): number {
    let evictedEntries = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.roleIds.some((roleId) => roleIds.has(roleId))) {
        this.cache.delete(key);
        evictedEntries += 1;
      }
    }
    return evictedEntries;
  }

  private async loadDescendantRoleIds(
    ds: DataSource,
    roleIds: string[],
    tenantId: string | null,
  ): Promise<Set<string>> {
    if (roleIds.length === 0) return new Set();

    const rows = (await ds.query(
      `WITH RECURSIVE role_descendants AS (
         SELECT role."id", 0 AS depth, ARRAY[role."id"]::uuid[] AS path
           FROM "roles" role
          WHERE role."id" = ANY($1::uuid[])
            AND role."deleted_at" IS NULL
            AND role."archived_at" IS NULL
            AND (
              $2::uuid IS NULL
              OR role."tenant_id" IS NULL
              OR role."tenant_id" = $2
            )
         UNION ALL
         SELECT child."id", descendants.depth + 1,
                descendants.path || child."id"
           FROM role_descendants descendants
           JOIN "role_inheritance" inheritance
             ON inheritance."parent_role_id" = descendants."id"
            AND inheritance."deleted_at" IS NULL
            AND (
              $2::uuid IS NULL
              OR inheritance."tenant_id" IS NULL
              OR inheritance."tenant_id" = $2
            )
           JOIN "roles" child
             ON child."id" = inheritance."child_role_id"
            AND child."deleted_at" IS NULL
            AND child."archived_at" IS NULL
            AND (
              $2::uuid IS NULL
              OR child."tenant_id" IS NULL
              OR child."tenant_id" = $2
            )
          WHERE descendants.depth < 33
            AND NOT child."id" = ANY(descendants.path)
       )
       SELECT "id", MAX(depth)::integer AS depth
         FROM role_descendants
        GROUP BY "id"
        ORDER BY depth, "id"`,
      [this.unique(roleIds), tenantId],
    )) as GraphRoleRow[];

    if (rows.some((row) => Number(row.depth) > 32)) {
      throw new Error('profundidade maxima do grafo de roles excedida');
    }
    return new Set(rows.map((row) => row.id));
  }

  private async loadRolesAffectedByPermissions(
    ds: DataSource,
    permissionIds: string[],
    tenantId: string | null,
  ): Promise<Set<string>> {
    if (permissionIds.length === 0) return new Set();

    const rows = (await ds.query(
      `WITH RECURSIVE affected_permissions AS (
         SELECT permission."id", 0 AS depth,
                ARRAY[permission."id"]::uuid[] AS path
           FROM "permissions" permission
          WHERE permission."id" = ANY($1::uuid[])
         UNION ALL
         SELECT dependency."permission_id", affected.depth + 1,
                affected.path || dependency."permission_id"
           FROM affected_permissions affected
           JOIN "permission_dependencies" dependency
             ON dependency."depends_on_permission_id" = affected."id"
          WHERE affected.depth < 33
            AND NOT dependency."permission_id" = ANY(affected.path)
       )
       SELECT DISTINCT role_permission."role_id",
              MAX(affected.depth)::integer AS permission_depth
         FROM affected_permissions affected
         JOIN "role_permissions" role_permission
           ON role_permission."permission_id" = affected."id"
         JOIN "roles" role
           ON role."id" = role_permission."role_id"
          AND role."deleted_at" IS NULL
          AND role."archived_at" IS NULL
          AND (
            $2::uuid IS NULL
            OR role."tenant_id" IS NULL
            OR role."tenant_id" = $2
          )
        GROUP BY role_permission."role_id"
        ORDER BY role_permission."role_id"`,
      [this.unique(permissionIds), tenantId],
    )) as PermissionRoleRow[];

    if (rows.some((row) => Number(row.permission_depth) > 32)) {
      throw new Error('profundidade maxima do grafo de dependencias excedida');
    }
    return this.loadDescendantRoleIds(
      ds,
      rows.map((row) => row.role_id),
      tenantId,
    );
  }

  private async invalidateSafely(
    reason: string,
    resolveAffectedRoles: (ds: DataSource) => Promise<Set<string>>,
  ): Promise<Set<string>> {
    const startedAt = Date.now();
    const ds = this.ds;

    try {
      const affectedRoles =
        ds && ds.isInitialized
          ? await resolveAffectedRoles(ds)
          : new Set<string>();
      const evictedEntries = this.evictRoleIds(affectedRoles);
      await this.distributedCache?.invalidateRoleIds(affectedRoles);
      this.logger.log(
        JSON.stringify({
          event: 'rbac_cache_invalidation',
          reason,
          affectedRoles: affectedRoles.size,
          evictedEntries,
          durationMs: Date.now() - startedAt,
        }),
      );
      return affectedRoles;
    } catch (error) {
      const evictedEntries = this.cache.size;
      this.cache.clear();
      this.logger.error(
        JSON.stringify({
          event: 'rbac_cache_invalidation_failed',
          reason,
          fallback: 'clear_all',
          evictedEntries,
          durationMs: Date.now() - startedAt,
          error: (error as Error).message,
        }),
      );
      return new Set();
    }
  }

  async invalidateRole(
    roleId: string,
    tenantId: string | null = null,
    reason = 'role',
  ): Promise<Set<string>> {
    return this.invalidateSafely(reason, (ds) =>
      this.loadDescendantRoleIds(ds, [roleId], tenantId),
    );
  }

  async invalidateRolePermission(
    roleId: string,
    tenantId: string | null = null,
  ): Promise<Set<string>> {
    return this.invalidateRole(roleId, tenantId, 'role_permissions');
  }

  async invalidateRoleInheritance(
    childRoleId: string,
    parentRoleId: string,
    tenantId: string | null = null,
  ): Promise<Set<string>> {
    return this.invalidateSafely('role_inheritance', async (ds) => {
      const affectedRoles = await this.loadDescendantRoleIds(
        ds,
        [childRoleId],
        tenantId,
      );
      affectedRoles.add(parentRoleId);
      return affectedRoles;
    });
  }

  async invalidatePermissionDependencies(
    permissionIds: string[],
    tenantId: string | null = null,
  ): Promise<Set<string>> {
    return this.invalidateSafely('permission_dependencies', (ds) =>
      this.loadRolesAffectedByPermissions(ds, permissionIds, tenantId),
    );
  }

  async invalidatePermissionConflicts(
    permissionIds: string[],
    tenantId: string | null = null,
  ): Promise<Set<string>> {
    return this.invalidateSafely('permission_conflicts', (ds) =>
      this.loadRolesAffectedByPermissions(ds, permissionIds, tenantId),
    );
  }

  invalidate(roleId?: string): void {
    if (!roleId) {
      this.cache.clear();
      return;
    }
    this.evictRoleIds(new Set([roleId]));
  }
}
