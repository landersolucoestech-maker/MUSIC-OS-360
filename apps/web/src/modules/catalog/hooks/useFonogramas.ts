import { QUERY_KEYS } from "@/shared/lib/query-config";
import { useDataQuery } from "@/shared/hooks/useDataQuery";
import { emit, DomainEvents } from "@/shared/domain-events";
import { useTenant } from "@/app/providers/TenantContext";
import type {
  Fonograma,
  FonogramaInsert,
  FonogramaUpdate,
  FonogramaWithRelations,
} from "../types/catalog.types";

export type { Fonograma, FonogramaInsert, FonogramaUpdate, FonogramaWithRelations };

export function useFonogramas(enabled = true, artistId?: string) {
  const { tenant } = useTenant();
  const orgId = tenant?.id ?? "unknown";

  const result = useDataQuery<FonogramaWithRelations>({
    queryKey: artistId ? [...QUERY_KEYS.PHONOGRAMS, "by-artist", artistId] : [...QUERY_KEYS.PHONOGRAMS],
    table: "fonogramas",
    select: "*, artistas(*)",
    enabled,
    filters: artistId ? { artist_id: artistId } : undefined,
    onMutationSuccess: {
      onCreate: (f) =>
        emit(DomainEvents.PHONOGRAM_REGISTERED, {
          id:      (f as FonogramaWithRelations & { id: string }).id,
          work_id: (f as FonogramaWithRelations & { work_id?: string }).work_id ?? "",
          org_id:  orgId,
        }),
      onUpdate: (f) =>
        emit(DomainEvents.PHONOGRAM_UPDATED, {
          id:      (f as FonogramaWithRelations & { id: string }).id,
          work_id: (f as FonogramaWithRelations & { work_id?: string }).work_id ?? "",
          org_id:  orgId,
        }),
      onDelete: (id) =>
        emit(DomainEvents.PHONOGRAM_DELETED, { id, org_id: orgId }),
    },
  }, {
    create: { success: "Fonograma criado com sucesso!", error: "Erro ao criar fonograma" },
    update: { success: "Fonograma atualizado com sucesso!", error: "Erro ao atualizar fonograma" },
    delete: { success: "Fonograma excluído com sucesso!", error: "Erro ao excluir fonograma" },
  });

  return {
    fonogramas: result.data,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
    addFonograma: result.create,
    updateFonograma: result.update,
    deleteFonograma: result.delete,
  };
}
