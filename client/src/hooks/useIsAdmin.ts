import { useAuth } from "@/contexts/AuthContext";

/**
 * Sem backend, o usuário mock é sempre admin.
 */
export function useIsAdmin() {
  const { user } = useAuth();
  return {
    isAdmin: !!user,
    isLoading: false,
  };
}
