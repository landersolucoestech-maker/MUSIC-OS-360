import { QUERY_KEYS } from "@/shared/lib/query-config";
import { useDataQuery } from "@/shared/hooks/useDataQuery";
import { emit, DomainEvents } from "@/shared/domain-events";
import { useTenant } from "@/app/providers/TenantContext";
import type {
  Phonogram,
  PhonogramInsert,
  PhonogramUpdate,
  PhonogramWithRelations,
} from "../types/catalog.types";

export type { Phonogram as Fonograma, PhonogramInsert as FonogramaInsert, PhonogramUpdate as FonogramaUpdate, PhonogramWithRelations as FonogramaWithRelations };

export function usePhonograms(enabled = true, artistId?: string) {
  const { tenant } = useTenant();
  const orgId = tenant?.id ?? "unknown";

  const result = useDataQuery<PhonogramWithRelations>({
    queryKey: artistId ? [...QUERY_KEYS.PHONOGRAMS, "by-artist", artistId] : [...QUERY_KEYS.PHONOGRAMS],
    table: "phonograms",
    select: "*, artistas(*)",
    enabled,
    filters: artistId ? { artist_id: artistId } : undefined,
    onMutationSuccess: {
      onCreate: (f) =>
        emit(DomainEvents.PHONOGRAM_REGISTERED, {
          id:      (f as PhonogramWithRelations & { id: string }).id,
          work_id: (f as PhonogramWithRelations & { work_id?: string }).work_id ?? "",
          org_id:  orgId,
        }),
      onUpdate: (f) =>
        emit(DomainEvents.PHONOGRAM_UPDATED, {
          id:      (f as PhonogramWithRelations & { id: string }).id,
          work_id: (f as PhonogramWithRelations & { work_id?: string }).work_id ?? "",
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
    phonograms: result.data,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
    addPhonogram: result.create,
    updatePhonogram: result.update,
    deletePhonogram: result.delete,
  };
}
