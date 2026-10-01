import { Injectable, ForbiddenException } from '@nestjs/common';
import { SystemRole, FunctionalRole } from '@music-os-360/types';
import { PermissionResolverService, type MemberAuthzContext } from './permission-resolver.service';
import { ENGLISH_ROLE_ALIASES, ROLE_HIERARCHY, roleLevel } from './role-hierarchy';

export type { MemberAuthzContext };

/**
 * AnyRole — union of system roles and functional roles.
 * SystemRole: hierarchical roles stored in OrgMemberEntity.role
 * FunctionalRole: operational/domain roles (financial, marketing, etc.)
 */
export type AnyRole = SystemRole | FunctionalRole;

/**
 * @deprecated Use SystemRole from @music-os-360/types
 * Kept for compatibility with legacy code that imports from here.
 */
export type Role = AnyRole;

/**
 * Numeric hierarchy of the SystemRoles — the higher the number, the more permissions.
 * Single source: `./role-hierarchy` (the same one used by RolesGuard). Re-exported here
 * (PHASE 8) for the roles seed; before, it was an independent literal copy that
 * could silently diverge from the copy actually applied by the guard.
 */
export { ROLE_HIERARCHY };

export type Resource =
  | 'artist'
  | 'catalog'
  | 'contracts'
  | 'accounting'
  | 'crm'
  | 'marketing'
  | 'monitoring'
  | 'releases'
  | 'projects'
  | 'events'
  | 'inventory'
  | 'rh'
  | 'hr'
  | 'settings'
  | 'licensing'
  | 'leads'
  | 'analytics';

/**
 * RBAC `hr` module key. Persisted permission rows (and the seed matrix above) still spell it `rh:*`
 * until the gated S4b rename (migration-drafts/20260930000051_RenameLegacyHrPermissionsInPlace.ts).
 * Both spellings are accepted on read: a grant of `rh:x` is a grant of `hr:x` and vice versa
 * (same action only, never widened). Nothing is written under `hr:*` by the seed.
 */
export function expandHrPermissionAliases(permissions: readonly string[]): string[] {
  const out = new Set<string>(permissions);
  for (const key of permissions) {
    if (key.startsWith('rh:')) out.add(`hr:${key.slice(3)}`);
    else if (key.startsWith('hr:')) out.add(`rh:${key.slice(3)}`);
  }
  return [...out];
}

export type Action = 'read' | 'create' | 'update' | 'delete' | 'export' | 'approve';

// Exported (PHASE 8) as the parity SOURCE for the permissions/role_permissions seed.
// NOT removed nor changed — it remains the legacy fallback matrix (PHASE 5).
export const ROLE_PERMISSIONS: Record<string, Array<`${Resource}:${Action}`>> = {
  // ── System Roles ────────────────────────────────────────────────────────────
  [SystemRole.SUPER_ADMIN]: [
    'artist:read','artist:create','artist:update','artist:delete',
    'catalog:read','catalog:create','catalog:update','catalog:delete',
    'contracts:read','contracts:create','contracts:update','contracts:delete',
    'accounting:read','accounting:create','accounting:update','accounting:delete','accounting:export',
    'crm:read','crm:create','crm:update','crm:delete',
    'marketing:read','marketing:create','marketing:update','marketing:delete',
    'monitoring:read','monitoring:create','monitoring:update','monitoring:delete',
    'releases:read','releases:create','releases:update','releases:delete','releases:approve',
    'projects:read','projects:create','projects:update','projects:delete',
    'events:read','events:create','events:update','events:delete',
    'inventory:read','inventory:create','inventory:update','inventory:delete',
    'rh:read','rh:create','rh:update','rh:delete',
    'settings:read','settings:update',
    'licensing:read','licensing:create','licensing:update','licensing:delete',
    'leads:read','leads:create','leads:update','leads:delete',
    'analytics:read',
  ],
  [SystemRole.TENANT_OWNER]: [
    'artist:read','artist:create','artist:update','artist:delete',
    'catalog:read','catalog:create','catalog:update','catalog:delete',
    'contracts:read','contracts:create','contracts:update','contracts:delete',
    'accounting:read','accounting:create','accounting:update','accounting:delete','accounting:export',
    'crm:read','crm:create','crm:update','crm:delete',
    'marketing:read','marketing:create','marketing:update','marketing:delete',
    'releases:read','releases:create','releases:update','releases:delete','releases:approve',
    'settings:read','settings:update',
    'leads:read','leads:create','leads:update',
    'analytics:read',
  ],
  [SystemRole.OWNER]: [
    'artist:read','artist:create','artist:update','artist:delete',
    'catalog:read','catalog:create','catalog:update','catalog:delete',
    'contracts:read','contracts:create','contracts:update','contracts:delete',
    'accounting:read','accounting:create','accounting:update','accounting:delete','accounting:export',
    'crm:read','crm:create','crm:update','crm:delete',
    'marketing:read','marketing:create','marketing:update','marketing:delete',
    'releases:read','releases:create','releases:update','releases:delete','releases:approve',
    'settings:read','settings:update',
    'leads:read','leads:create','leads:update',
    'analytics:read',
  ],
  [SystemRole.ADMIN]: [
    'artist:read','artist:create','artist:update','artist:delete',
    'catalog:read','catalog:create','catalog:update','catalog:delete',
    'contracts:read','contracts:create','contracts:update','contracts:delete',
    'accounting:read','accounting:create','accounting:update','accounting:delete',
    'settings:read','settings:update',
    'releases:read','releases:create','releases:update',
    'crm:read','crm:create','crm:update',
    'leads:read','leads:create','leads:update',
    'analytics:read',
  ],
  [SystemRole.MANAGER]: [
    'artist:read','artist:create','artist:update',
    'catalog:read','catalog:create','catalog:update',
    'contracts:read','contracts:create',
    'accounting:read',
    'crm:read','crm:create','crm:update',
    'marketing:read','marketing:create','marketing:update',
    'releases:read','releases:create',
    'leads:read','leads:create','leads:update',
  ],
  [SystemRole.EDITOR]: [
    'artist:read','artist:update',
    'catalog:read','catalog:create','catalog:update',
    'releases:read','releases:create','releases:update',
    'marketing:read','marketing:create','marketing:update',
  ],
  [SystemRole.VIEWER]: [
    'artist:read',
    'catalog:read',
    'releases:read',
  ],
  // ── Functional Roles ────────────────────────────────────────────────────────
  [FunctionalRole.FINANCIAL]: [
    'accounting:read','accounting:create','accounting:update','accounting:delete','accounting:export',
    'artist:read',
    'contracts:read',
  ],
  [FunctionalRole.MARKETING]: [
    'marketing:read','marketing:create','marketing:update','marketing:delete',
    'analytics:read',
    'releases:read','releases:create',
    'artist:read',
    'catalog:read',
  ],
  [FunctionalRole.ARTIST]: [
    'artist:read',
    'catalog:read',
    'releases:read',
  ],
  [FunctionalRole.RADIO]: [
    'catalog:read',
    'monitoring:read',
    'licensing:read',
  ],
  [FunctionalRole.TV]: [
    'catalog:read',
    'monitoring:read',
    'licensing:read',
  ],
  [FunctionalRole.ACCOUNTING]: [
    'accounting:read','accounting:create','accounting:update','accounting:delete','accounting:export',
    'artist:read',
    'contracts:read',
  ],
  [FunctionalRole.JURIDICO]: [
    'contracts:read','contracts:create','contracts:update',
    'artist:read',
    'licensing:read','licensing:create','licensing:update',
  ],
  [FunctionalRole.MARKETING_MANAGER]: [
    'marketing:read','marketing:create','marketing:update','marketing:delete','marketing:approve',
    'analytics:read',
    'releases:read','releases:create','releases:update',
    'artist:read',
    'catalog:read',
    'leads:read','leads:create','leads:update',
  ],
  [FunctionalRole.ARTISTA]: [
    'artist:read',
    'catalog:read',
    'releases:read',
  ],
  [FunctionalRole.PRODUTOR]: [
    'artist:read',
    'catalog:read','catalog:create','catalog:update',
    'releases:read','releases:create','releases:update',
    'projects:read','projects:create','projects:update',
  ],
  [FunctionalRole.COMERCIAL]: [
    'crm:read','crm:create','crm:update',
    'leads:read','leads:create','leads:update','leads:delete',
    'artist:read',
    'contracts:read',
  ],
  [FunctionalRole.COLABORADOR]: [
    'artist:read',
    'catalog:read',
    'releases:read',
  ],
  [FunctionalRole.RH_MANAGER]: [
    'rh:read','rh:create','rh:update','rh:delete',
    'artist:read',
  ],
};

// RBAC expand step: an English alias grants exactly the permissions of its canonical Portuguese role
// (same as the seed, where aliases inherit through roles.canonical_role_id). Copied, never widened.
for (const [alias, canonical] of Object.entries(ENGLISH_ROLE_ALIASES)) {
  ROLE_PERMISSIONS[alias] = [...ROLE_PERMISSIONS[canonical]];
}

@Injectable()
export class RbacService {
  constructor(private readonly resolver: PermissionResolverService) {}

  /**
   * The member's effective permissions (DUAL-SOURCE — PHASE 5).
   * role_id present → database matrix (roles/role_permissions, with canonical alias and tenant
   * scope). No role_id (or DB unavailable / empty matrix during the transition) → this
   * service's legacy matrix, identical to the behavior before PHASE 4. Never widens access by mistake.
   *
   * Does NOT replace RolesGuard (hierarchy enforcement stays unchanged in this phase);
   * it is consumed by auth-context to expose membership.permissions.
   */
  async getEffectivePermissions(member: MemberAuthzContext): Promise<string[]> {
    const legacyRole = typeof member.role === 'string' && member.role.length > 0 ? member.role : SystemRole.VIEWER;
    return expandHrPermissionAliases(await this.resolver.resolve(member, () => this.getPermissions(legacyRole)));
  }

  hasRole(userRole: string, required: string): boolean {
    // Fail closed: an unknown required role must never be satisfiable (it used to count as level 0,
    // so every caller passed). Mirrors RolesGuard, where an unknown required role counts as level 99.
    if (!Object.prototype.hasOwnProperty.call(ROLE_HIERARCHY, required)) return false;
    return (roleLevel(userRole) ?? 0) >= ROLE_HIERARCHY[required];
  }

  can(role: string, resource: Resource, action: Action): boolean {
    const perms = expandHrPermissionAliases(this.getPermissions(role));
    return perms.includes(`${resource}:${action}`);
  }

  assertCan(role: string, resource: Resource, action: Action): void {
    if (!this.can(role, resource, action)) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'PERMISSION_DENIED',
        message: 'Você não tem permissão para realizar esta ação.',
      });
    }
  }

  getPermissions(role: string): string[] {
    // Own-property only: `constructor`/`__proto__` must not resolve to inherited objects.
    return Object.prototype.hasOwnProperty.call(ROLE_PERMISSIONS, role) ? ROLE_PERMISSIONS[role] : [];
  }

  getHierarchyLevel(role: string): number {
    return roleLevel(role) ?? 0;
  }

  isSystemRole(role: string): role is SystemRole {
    return Object.values(SystemRole).includes(role as SystemRole);
  }

  isFunctionalRole(role: string): role is FunctionalRole {
    return Object.values(FunctionalRole).includes(role as FunctionalRole);
  }
}
