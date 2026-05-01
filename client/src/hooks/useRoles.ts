import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { QUERY_KEYS } from "@/lib/query-config";

/**
 * Roles & permissões totalmente in-memory. Sem backend, mantemos
 * apenas o usuário mock como Admin com todas as permissões padrão.
 * As mutações ficam em memória (não persistem) para a UI legada de
 * Configurações > Usuários funcionar.
 */

export interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: string;
  code: string;
  label: string;
  description: string | null;
  category: string;
  created_at: string;
}

export interface RolePermission {
  id: string;
  role_id: string;
  permission_id: string;
  created_at: string;
}

export interface TeamMember {
  id: string;
  user_id: string;
  role_id: string;
  assigned_by: string | null;
  assigned_at: string;
  role?: Role;
  email?: string;
  full_name?: string;
  status?: string;
}

export interface TeamInvite {
  id: string;
  email: string;
  role_id: string | null;
  invited_by: string;
  status: string;
  token: string;
  expires_at: string;
  created_at: string;
  role?: Role;
}

export const DEFAULT_PERMISSIONS: Omit<Permission, "id" | "created_at">[] = [
  { code: "dashboard:view", label: "Visualizar Dashboard", description: "Acessar o painel principal", category: "Dashboard" },
  { code: "artistas:view", label: "Visualizar Artistas", description: "Listar e ver detalhes de artistas", category: "Artistas" },
  { code: "artistas:create", label: "Criar Artistas", description: "Adicionar novos artistas", category: "Artistas" },
  { code: "artistas:edit", label: "Editar Artistas", description: "Modificar dados de artistas", category: "Artistas" },
  { code: "artistas:delete", label: "Excluir Artistas", description: "Remover artistas do sistema", category: "Artistas" },
  { code: "projetos:view", label: "Visualizar Projetos", description: "Listar e ver detalhes de projetos", category: "Projetos" },
  { code: "projetos:create", label: "Criar Projetos", description: "Adicionar novos projetos", category: "Projetos" },
  { code: "projetos:edit", label: "Editar Projetos", description: "Modificar dados de projetos", category: "Projetos" },
  { code: "projetos:delete", label: "Excluir Projetos", description: "Remover projetos do sistema", category: "Projetos" },
  { code: "contratos:view", label: "Visualizar Contratos", description: "Listar e ver detalhes de contratos", category: "Contratos" },
  { code: "contratos:create", label: "Criar Contratos", description: "Adicionar novos contratos", category: "Contratos" },
  { code: "contratos:edit", label: "Editar Contratos", description: "Modificar dados de contratos", category: "Contratos" },
  { code: "contratos:delete", label: "Excluir Contratos", description: "Remover contratos do sistema", category: "Contratos" },
  { code: "contratos:approve", label: "Aprovar Contratos", description: "Aprovar ou rejeitar contratos", category: "Contratos" },
  { code: "financeiro:view", label: "Visualizar Financeiro", description: "Acessar área financeira", category: "Financeiro" },
  { code: "financeiro:create", label: "Criar Transações", description: "Adicionar novas transações", category: "Financeiro" },
  { code: "financeiro:edit", label: "Editar Transações", description: "Modificar transações existentes", category: "Financeiro" },
  { code: "financeiro:delete", label: "Excluir Transações", description: "Remover transações", category: "Financeiro" },
  { code: "financeiro:reconcile", label: "Reconciliar Financeiro", description: "Realizar reconciliação financeira", category: "Financeiro" },
  { code: "financeiro:export", label: "Exportar Relatórios Financeiros", description: "Exportar dados financeiros", category: "Financeiro" },
  { code: "lancamentos:view", label: "Visualizar Lançamentos", description: "Listar e ver detalhes de lançamentos", category: "Lançamentos" },
  { code: "lancamentos:create", label: "Criar Lançamentos", description: "Adicionar novos lançamentos", category: "Lançamentos" },
  { code: "lancamentos:edit", label: "Editar Lançamentos", description: "Modificar lançamentos existentes", category: "Lançamentos" },
  { code: "lancamentos:delete", label: "Excluir Lançamentos", description: "Remover lançamentos", category: "Lançamentos" },
  { code: "musicas:view", label: "Visualizar Músicas", description: "Listar e ver detalhes de músicas", category: "Registro de Músicas" },
  { code: "musicas:create", label: "Registrar Músicas", description: "Adicionar novas músicas", category: "Registro de Músicas" },
  { code: "musicas:edit", label: "Editar Músicas", description: "Modificar dados de músicas", category: "Registro de Músicas" },
  { code: "musicas:delete", label: "Excluir Músicas", description: "Remover músicas do sistema", category: "Registro de Músicas" },
  { code: "inventario:view", label: "Visualizar Inventário", description: "Acessar o inventário", category: "Inventário" },
  { code: "inventario:create", label: "Criar Itens", description: "Adicionar novos itens ao inventário", category: "Inventário" },
  { code: "inventario:edit", label: "Editar Itens", description: "Modificar itens do inventário", category: "Inventário" },
  { code: "inventario:delete", label: "Excluir Itens", description: "Remover itens do inventário", category: "Inventário" },
  { code: "crm:view", label: "Visualizar CRM", description: "Acessar o CRM", category: "CRM" },
  { code: "crm:create", label: "Criar Contatos/Clientes", description: "Adicionar novos contatos ou clientes", category: "CRM" },
  { code: "crm:edit", label: "Editar Contatos/Clientes", description: "Modificar contatos ou clientes", category: "CRM" },
  { code: "crm:delete", label: "Excluir Contatos/Clientes", description: "Remover contatos ou clientes", category: "CRM" },
  { code: "marketing:view", label: "Visualizar Marketing", description: "Acessar área de marketing", category: "Marketing" },
  { code: "marketing:create", label: "Criar Campanhas", description: "Adicionar novas campanhas", category: "Marketing" },
  { code: "marketing:edit", label: "Editar Campanhas", description: "Modificar campanhas existentes", category: "Marketing" },
  { code: "marketing:delete", label: "Excluir Campanhas", description: "Remover campanhas", category: "Marketing" },
  { code: "marketing:publish", label: "Publicar Conteúdo", description: "Publicar conteúdo de marketing", category: "Marketing" },
  { code: "agenda:view", label: "Visualizar Agenda", description: "Acessar a agenda", category: "Agenda" },
  { code: "agenda:create", label: "Criar Eventos", description: "Adicionar novos eventos", category: "Agenda" },
  { code: "agenda:edit", label: "Editar Eventos", description: "Modificar eventos existentes", category: "Agenda" },
  { code: "agenda:delete", label: "Excluir Eventos", description: "Remover eventos", category: "Agenda" },
  { code: "relatorios:view", label: "Visualizar Relatórios", description: "Acessar relatórios", category: "Relatórios" },
  { code: "relatorios:export", label: "Exportar Relatórios", description: "Exportar relatórios", category: "Relatórios" },
  { code: "configuracoes:view", label: "Visualizar Configurações", description: "Acessar configurações", category: "Configurações" },
  { code: "configuracoes:edit", label: "Editar Configurações", description: "Modificar configurações do sistema", category: "Configurações" },
  { code: "configuracoes:manage_users", label: "Gerenciar Usuários", description: "Adicionar, editar ou remover usuários", category: "Configurações" },
  { code: "configuracoes:manage_roles", label: "Gerenciar Papéis", description: "Criar e editar papéis e permissões", category: "Configurações" },
];

export const DEFAULT_ROLES: Omit<Role, "id" | "created_at" | "updated_at">[] = [
  { name: "Admin", description: "Acesso total ao sistema", is_system: true, priority: 100 },
  { name: "Gerente", description: "Gerenciamento de operações e equipe", is_system: true, priority: 80 },
  { name: "Financeiro", description: "Acesso às funcionalidades financeiras", is_system: true, priority: 60 },
  { name: "Marketing", description: "Acesso às funcionalidades de marketing", is_system: true, priority: 50 },
  { name: "Editor", description: "Pode editar conteúdo, mas não gerenciar usuários", is_system: true, priority: 40 },
  { name: "Visualizador", description: "Apenas visualização, sem permissão de edição", is_system: true, priority: 10 },
];

const NOW = new Date().toISOString();

const memoryRoles: Role[] = DEFAULT_ROLES.map((r, idx) => ({
  ...r,
  id: `role-${idx + 1}`,
  created_at: NOW,
  updated_at: NOW,
}));

const memoryPermissions: Permission[] = DEFAULT_PERMISSIONS.map((p, idx) => ({
  ...p,
  id: `perm-${idx + 1}`,
  created_at: NOW,
}));

const memoryRolePermissions: RolePermission[] = memoryPermissions.map((perm, idx) => ({
  id: `rp-${idx + 1}`,
  role_id: memoryRoles[0].id,
  permission_id: perm.id,
  created_at: NOW,
}));

const memoryTeamMembers: TeamMember[] = [];
const memoryTeamInvites: TeamInvite[] = [];

export function useRoles() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: [...QUERY_KEYS.ROLES],
    queryFn: async () => memoryRoles.slice(),
  });

  const { data: permissions = [] } = useQuery<Permission[]>({
    queryKey: [...QUERY_KEYS.PERMISSIONS],
    queryFn: async () => memoryPermissions.slice(),
  });

  const { data: rolePermissions = [] } = useQuery<RolePermission[]>({
    queryKey: ["/api/role-permissions"],
    queryFn: async () => memoryRolePermissions.slice(),
  });

  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ["/api/team-members"],
    queryFn: async () => memoryTeamMembers.slice(),
  });

  const { data: teamInvites = [] } = useQuery<TeamInvite[]>({
    queryKey: ["/api/team-invites"],
    queryFn: async () => memoryTeamInvites.slice(),
  });

  const createRole = useMutation({
    mutationFn: async (role: Omit<Role, "id" | "created_at" | "updated_at">) => {
      const newRole: Role = {
        ...role,
        id: `role-${memoryRoles.length + 1}`,
        created_at: NOW,
        updated_at: NOW,
      };
      memoryRoles.push(newRole);
      return newRole;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.ROLES] }),
  });

  const updateRole = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Role> & { id: string }) => {
      const idx = memoryRoles.findIndex((r) => r.id === id);
      if (idx >= 0) {
        memoryRoles[idx] = { ...memoryRoles[idx], ...updates, updated_at: new Date().toISOString() };
      }
      return memoryRoles[idx];
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.ROLES] }),
  });

  const deleteRole = useMutation({
    mutationFn: async (id: string) => {
      const idx = memoryRoles.findIndex((r) => r.id === id);
      if (idx >= 0) memoryRoles.splice(idx, 1);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.ROLES] }),
  });

  const assignPermissionToRole = useMutation({
    mutationFn: async ({ roleId, permissionId }: { roleId: string; permissionId: string }) => {
      const exists = memoryRolePermissions.some(
        (rp) => rp.role_id === roleId && rp.permission_id === permissionId,
      );
      if (!exists) {
        memoryRolePermissions.push({
          id: `rp-${memoryRolePermissions.length + 1}`,
          role_id: roleId,
          permission_id: permissionId,
          created_at: NOW,
        });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/role-permissions"] }),
  });

  const removePermissionFromRole = useMutation({
    mutationFn: async ({ roleId, permissionId }: { roleId: string; permissionId: string }) => {
      const idx = memoryRolePermissions.findIndex(
        (rp) => rp.role_id === roleId && rp.permission_id === permissionId,
      );
      if (idx >= 0) memoryRolePermissions.splice(idx, 1);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/role-permissions"] }),
  });

  const assignRoleToUser = useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string }) => {
      const idx = memoryTeamMembers.findIndex((m) => m.user_id === userId);
      const entry: TeamMember = {
        id: idx >= 0 ? memoryTeamMembers[idx].id : `tm-${memoryTeamMembers.length + 1}`,
        user_id: userId,
        role_id: roleId,
        assigned_by: user?.id ?? null,
        assigned_at: new Date().toISOString(),
      };
      if (idx >= 0) memoryTeamMembers[idx] = entry;
      else memoryTeamMembers.push(entry);
      return entry;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/team-members"] }),
  });

  const removeUserRole = useMutation({
    mutationFn: async (userId: string) => {
      const idx = memoryTeamMembers.findIndex((m) => m.user_id === userId);
      if (idx >= 0) memoryTeamMembers.splice(idx, 1);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/team-members"] }),
  });

  const inviteUser = useMutation({
    mutationFn: async ({ email, roleId }: { email: string; roleId?: string }) => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      const invite: TeamInvite = {
        id: `inv-${memoryTeamInvites.length + 1}`,
        email,
        role_id: roleId ?? null,
        invited_by: user?.id ?? "mock",
        status: "pending",
        token: crypto.randomUUID(),
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
      };
      memoryTeamInvites.push(invite);
      return invite;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/team-invites"] }),
  });

  const cancelInvite = useMutation({
    mutationFn: async (inviteId: string) => {
      const idx = memoryTeamInvites.findIndex((inv) => inv.id === inviteId);
      if (idx >= 0) memoryTeamInvites[idx].status = "cancelled";
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/team-invites"] }),
  });

  const getPermissionsForRole = (roleId: string): Permission[] => {
    const ids = rolePermissions
      .filter((rp) => rp.role_id === roleId)
      .map((rp) => rp.permission_id);
    return permissions.filter((p) => ids.includes(p.id));
  };

  const getRoleForUser = (userId: string): Role | undefined => {
    const memberRole = teamMembers.find((tm) => tm.user_id === userId);
    if (!memberRole) return undefined;
    return roles.find((r) => r.id === memberRole.role_id);
  };

  const getPermissionsByCategory = () => {
    const grouped: Record<string, Permission[]> = {};
    permissions.forEach((p) => {
      if (!grouped[p.category]) grouped[p.category] = [];
      grouped[p.category].push(p);
    });
    return grouped;
  };

  return {
    roles,
    permissions,
    rolePermissions,
    teamMembers,
    teamInvites,
    isLoading: false,
    createRole,
    updateRole,
    deleteRole,
    assignPermissionToRole,
    removePermissionFromRole,
    assignRoleToUser,
    removeUserRole,
    inviteUser,
    cancelInvite,
    getPermissionsForRole,
    getRoleForUser,
    getPermissionsByCategory,
  };
}
