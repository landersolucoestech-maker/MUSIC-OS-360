import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { QUERY_KEYS } from "@/lib/query-config";
import { MOCK_USER, MOCK_USER_ID } from "@/data/mockData";

/**
 * Lista de usuários do app. Sem backend, devolvemos apenas o usuário
 * mock que está sempre logado. Atualizações ficam em memória (sem
 * persistência) para não quebrar a UI de Usuários.
 */

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

const MOCK_USUARIO: Usuario = {
  id: MOCK_USER_ID,
  email: (MOCK_USER as { email?: string }).email ?? "owner@landermusic.com.br",
  full_name: "Owner Demo",
  phone: null,
  avatar_url: null,
  role: "owner",
  cargo: "Administrador",
  status: "ativo",
  created_at: new Date().toISOString(),
};

const memoryStore: Usuario[] = [MOCK_USUARIO];

export function useUsuarios() {
  const queryClient = useQueryClient();

  const { data: usuarios = [], isLoading, error } = useQuery({
    queryKey: [...QUERY_KEYS.USUARIOS],
    queryFn: async () => memoryStore.slice(),
  });

  const updateUsuario = useMutation({
    mutationFn: async ({
      id,
      full_name,
      phone,
      cargo,
    }: {
      id: string;
      full_name?: string;
      phone?: string;
      cargo?: string;
    }) => {
      const idx = memoryStore.findIndex((u) => u.id === id);
      if (idx >= 0) {
        memoryStore[idx] = {
          ...memoryStore[idx],
          full_name: full_name ?? memoryStore[idx].full_name,
          phone: phone ?? memoryStore[idx].phone,
          cargo: cargo ?? memoryStore[idx].cargo,
        };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.USUARIOS] });
      toast.success("Usuário atualizado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar usuário: ${error.message}`);
    },
  });

  return {
    usuarios,
    isLoading,
    error,
    updateUsuario,
  };
}
