import { Injectable, ForbiddenException } from '@nestjs/common';
import { SystemRole, FunctionalRole } from '@music-os-360/types';
import { PermissionResolverService, type MemberAuthzContext } from './permission-resolver.service';
import { ROLE_HIERARCHY } from './role-hierarchy';

export type { MemberAuthzContext };

/**
 * AnyRole — union de roles de sistema e roles funcionais.
 * SystemRole: roles hierárquicos armazenados em OrgMemberEntity.role
 * FunctionalRole: roles operacionais/domínio (financial, marketing, etc.)
 */
export type AnyRole = SystemRole | FunctionalRole;

/**
 * @deprecated Use SystemRole de @music-os-360/types
 * Mantido para compatibilidade com código legado que importa daqui.
 */
export type Role = AnyRole;

/**
 * Hierarquia numérica dos SystemRoles — quanto maior o número, mais permissões.
 * Fonte única: `./role-hierarchy` (mesma usada por RolesGuard). Re-exportado aqui
 * (FASE 8) para o seed de roles; antes era uma cópia literal independente que
 * podia divergir silenciosamente da cópia realmente aplicada pelo guard.
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
  | 'settings'
  | 'licensing'
  | 'leads'
  | 'analytics';

export type Action = 'read' | 'create' | 'update' | 'delete' | 'export' | 'approve';

// Exportado (FASE 8) como FONTE de paridade para o seed de permissions/role_permissions.
// NÃO removido nem alterado — continua sendo a matriz legada do fallback (FASE 5).
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

@Injectable()
export class RbacService {
  constructor(private readonly resolver: PermissionResolverService) {}

  /**
   * Permissões efetivas do membro (DUAL-SOURCE — FASE 5).
   * role_id presente → matriz do banco (roles/role_permissions, com alias canônico e escopo de
   * tenant). Sem role_id (ou DB indisponível / matriz vazia na transição) → matriz legada deste
   * serviço, idêntica ao comportamento anterior à FASE 4. Nunca amplia acesso por erro.
   *
   * NÃO substitui o RolesGuard (enforcement por hierarquia continua inalterado nesta fase);
   * é consumido pelo auth-context para expor membership.permissions.
   */
  async getEffectivePermissions(member: MemberAuthzContext): Promise<string[]> {
    const legacyRole = typeof member.role === 'string' && member.role.length > 0 ? member.role : SystemRole.VIEWER;
    return this.resolver.resolve(member, () => this.getPermissions(legacyRole));
  }

  hasRole(userRole: string, required: string): boolean {
    return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[required] ?? 0);
  }

  can(role: string, resource: Resource, action: Action): boolean {
    const perms = ROLE_PERMISSIONS[role] ?? [];
    return perms.includes(`${resource}:${action}`);
  }

  assertCan(role: string, resource: Resource, action: Action): void {
    if (!this.can(role, resource, action)) {
      throw new ForbiddenException(
        `Permissão negada: role '${role}' não pode realizar '${action}' em '${resource}'`,
      );
    }
  }

  getPermissions(role: string): string[] {
    return ROLE_PERMISSIONS[role] ?? [];
  }

  getHierarchyLevel(role: string): number {
    return ROLE_HIERARCHY[role] ?? 0;
  }

  isSystemRole(role: string): role is SystemRole {
    return Object.values(SystemRole).includes(role as SystemRole);
  }

  isFunctionalRole(role: string): role is FunctionalRole {
    return Object.values(FunctionalRole).includes(role as FunctionalRole);
  }
}
