import { QUERY_KEYS } from "@/shared/lib/query-config";
import { useDataQuery } from "@/shared/hooks/useDataQuery";
import { emit, DomainEvents } from "@/shared/domain-events";
import { useTenant } from "@/app/providers/TenantContext";
import type {
  Contract,
  ContractInsert,
  ContractUpdate,
  ContractVersion,
  ContractWithRelations,
} from "../types/contracts.types";

export type { Contract, ContractInsert, ContractUpdate, ContractVersion, ContractWithRelations };

export function useContracts(enabled = true, artistId?: string) {
  const { tenant } = useTenant();
  const orgId = tenant?.id ?? "unknown";

  const result = useDataQuery<ContractWithRelations>({
    queryKey: artistId ? [...QUERY_KEYS.CONTRACTS, "by-artist", artistId] : [...QUERY_KEYS.CONTRACTS],
    table: "contracts",
    enabled,
    filters: artistId ? { artist_id: artistId } : undefined,
    additionalInvalidateKeys: [[...QUERY_KEYS.ARTISTS]],
    onMutationSuccess: {
      onCreate: (c) =>
        emit(DomainEvents.CONTRACT_CREATED, {
          id: (c as ContractWithRelations & { id: string }).id,
          artist_id: c.artist_id ?? undefined,
          valor: c.valor ?? undefined,
          org_id: orgId,
        }),
      onUpdate: (c) =>
        emit(DomainEvents.CONTRACT_UPDATED, {
          id: (c as ContractWithRelations & { id: string }).id,
          artist_id: c.artist_id ?? undefined,
          valor: c.valor ?? undefined,
          org_id: orgId,
        }),
      onDelete: (id) =>
        emit(DomainEvents.CONTRACT_DELETED, { id, org_id: orgId }),
    },
  }, {
    create: { success: "Contrato criado com sucesso!", error: "Erro ao criar contrato" },
    update: { success: "Contrato atualizado com sucesso!", error: "Erro ao atualizar contrato" },
    delete: { success: "Contrato excluído com sucesso!", error: "Erro ao excluir contrato" },
  });

  return {
    contracts: result.data,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
    addContract: result.create,
    updateContract: result.update,
    deleteContract: result.delete,
  };
}
