import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  adminIntegrationsService,
  type AdminIntegration,
  type IntegrationCategory,
  type UpdateIntegrationGovernanceInput,
} from "@/modules/admin/services/admin-integrations.service";
import { adminPlanIntegrationsService } from "@/modules/admin/services/admin-integrations.service";

import { toUserMessage } from "@/shared/lib/errors";
const EMPTY_SLUGS: string[] = [];

const EMPTY_INTEGRATIONS: AdminIntegration[] = [];
const EMPTY_CATEGORIES: IntegrationCategory[] = [];

/**
 * `data ?? []` is a render convenience, NOT error handling: `isError`/`error`
 * stay exposed and the UI must distinguish LOADING / ERROR / EMPTY.
 * Collapsing a failure (404/403/500/network) into an empty list was exactly the bug that
 * made the Admin Portal tab say "no integrations" with 14 records in the database.
 */
export function useAdminIntegrations() {
  const query = useQuery<AdminIntegration[]>({
    queryKey: ["admin", "integrations"],
    queryFn: () => adminIntegrationsService.list(),
    retry: 1,
  });
  return { ...query, data: query.data ?? EMPTY_INTEGRATIONS };
}

export function useIntegrationCategories() {
  const query = useQuery<IntegrationCategory[]>({
    queryKey: ["admin", "integrations", "categories"],
    queryFn: () => adminIntegrationsService.listCategories(),
  });
  return { ...query, data: query.data ?? EMPTY_CATEGORIES };
}

export function useUpdateIntegrationGovernance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateIntegrationGovernanceInput }) =>
      adminIntegrationsService.update(id, patch),
    onSuccess: () => {
      // Governance changes what customers resolve — invalidate both sides.
      void qc.invalidateQueries({ queryKey: ["admin", "integrations"] });
      void qc.invalidateQueries({ queryKey: ["integrations", "external-providers"] });
      toast.success("Governança atualizada.");
    },
    onError: (err: Error) => toast.error(toUserMessage(err, "Não foi possível atualizar a governança.")),
  });
}

/** Commercial integrations available to compose a plan — comes from the backend. */
export function useCommercialIntegrations() {
  const query = useAdminIntegrations();
  return { ...query, data: query.data.filter((i) => i.classification === "commercial") };
}

export function usePlanIntegrations(planSlug: string | undefined) {
  const query = useQuery<string[]>({
    queryKey: ["admin", "plan-integrations", planSlug],
    queryFn: () => adminPlanIntegrationsService.get(planSlug!),
    enabled: !!planSlug,
  });
  return { ...query, data: query.data ?? EMPTY_SLUGS };
}

export function useSavePlanIntegrations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ planSlug, integrations }: { planSlug: string; integrations: string[] }) =>
      adminPlanIntegrationsService.set(planSlug, integrations),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["admin", "plan-integrations"] });
      void qc.invalidateQueries({ queryKey: ["admin", "integrations"] });
      // An entitlement changes the customer's catalog without a deploy — invalidates both sides.
      void qc.invalidateQueries({ queryKey: ["integrations", "external-providers"] });
      if (res.rejected.length > 0) {
        toast.warning(`Ignorados (não comerciais): ${res.rejected.join(", ")}`);
      } else {
        toast.success("Integrações do plano salvas.");
      }
    },
    onError: (err: Error) => toast.error(toUserMessage(err, "Falha ao salvar integrações do plano.")),
  });
}
