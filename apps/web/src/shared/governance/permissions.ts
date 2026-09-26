/**
 * shared/governance/permissions.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * MUSIC OS 360 — RBAC Permission System (Role-Based Access Control)
 *
 * Documents the system's permission model: roles, modules,
 * operations and restrictions per billing plan.
 *
 * Implementation source: app/providers/TenantContext.tsx
 * Types: TenantRole, TenantModuleKey, TenantModulePermission, TenantPermissions
 *
 * RULE: every UI that restricts access MUST use useTenant().hasPermission()
 *        or check feature flags via tenant.features.
 *        FORBIDDEN: checking roles directly in components.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { TenantRole, TenantModuleKey } from "@/app/providers/TenantContext";

// ─── Documentation types ──────────────────────────────────────────────────────

export interface RoleDescription {
  role: TenantRole;
  name: string;
  description: string;
  canInviteRoles: TenantRole[];
  restrictions: string[];
}

export interface OperationPermission {
  operation: "read" | "write" | "delete" | "export";
  description: string;
  minRole: TenantRole;
}

export interface ModuleAccessPolicy {
  module: TenantModuleKey;
  operations: OperationPermission[];
  planRestrictions: Partial<Record<"starter" | "professional" | "enterprise", string>>;
  notes: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAPÉIS DO SISTEMA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Role hierarchy (descending order of power):
 *   owner > admin > manager > editor > viewer
 *
 * RULE: a user may only invite users with roles
 *        equal to or lower than their own.
 */
export const ROLE_DESCRIPTIONS: Record<TenantRole, RoleDescription> = {

  owner: {
    role:          "owner",
    name:          "Proprietário",
    description:
      "Controlo total do tenant: billing, utilizadores, configurações, " +
      "todos os módulos. Não pode ser removido por outros papéis. " +
      "Um tenant tem exactamente um owner (pode ser transferido).",
    canInviteRoles: ["admin", "manager", "editor", "viewer"],
    restrictions:  [],
  },

  admin: {
    role:          "admin",
    name:          "Administrador",
    description:
      "Acesso total a todos os módulos e operações. " +
      "Pode gerir utilizadores excluindo o owner. " +
      "Não acede a configurações de billing (reservado ao owner).",
    canInviteRoles: ["manager", "editor", "viewer"],
    restrictions:  [
      "Não pode alterar plano de billing",
      "Não pode remover o owner",
      "Não pode transferir ownership",
    ],
  },

  manager: {
    role:          "manager",
    name:          "Gestor",
    description:
      "Acesso de escrita a todos os módulos operacionais. " +
      "Acesso de leitura a auditoria e configurações. " +
      "Não pode gerir utilizadores nem alterar configurações do tenant.",
    canInviteRoles: ["editor", "viewer"],
    restrictions:  [
      "Leitura em auditoria e configurações (sem escrita)",
      "Não pode gerir utilizadores",
      "Não pode alterar configurações do tenant",
    ],
  },

  editor: {
    role:          "editor",
    name:          "Editor",
    description:
      "Pode criar e editar registos em todos os módulos operacionais. " +
      "Não pode eliminar registos nem aceder a auditoria ou configurações. " +
      "Típico para colaboradores de produção e marketing.",
    canInviteRoles: [],
    restrictions:  [
      "Sem acesso a auditoria",
      "Sem acesso a configurações",
      "Sem permissão de eliminação em nenhum módulo",
      "Não pode convidar novos utilizadores",
    ],
  },

  viewer: {
    role:          "viewer",
    name:          "Visualizador",
    description:
      "Acesso de leitura e exportação a todos os módulos operacionais. " +
      "Não pode criar, editar ou eliminar nada. " +
      "Típico para stakeholders externos, auditores, artistas com acesso ao ERP.",
    canInviteRoles: [],
    restrictions:  [
      "Apenas leitura e exportação",
      "Sem acesso a auditoria",
      "Sem acesso a configurações",
      "Não pode convidar novos utilizadores",
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// PERMISSION MATRIX PER MODULE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Permission table per module and role.
 * Implemented in: ROLE_PERMISSIONS (TenantContext.tsx).
 *
 * Legend:
 *   ✓ = allowed    ✗ = forbidden    R = read only
 *
 * Module         | owner | admin | manager | editor | viewer
 * ─────────────────────────────────────────────────────────────
 * artists        |  ✓✓✓✓ |  ✓✓✓✓ |   ✓✓✓✓  |  ✓✓✗✓  |  R
 * catalog        |  ✓✓✓✓ |  ✓✓✓✓ |   ✓✓✓✓  |  ✓✓✗✓  |  R
 * releases       |  ✓✓✓✓ |  ✓✓✓✓ |   ✓✓✓✓  |  ✓✓✗✓  |  R
 * contracts      |  ✓✓✓✓ |  ✓✓✓✓ |   ✓✓✓✓  |  ✓✓✗✓  |  R
 * accounting     |  ✓✓✓✓ |  ✓✓✓✓ |   ✓✓✓✓  |  ✓✓✗✓  |  R
 * crm            |  ✓✓✓✓ |  ✓✓✓✓ |   ✓✓✓✓  |  ✓✓✗✓  |  R
 * marketing      |  ✓✓✓✓ |  ✓✓✓✓ |   ✓✓✓✓  |  ✓✓✗✓  |  R
 * events         |  ✓✓✓✓ |  ✓✓✓✓ |   ✓✓✓✓  |  ✓✓✗✓  |  R
 * inventory      |  ✓✓✓✓ |  ✓✓✓✓ |   ✓✓✓✓  |  ✓✓✗✓  |  R
 * rh             |  ✓✓✓✓ |  ✓✓✓✓ |   ✓✓✓✓  |  ✓✓✗✓  |  R
 * monitoring     |  ✓✓✓✓ |  ✓✓✓✓ |   ✓✓✓✓  |  ✓✓✗✓  |  R
 * licensing      |  ✓✓✓✓ |  ✓✓✓✓ |   ✓✓✓✓  |  ✓✓✗✓  |  R
 * projects       |  ✓✓✓✓ |  ✓✓✓✓ |   ✓✓✓✓  |  ✓✓✗✓  |  R
 * leads          |  ✓✓✓✓ |  ✓✓✓✓ |   ✓✓✓✓  |  ✓✓✗✓  |  R
 * audit          |  ✓✓✓✓ |  ✓✓✓✓ |     R   |  ✗✗✗✗  | ✗✗✗✗
 * settings       |  ✓✓✓✓ |  ✓✓✓✓ |     R   |  ✗✗✗✗  | ✗✗✗✗
 *
 * Format ✓✓✓✓: read.write.delete.export
 */
export const PERMISSION_MATRIX_DOCS = `
Módulo         | owner | admin | manager | editor | viewer
─────────────────────────────────────────────────────────────
artists        | FULL  | FULL  |  FULL   | R/W/-/E|  R/-/-/E
catalog        | FULL  | FULL  |  FULL   | R/W/-/E|  R/-/-/E
releases       | FULL  | FULL  |  FULL   | R/W/-/E|  R/-/-/E
contracts      | FULL  | FULL  |  FULL   | R/W/-/E|  R/-/-/E
accounting     | FULL  | FULL  |  FULL   | R/W/-/E|  R/-/-/E
crm            | FULL  | FULL  |  FULL   | R/W/-/E|  R/-/-/E
marketing      | FULL  | FULL  |  FULL   | R/W/-/E|  R/-/-/E
events         | FULL  | FULL  |  FULL   | R/W/-/E|  R/-/-/E
inventory      | FULL  | FULL  |  FULL   | R/W/-/E|  R/-/-/E
rh             | FULL  | FULL  |  FULL   | R/W/-/E|  R/-/-/E
monitoring     | FULL  | FULL  |  FULL   | R/W/-/E|  R/-/-/E
licensing      | FULL  | FULL  |  FULL   | R/W/-/E|  R/-/-/E
projects       | FULL  | FULL  |  FULL   | R/W/-/E|  R/-/-/E
leads          | FULL  | FULL  |  FULL   | R/W/-/E|  R/-/-/E
audit          | FULL  | FULL  | R/-/-/E |  NONE  |  NONE
settings       | FULL  | FULL  | R/-/-/E |  NONE  |  NONE

FULL = read + write + delete + export
R    = read only
E    = export
-    = denied
`;

// ═══════════════════════════════════════════════════════════════════════════════
// RESTRICTIONS PER PLAN
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Modules blocked per billing plan.
 * Implemented in: PLAN_FLAGS (shared/lib/feature-flags.ts).
 *
 * starter (entry-level):
 *   - monitoring disabled
 *   - licensing disabled
 *   - rh disabled
 *   - auditLog disabled
 *   - bulkActions disabled
 *   - analyticsAdvanced disabled
 *
 * professional (mid-tier):
 *   - analyticsAdvanced disabled
 * *   - multiTenantAdmin disabled
 *
 * enterprise (full):
 *   - every module and feature enabled
 */
export const PLAN_ACCESS_RESTRICTIONS: Record<
  "starter" | "professional" | "enterprise",
  { blockedModules: TenantModuleKey[]; blockedFeatures: string[] }
> = {
  starter: {
    blockedModules:  ["monitoring", "licensing", "rh", "audit"],
    blockedFeatures: ["auditLog", "bulkActions", "analyticsAdvanced",
                      "aiFeatures", "multiTenantAdmin", "billingPortal",
                      "storageR2", "rbacAdvanced"],
  },
  professional: {
    blockedModules:  [],
    blockedFeatures: ["analyticsAdvanced", "multiTenantAdmin"],
  },
  enterprise: {
    blockedModules:  [],
    blockedFeatures: [],
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// USAGE PATTERN IN THE UI
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * HOW TO CHECK PERMISSIONS IN THE UI:
 *
 * 1. Module check (read access):
 *    const { tenant } = useTenant();
 *    if (!tenant.permissions.artists.read) return <NoAccess />;
 *
 * 2. Operation check:
 *    const canWrite = tenant.permissions.accounting.write;
 *    <Button disabled={!canWrite}>{createTransactionLabel}</Button>
 *
 * 3. Feature flag check:
 *    const { tenant } = useTenant();
 *    if (!tenant.features.moduleMonitoring) return <UpgradePrompt />;
 *
 * 4. Protected route (AdminRoute):
 *    <AdminRoute roles={["owner", "admin"]}>
 *      <AuditPage />
 *    </AdminRoute>
 *
 * FORBIDDEN:
 *   - Checking tenant.role directly (use the permissions object)
 *   - Hiding elements via CSS instead of not rendering them
 *   - Checking permissions in services (only in the UI or the future backend)
 */
export const PERMISSION_USAGE_PATTERN = {
  moduleAccess:   "tenant.permissions[moduleKey].read",
  writeAccess:    "tenant.permissions[moduleKey].write",
  deleteAccess:   "tenant.permissions[moduleKey].delete",
  exportAccess:   "tenant.permissions[moduleKey].export",
  featureFlag:    "tenant.features[featureFlagKey]",
  adminRoute:     "AdminRoute roles={['owner', 'admin']}",
  forbidden: [
    "verificar tenant.role directamente",
    "esconder via CSS (usar renderização condicional)",
    "verificar permissões em serviços/mappers",
  ],
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// SENSITIVE DATA — Access policy
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fields that require special access handling:
 *
 * CPF/CNPJ:
 *   - Visible only to owner, admin, manager
 *   - Masked for editor and viewer (e.g. ***.123.456-**)
 *   - FUTURE: encryption at rest in the backend
 *
 * Salaries (Funcionario.salario):
 *   - Visible only to owner and admin
 *   - Completely hidden for manager, editor, viewer
 *
 * Integration credentials (musicos360_<id>_credentials):
 *   - Never visible in the UI (asterisks only)
 *   - Deleted on logout
 *   - FUTURE: stored encrypted in the backend (Vault)
 *
 * Financial data (Transacao.valor, NotaFiscal.valor_total):
 *   - Visible to owner, admin, manager (with export)
 *   - Visible to editor (without full report export)
 *   - Masked for viewer in list contexts
 *
 * Authentication keys:
 *   - musicos360_rt → deleted on logout
 *   - Never exposed in logs or the console
 */
export const SENSITIVE_DATA_POLICY = {
  cpfCnpj: {
    visibleFor: ["owner", "admin", "manager"] as TenantRole[],
    maskedFor:  ["editor", "viewer"] as TenantRole[],
    maskPattern: "***.XXX.XXX-**",
  },
  salarios: {
    visibleFor: ["owner", "admin"] as TenantRole[],
    hiddenFor:  ["manager", "editor", "viewer"] as TenantRole[],
  },
  integrationCredentials: {
    visibleFor:  [] as TenantRole[],
    neverDisplay: true,
    storageNote:  "localStorage apenas em modo standalone; backend Vault no futuro",
  },
  authTokens: {
    clearOnLogout: true,
    neverLog:      true,
    keys:          ["musicos360_rt"],
  },
} as const;
