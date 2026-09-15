import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/lib/api-client";
import { QUERY_KEYS } from "@/shared/lib/query-config";

export interface Role {
  id: string;
  tenant_id?: string | null;
  slug: string;
  name: string;
  description: string | null;
  is_system: boolean;
  is_assignable?: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
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

export interface RoleDetail extends Role {
  permissions: Array<Permission & {
    source: "direct" | "inherited";
    source_role_id: string;
    source_role_name: string;
    source_role_slug: string;
    depth: number;
  }>;
  inheritance: Array<{
    id: string;
    parent_role_id: string;
    parent_role_name: string;
    parent_role_slug: string;
    created_at: string;
  }>;
  impactedUsers: Array<{
    id: string;
    auth_user_id: string;
    email: string;
    full_name: string | null;
    is_active: boolean;
  }>;
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
  token?: string;
  expires_at: string;
  created_at: string;
  role?: Role;
}

interface UsersPage {
  data: Array<{
    id: string;
    auth_user_id: string;
    role_id: string | null;
    email: string;
    full_name: string | null;
    is_active: boolean;
    created_at: string;
  }>;
}

export interface RbacAuthorityMode {
  mode: "OFF" | "SHADOW" | "ON";
  enforced: boolean;
}

export function useRoles() {
  const queryClient = useQueryClient();

  const rolesQuery = useQuery<Role[]>({
    queryKey: [...QUERY_KEYS.ROLES],
    queryFn: () => api.get<Role[]>("/rbac/roles?includeArchived=true"),
  });
  /**
   * CODEBASE_MAP Gotcha #17: without this, the editor below gives no
   * indication that a granted/revoked permission may not actually be
   * enforced (RBAC_PERSISTED_AUTHORITY=SHADOW). See Configuracoes.tsx's
   * disclosure banner, which reads authorityModeQuery.data.
   */
  const authorityModeQuery = useQuery<RbacAuthorityMode>({
    queryKey: ["rbac_authority_mode"],
    queryFn: () => api.get<RbacAuthorityMode>("/rbac/authority-mode"),
  });
  const permissionsQuery = useQuery<Permission[]>({
    queryKey: [...QUERY_KEYS.PERMISSIONS],
    queryFn: () => api.get<Permission[]>("/rbac/permissions"),
  });
  const grantsQuery = useQuery<RolePermission[]>({
    queryKey: ["role_permissions"],
    queryFn: () => api.get<RolePermission[]>("/rbac/grants"),
  });
  const membersQuery = useQuery<UsersPage>({
    queryKey: ["team_members"],
    queryFn: () => api.get<UsersPage>("/users?limit=100"),
  });
  const invitesQuery = useQuery<TeamInvite[]>({
    queryKey: ["team_invitations"],
    queryFn: () => api.get<TeamInvite[]>("/users/invitations"),
  });

  const roles = rolesQuery.data ?? [];
  const permissions = permissionsQuery.data ?? [];
  const rolePermissions = grantsQuery.data ?? [];
  const teamMembers: TeamMember[] = (membersQuery.data?.data ?? []).map((member) => ({
    id: member.id,
    user_id: member.auth_user_id,
    role_id: member.role_id ?? "",
    assigned_by: null,
    assigned_at: member.created_at,
    email: member.email,
    full_name: member.full_name ?? undefined,
    status: member.is_active ? "active" : "inactive",
    role: roles.find((role) => role.id === member.role_id),
  }));

  const invalidateRbac = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.ROLES] }),
      queryClient.invalidateQueries({ queryKey: ["role_permissions"] }),
      queryClient.invalidateQueries({ queryKey: ["team_members"] }),
      queryClient.invalidateQueries({ queryKey: ["team_invitations"] }),
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.USERS] }),
    ]);
  };

  const createRole = useMutation({
    mutationFn: (role: Omit<Role, "id" | "created_at" | "updated_at" | "slug"> & {
      slug?: string;
      permissionIds?: string[];
    }) => api.post<Role>("/rbac/roles", {
      name: role.name,
      description: role.description,
      slug: role.slug,
      isAssignable: role.is_assignable ?? true,
      permissionIds: role.permissionIds ?? [],
    }),
    onSuccess: invalidateRbac,
  });

  const updateRole = useMutation({
    mutationFn: ({ id, ...role }: Partial<Role> & { id: string }) =>
      api.patch<Role>(`/rbac/roles/${id}`, {
        name: role.name,
        description: role.description,
        isAssignable: role.is_assignable,
      }),
    onSuccess: invalidateRbac,
  });

  const duplicateRole = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.post<Role>(`/rbac/roles/${id}/duplicate`, { name }),
    onSuccess: invalidateRbac,
  });

  const archiveRole = useMutation({
    mutationFn: (id: string) => api.post(`/rbac/roles/${id}/archive`, {}),
    onSuccess: invalidateRbac,
  });

  const restoreRole = useMutation({
    mutationFn: (id: string) => api.post(`/rbac/roles/${id}/restore`, {}),
    onSuccess: invalidateRbac,
  });

  const addRoleInheritance = useMutation({
    mutationFn: ({ roleId, parentRoleId }: { roleId: string; parentRoleId: string }) =>
      api.post(`/rbac/roles/${roleId}/inheritance`, { parentRoleId }),
    onSuccess: invalidateRbac,
  });

  const removeRoleInheritance = useMutation({
    mutationFn: ({ roleId, parentRoleId }: { roleId: string; parentRoleId: string }) =>
      api.delete(`/rbac/roles/${roleId}/inheritance/${parentRoleId}`),
    onSuccess: invalidateRbac,
  });

  const assignPermissionToRole = useMutation({
    mutationFn: ({ roleId, permissionId }: { roleId: string; permissionId: string }) =>
      api.post(`/rbac/roles/${roleId}/permissions/${permissionId}`, {}),
    onSuccess: invalidateRbac,
  });

  const removePermissionFromRole = useMutation({
    mutationFn: ({ roleId, permissionId }: { roleId: string; permissionId: string }) =>
      api.delete(`/rbac/roles/${roleId}/permissions/${permissionId}`),
    onSuccess: invalidateRbac,
  });

  const assignRoleToUser = useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string }) => {
      const role = roles.find((item) => item.id === roleId);
      if (!role) throw new Error("Papel não encontrado");
      return api.patch(`/users/${userId}/role`, { role: role.slug });
    },
    onSuccess: invalidateRbac,
  });

  const inviteUser = useMutation({
    mutationFn: ({ email, roleId }: { email: string; roleId?: string }) => {
      if (!roleId) throw new Error("Selecione um papel");
      return api.post<TeamInvite>("/users/invitations", { email, roleId });
    },
    onSuccess: invalidateRbac,
  });

  const cancelInvite = useMutation({
    mutationFn: (id: string) => api.delete(`/users/invitations/${id}`),
    onSuccess: invalidateRbac,
  });

  const resendInvite = useMutation({
    mutationFn: (id: string) => api.post(`/users/invitations/${id}/resend`, {}),
    onSuccess: invalidateRbac,
  });

  const unsupportedMutation = useMutation({
    mutationFn: async () => {
      throw new Error("Operação não disponível neste contrato");
    },
  });
  const getPermissionsForRole = (roleId: string): Permission[] => {
    const ids = new Set(
      rolePermissions.filter((grant) => grant.role_id === roleId).map((grant) => grant.permission_id),
    );
    return permissions.filter((permission) => ids.has(permission.id));
  };

  const getRoleForUser = (userId: string) =>
    teamMembers.find((member) => member.user_id === userId)?.role;

  const getPermissionsByCategory = () =>
    permissions.reduce<Record<string, Permission[]>>((grouped, permission) => {
      (grouped[permission.category] ??= []).push(permission);
      return grouped;
    }, {});

  const getRoleDetail = (roleId: string) =>
    api.get<RoleDetail>(`/rbac/roles/${roleId}`);

  return {
    roles,
    permissions,
    rolePermissions,
    teamMembers,
    authorityMode: authorityModeQuery.data,
    authorityModeLoading: authorityModeQuery.isLoading,
    teamInvites: invitesQuery.data ?? [],
    isLoading:
      rolesQuery.isLoading ||
      permissionsQuery.isLoading ||
      grantsQuery.isLoading ||
      membersQuery.isLoading ||
      invitesQuery.isLoading,
    createRole,
    updateRole,
    duplicateRole,
    deleteRole: archiveRole,
    archiveRole,
    restoreRole,
    addRoleInheritance,
    removeRoleInheritance,
    assignPermissionToRole,
    removePermissionFromRole,
    assignRoleToUser,
    removeUserRole: unsupportedMutation,
    inviteUser,
    cancelInvite,
    resendInvite,
    getPermissionsForRole,
    getRoleForUser,
    getPermissionsByCategory,
    getRoleDetail,
  };
}
