import { useAuth } from "@/contexts/AuthContext";

const MOCK_ORG_ID = "9b955920-a37a-4fcc-be35-cda1cc705d21";

/**
 * Sem backend, devolvemos um org_id fixo para a única organização mock.
 */
export function useCurrentOrgId() {
  const { user } = useAuth();
  return {
    orgId: user ? MOCK_ORG_ID : null,
    isLoading: false,
    error: null as Error | null,
  };
}
