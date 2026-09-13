import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { QUERY_KEYS } from "@/shared/lib/query-config";
import { api } from "@/shared/lib/api-client";
import { useAuth } from "@/app/providers/AuthContext";

export interface Usuario {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: string;
  cargo: string | null;
  status: "ativo" | "inativo";
  created_at: string;
}

// Referência estável — ver mesmo comentário em shared/hooks/useDataQuery.ts:
// o default `= []` na desestruturação abaixo alocaria um array novo a cada
// render enquanto não há dado, quebrando useMemo/useEffect de quem consome
// (ex.: useAgendaParticipants, que combina esta lista com outras 3 — o loop
// "Maximum update depth exceeded" reproduzido em SchedulerFormModal vinha
// daqui).
const EMPTY_USUARIOS: Usuario[] = [];

interface ApiUser {
  id: string;
  auth_user_id: string;
  email: string;
  full_name: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  role_slug?: string | null;
  cargo?: string | null;
  status?: "active" | "inactive" | "suspended" | "invited";
  is_active: boolean;
  created_at: string;
}

interface UsersPage {
  data: ApiUser[];
  meta?: {
    total?: number;
    limit?: number;
    offset?: number;
  };
}

export interface UpdateUsuarioInput {
  id: string;
  full_name?: string;
  phone?: string;
  status?: "ativo" | "inativo";
  role?: string;
  /** Compatibilidade do formulário legado: `cargo` sempre representou o slug do papel. */
  cargo?: string;
}

function mapUser(user: ApiUser): Usuario {
  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    phone: user.phone ?? null,
    avatar_url: user.avatar_url ?? null,
    role: user.role_slug ?? user.role ?? "viewer",
    cargo: user.cargo ?? null,
    status: user.is_active && user.status !== "inactive" ? "ativo" : "inativo",
    created_at: user.created_at,
  };
}

export function useUsuarios() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: usuarios = EMPTY_USUARIOS, isLoading, error } = useQuery<Usuario[]>({
    queryKey: [...QUERY_KEYS.USERS],
    queryFn: async () => {
      const page = await api.get<UsersPage>("/users?limit=100&offset=0");
      return (page.data ?? []).map(mapUser);
    },
  });

  const updateUsuario = useMutation({
    mutationFn: async ({ id, full_name, phone, status, role, cargo }: UpdateUsuarioInput) => {
      const profilePayload = {
        ...(full_name !== undefined && { fullName: full_name }),
        ...(phone !== undefined && { phone }),
      };

      if (Object.keys(profilePayload).length > 0) {
        await api.patch(`/users/${id}`, profilePayload);
      }

      // Task L: status usa o endpoint dedicado PATCH /users/:id/status (gate
      // 'owner', protege o último owner) — o PATCH genérico de perfil não
      // aceita mais este campo.
      if (status !== undefined) {
        await api.patch(`/users/${id}/status`, { status: status === "ativo" ? "active" : "inactive" });
      }

      const effectiveRole = role ?? cargo;
      // Alteração de papel possui endpoint, autorização e auditoria próprios.
      // Enviar `role` pelo PATCH genérico contornava a hierarquia do RBAC e
      // não garantia atualização de role_id.
      if (effectiveRole !== undefined) {
        await api.patch(`/users/${id}/role`, { role: effectiveRole });
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.USERS] }),
        queryClient.invalidateQueries({ queryKey: ["team_members"] }),
        queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.ROLES] }),
      ]);
      toast.success("Usuário atualizado com sucesso!");
    },
    onError: (mutationError: Error) => {
      toast.error(`Erro ao atualizar usuário: ${mutationError.message}`);
    },
  });

  return {
    usuarios,
    isLoading,
    error,
    updateUsuario,
    currentUserId: user?.id ?? "",
  };
}
