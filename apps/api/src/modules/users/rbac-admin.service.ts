import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { RbacMutationService } from '../../core/rbac/rbac-mutation.service';
import { ROLE_HIERARCHY } from '../../core/rbac/role-hierarchy';
import type {
  CreateTenantRoleDto,
  DuplicateTenantRoleDto,
  UpdateTenantRoleDto,
} from './dto/rbac-admin.dto';

@Injectable()
export class RbacAdminService {
  constructor(
    @Inject(DATA_SOURCE) private readonly ds: DataSource,
    private readonly mutations: RbacMutationService,
  ) {}

  async listRoles(tenantId: string, includeArchived = false) {
    return this.ds.query(
      `SELECT role."id", role."tenant_id", role."slug", role."name",
              role."description", role."hierarchy_level" AS "priority",
              role."is_system", role."is_assignable",
              role."archived_at",
              role."created_at", role."updated_at"
         FROM "roles" role
        WHERE (role."tenant_id" = $1 OR role."tenant_id" IS NULL)
          AND role."deleted_at" IS NULL
          AND ($2::boolean OR role."archived_at" IS NULL)
        ORDER BY role."hierarchy_level" DESC, role."name" ASC`,
      [tenantId, includeArchived],
    );
  }

  async getRoleDetail(tenantId: string, roleId: string) {
    const roles = await this.ds.query(
      `SELECT role."id", role."tenant_id", role."slug", role."name",
              role."description", role."hierarchy_level" AS "priority",
              role."is_system", role."is_assignable", role."archived_at",
              role."created_at", role."updated_at"
         FROM "roles" role
        WHERE role."id" = $1
          AND (role."tenant_id" = $2 OR role."tenant_id" IS NULL)
          AND role."deleted_at" IS NULL
        LIMIT 1`,
      [roleId, tenantId],
    ) as Array<Record<string, unknown>>;
    if (!roles[0]) throw new NotFoundException('Papel não encontrado');

    const permissions = await this.ds.query(
      `WITH RECURSIVE effective_roles AS (
         SELECT role."id", role."name", role."slug", 0 AS depth,
                ARRAY[role."id"]::uuid[] AS path
           FROM "roles" role
          WHERE role."id" = $1
            AND (role."tenant_id" = $2 OR role."tenant_id" IS NULL)
            AND role."deleted_at" IS NULL
            AND role."archived_at" IS NULL
         UNION ALL
         SELECT parent."id", parent."name", parent."slug", effective.depth + 1,
                effective.path || parent."id"
           FROM effective_roles effective
           JOIN "role_inheritance" inheritance
             ON inheritance."child_role_id" = effective."id"
            AND inheritance."deleted_at" IS NULL
            AND (inheritance."tenant_id" = $2 OR inheritance."tenant_id" IS NULL)
           JOIN "roles" parent ON parent."id" = inheritance."parent_role_id"
          WHERE parent."deleted_at" IS NULL
            AND parent."archived_at" IS NULL
            AND NOT parent."id" = ANY(effective.path)
       )
       SELECT DISTINCT permission."id", permission."key" AS "code",
              COALESCE(permission."label", permission."key") AS "label",
              permission."resource" AS "category",
              effective."id" AS "source_role_id",
              effective."name" AS "source_role_name",
              effective."slug" AS "source_role_slug",
              CASE WHEN effective.depth = 0 THEN 'direct' ELSE 'inherited' END AS "source",
              effective.depth
         FROM effective_roles effective
         JOIN "role_permissions" grant_row ON grant_row."role_id" = effective."id"
         JOIN "permissions" permission ON permission."id" = grant_row."permission_id"
        WHERE permission."deprecated_at" IS NULL
        ORDER BY permission."key", effective.depth`,
      [roleId, tenantId],
    );
    const inheritance = await this.ds.query(
      `SELECT inheritance."id", inheritance."parent_role_id",
              parent."name" AS "parent_role_name", parent."slug" AS "parent_role_slug",
              inheritance."created_at"
         FROM "role_inheritance" inheritance
         JOIN "roles" parent ON parent."id" = inheritance."parent_role_id"
        WHERE inheritance."child_role_id" = $1
          AND (inheritance."tenant_id" = $2 OR inheritance."tenant_id" IS NULL)
          AND inheritance."deleted_at" IS NULL
        ORDER BY parent."name"`,
      [roleId, tenantId],
    );
    const impactedUsers = await this.ds.query(
      `SELECT "id", "auth_user_id", "email", "full_name", "is_active"
         FROM "org_members"
        WHERE "tenant_id" = $1 AND "role_id" = $2 AND "deleted_at" IS NULL
        ORDER BY "email"`,
      [tenantId, roleId],
    );
    return { ...roles[0], permissions, inheritance, impactedUsers };
  }

  async listPermissions() {
    return this.ds.query(
      `SELECT permission."id", permission."key" AS "code",
              COALESCE(permission."label", permission."key") AS "label",
              permission."description",
              permission."resource" AS "category",
              permission."created_at"
         FROM "permissions" permission
        WHERE permission."deprecated_at" IS NULL
          AND permission."is_assignable" = true
        ORDER BY category ASC, permission."key" ASC`,
    );
  }

  async listGrants(tenantId: string) {
    return this.ds.query(
      `SELECT role_permission."id", role_permission."role_id",
              role_permission."permission_id", role_permission."created_at"
         FROM "role_permissions" role_permission
         JOIN "roles" role ON role."id" = role_permission."role_id"
        WHERE (role."tenant_id" = $1 OR role."tenant_id" IS NULL)
          AND role."deleted_at" IS NULL
          AND role."archived_at" IS NULL`,
      [tenantId],
    );
  }

  async createRole(tenantId: string, actorId: string, actorRole: string, dto: CreateTenantRoleDto) {
    const hierarchyLevel = dto.hierarchyLevel ?? Math.max(0, (ROLE_HIERARCHY[actorRole] ?? 0) - 10);
    this.assertHierarchy(actorRole, hierarchyLevel);
    const slug = dto.slug ?? dto.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    await this.assertSlugNotReserved(slug);
    const role = await this.mutations.createRole({
      tenantId,
      slug,
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      isAssignable: dto.isAssignable ?? true,
      hierarchyLevel,
      actorId,
    });
    for (const permissionId of new Set(dto.permissionIds ?? [])) {
      await this.mutations.grantRolePermission(role.id, permissionId, tenantId, actorId);
    }
    return (await this.listRoles(tenantId)).find((item: { id: string }) => item.id === role.id);
  }

  async updateRole(
    tenantId: string,
    actorId: string,
    actorRole: string,
    roleId: string,
    dto: UpdateTenantRoleDto,
  ) {
    await this.assertMutableRole(tenantId, roleId, actorRole);
    const changed = await this.mutations.updateRole(roleId, tenantId, {
      name: dto.name?.trim(),
      description: dto.description?.trim() ?? dto.description,
      isAssignable: dto.isAssignable,
      actorId,
    });
    if (!changed) throw new NotFoundException('Papel não encontrado');
    return this.getRoleDetail(tenantId, roleId);
  }

  async duplicateRole(
    tenantId: string,
    actorId: string,
    actorRole: string,
    roleId: string,
    dto: DuplicateTenantRoleDto,
  ) {
    const source = await this.getRoleRow(tenantId, roleId);
    const level = Math.min(source.hierarchy_level, Math.max(0, (ROLE_HIERARCHY[actorRole] ?? 0) - 1));
    this.assertHierarchy(actorRole, level);
    const slug = dto.slug ?? dto.name.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    await this.assertSlugNotReserved(slug);
    const created = await this.mutations.createRole({
      tenantId,
      slug,
      name: dto.name.trim(),
      description: source.description,
      hierarchyLevel: level,
      isAssignable: true,
      actorId,
    });
    const grants = await this.ds.query(
      `SELECT "permission_id" FROM "role_permissions" WHERE "role_id" = $1`,
      [roleId],
    ) as Array<{ permission_id: string }>;
    for (const grant of grants) {
      await this.mutations.grantRolePermission(created.id, grant.permission_id, tenantId, actorId);
    }
    return this.getRoleDetail(tenantId, created.id);
  }

  async archiveRole(tenantId: string, actorId: string, actorRole: string, roleId: string) {
    await this.assertMutableRole(tenantId, roleId, actorRole);
    const assigned = await this.ds.query(
      `SELECT count(*)::int AS "count" FROM "org_members"
        WHERE "tenant_id" = $1 AND "role_id" = $2
          AND "is_active" = true AND "deleted_at" IS NULL`,
      [tenantId, roleId],
    ) as Array<{ count: number }>;
    if (Number(assigned[0]?.count ?? 0) > 0) {
      throw new ConflictException('Papel possui usuários ativos e não pode ser arquivado');
    }
    const changed = await this.mutations.archiveRole(roleId, tenantId, actorId);
    if (!changed) throw new NotFoundException('Papel não encontrado');
    return { archived: true };
  }

  async restoreRole(tenantId: string, actorId: string, actorRole: string, roleId: string) {
    await this.assertMutableRole(tenantId, roleId, actorRole, true);
    const changed = await this.mutations.restoreRole(roleId, tenantId, actorId);
    if (!changed) throw new NotFoundException('Papel não encontrado');
    return this.getRoleDetail(tenantId, roleId);
  }

  async grant(tenantId: string, actorId: string, actorRole: string, roleId: string, permissionId: string) {
    await this.assertMutableRole(tenantId, roleId, actorRole);
    await this.assertNoSelfEscalation(tenantId, actorId, actorRole, roleId);
    await this.assertPermission(permissionId);
    const changed = await this.mutations.grantRolePermission(roleId, permissionId, tenantId, actorId);
    if (!changed) {
      const existing = await this.ds.query(
        `SELECT 1 FROM "role_permissions" WHERE "role_id" = $1 AND "permission_id" = $2`,
        [roleId, permissionId],
      ) as unknown[];
      if (existing.length === 0) throw new NotFoundException('Papel ou permissão não encontrado');
    }
    return { granted: true };
  }

  async revoke(tenantId: string, actorId: string, actorRole: string, roleId: string, permissionId: string) {
    await this.assertMutableRole(tenantId, roleId, actorRole);
    await this.assertNoSelfEscalation(tenantId, actorId, actorRole, roleId);
    const changed = await this.mutations.revokeRolePermission(roleId, permissionId, tenantId);
    if (!changed) throw new NotFoundException('Grant não encontrado');
    return { revoked: true };
  }

  async addInheritance(
    tenantId: string,
    actorId: string,
    actorRole: string,
    roleId: string,
    parentRoleId: string,
  ): Promise<{ child_role_id: string; parent_role_id: string; tenant_id: string | null }> {
    const child = await this.assertMutableRole(tenantId, roleId, actorRole);
    await this.assertNoSelfEscalation(tenantId, actorId, actorRole, roleId);
    const parent = await this.getRoleRow(tenantId, parentRoleId);
    this.assertHierarchy(actorRole, parent.hierarchy_level);
    if (parent.hierarchy_level >= child.hierarchy_level && actorRole !== 'owner' && actorRole !== 'tenant_owner') {
      throw new ForbiddenException('Herança concederia um papel igual ou superior ao nível do administrador');
    }
    return this.mutations.createRoleInheritance(roleId, parentRoleId, tenantId, actorId);
  }

  async removeInheritance(
    tenantId: string,
    actorId: string,
    actorRole: string,
    roleId: string,
    parentRoleId: string,
  ) {
    await this.assertMutableRole(tenantId, roleId, actorRole);
    await this.assertNoSelfEscalation(tenantId, actorId, actorRole, roleId);
    const changed = await this.mutations.removeRoleInheritance(roleId, parentRoleId, tenantId, actorId);
    if (!changed) throw new NotFoundException('Herança não encontrada');
    return { removed: true };
  }

  private async getRoleRow(tenantId: string, roleId: string) {
    const rows = await this.ds.query(
      `SELECT "id", "tenant_id", "slug", "name", "description",
              "hierarchy_level", "is_system", "archived_at", "deleted_at"
         FROM "roles"
        WHERE "id" = $1
          AND ("tenant_id" = $2 OR "tenant_id" IS NULL)
          AND "deleted_at" IS NULL
        LIMIT 1`,
      [roleId, tenantId],
    ) as Array<{
      id: string;
      tenant_id: string | null;
      slug: string;
      name: string;
      description: string | null;
      hierarchy_level: number;
      is_system: boolean;
      archived_at: Date | null;
    }>;
    if (!rows[0]) throw new NotFoundException('Papel não encontrado');
    return rows[0];
  }

  private async assertMutableRole(
    tenantId: string,
    roleId: string,
    actorRole: string,
    allowArchived = false,
  ) {
    const role = await this.getRoleRow(tenantId, roleId);
    if (role.tenant_id !== tenantId || role.is_system) {
      throw new ForbiddenException('Papéis globais do sistema são somente leitura');
    }
    if (!allowArchived && role.archived_at) {
      throw new BadRequestException('Papel arquivado não pode ser alterado');
    }
    this.assertHierarchy(actorRole, role.hierarchy_level);
    return role;
  }

  private assertHierarchy(actorRole: string, targetLevel: number): void {
    const actorLevel = ROLE_HIERARCHY[actorRole] ?? 0;
    if (!['owner', 'tenant_owner', 'super_admin'].includes(actorRole) && targetLevel >= actorLevel) {
      throw new ForbiddenException('Não é permitido administrar um papel igual ou superior ao próprio nível');
    }
    if (targetLevel >= 90 && actorRole !== 'super_admin') {
      throw new ForbiddenException('Somente o sistema pode criar ou alterar papéis no nível owner');
    }
  }

  // find-986186c1: a tenant-scoped role sharing its slug with a GLOBAL
  // (tenant_id IS NULL) role shadows that global role's is_assignable/
  // hierarchy_level in UsersService.assertCanAssignRole's slug lookup --
  // letting a tenant admin create e.g. slug='super_admin' with
  // isAssignable=true to bypass the real super_admin role's
  // is_assignable=false gate and self-assign platform-wide privilege
  // (RolesGuard and the RLS app_is_super_admin() function both trust the
  // resulting org_members.role string directly). Block the collision at
  // creation time -- the authoritative source is the live global roles
  // table, not a hardcoded enum list, so this also covers any global role
  // added later without a code change here.
  private async assertSlugNotReserved(slug: string): Promise<void> {
    const [existing] = (await this.ds.query(
      `SELECT 1 FROM "roles" WHERE "tenant_id" IS NULL AND "slug" = $1 AND "deleted_at" IS NULL`,
      [slug],
    )) as unknown[];
    if (existing) {
      throw new ForbiddenException(`O identificador de papel '${slug}' é reservado pelo sistema`);
    }
  }

  private async assertNoSelfEscalation(
    tenantId: string,
    actorId: string,
    actorRole: string,
    roleId: string,
  ): Promise<void> {
    if (['owner', 'tenant_owner', 'super_admin'].includes(actorRole)) return;
    const rows = await this.ds.query(
      `SELECT 1 FROM "org_members"
        WHERE "tenant_id" = $1 AND "auth_user_id" = $2 AND "role_id" = $3
          AND "is_active" = true AND "deleted_at" IS NULL LIMIT 1`,
      [tenantId, actorId, roleId],
    ) as unknown[];
    if (rows.length > 0) {
      throw new ForbiddenException('Self-escalation de permissões não é permitida');
    }
  }

  private async assertPermission(permissionId: string): Promise<void> {
    const rows = await this.ds.query(
      `SELECT 1 FROM "permissions"
        WHERE "id" = $1 AND "deprecated_at" IS NULL AND "is_assignable" = true`,
      [permissionId],
    ) as unknown[];
    if (rows.length === 0) throw new NotFoundException('Permissão não encontrada ou não atribuível');
  }
}
