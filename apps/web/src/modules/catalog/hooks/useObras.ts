import { QUERY_KEYS } from "@/shared/lib/query-config";
import { useDataQuery } from "@/shared/hooks/useDataQuery";
import { emit, DomainEvents } from "@/shared/domain-events";
import { useTenant } from "@/app/providers/TenantContext";
import type { Obra, ObraInsert, ObraUpdate, ObraWithRelations } from "../types/catalog.types";

export type { Obra, ObraInsert, ObraUpdate, ObraWithRelations };

export function useObras(enabled = true, artistId?: string) {
  const { tenant } = useTenant();
  const orgId = tenant?.id ?? "unknown";

  const result = useDataQuery<ObraWithRelations>({
    // artistId entra na queryKey: sem isso, abrir a Visão 360 do artista A e
    // depois do artista B reaproveitaria (errado) o cache de A — mesma key,
    // filtro server-side diferente (ver Task G).
    queryKey: artistId ? [...QUERY_KEYS.WORKS, "by-artist", artistId] : [...QUERY_KEYS.WORKS],
    table: "obras",
    select: "*, artistas(*), projetos(id, title)",
    enabled,
    filters: artistId ? { artist_id: artistId } : undefined,
    additionalInvalidateKeys: [[...QUERY_KEYS.PROJECTS]],
    onMutationSuccess: {
      onCreate: (o) =>
        emit(DomainEvents.MUSIC_REGISTERED, {
          work_id: (o as ObraWithRelations & { id: string }).id,
          title: o.title ?? "",
          org_id: orgId,
        }),
      onUpdate: (o) =>
        emit(DomainEvents.MUSIC_UPDATED, {
          work_id: (o as ObraWithRelations & { id: string }).id,
          title: o.title ?? "",
          org_id: orgId,
        }),
      onDelete: (id) =>
        emit(DomainEvents.MUSIC_DELETED, { work_id: id, org_id: orgId }),
    },
  }, {
    create: { success: "Obra criada com sucesso!", error: "Erro ao criar obra" },
    update: { success: "Obra atualizada com sucesso!", error: "Erro ao atualizar obra" },
    delete: { success: "Obra excluída com sucesso!", error: "Erro ao excluir obra" },
  });

  return {
    obras: result.data,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
    addObra: result.create,
    updateObra: result.update,
    deleteObra: result.delete,
  };
}
