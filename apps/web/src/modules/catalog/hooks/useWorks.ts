import { QUERY_KEYS } from "@/shared/lib/query-config";
import { useDataQuery } from "@/shared/hooks/useDataQuery";
import { emit, DomainEvents } from "@/shared/domain-events";
import { useTenant } from "@/app/providers/TenantContext";
import type { Work, WorkInsert, WorkUpdate, WorkWithRelations } from "../types/catalog.types";

export type { Work as Obra, WorkInsert as ObraInsert, WorkUpdate as ObraUpdate, WorkWithRelations as ObraWithRelations };

export function useWorks(enabled = true, artistId?: string) {
  const { tenant } = useTenant();
  const orgId = tenant?.id ?? "unknown";

  const result = useDataQuery<WorkWithRelations>({
    // artistId goes into the queryKey: without it, opening artist A's 360 View and
    // then artist B's would (wrongly) reuse A's cache — same key,
    // different server-side filter (see Task G).
    queryKey: artistId ? [...QUERY_KEYS.WORKS, "by-artist", artistId] : [...QUERY_KEYS.WORKS],
    table: "obras",
    select: "*, artistas(*), projetos(id, title)",
    enabled,
    filters: artistId ? { artist_id: artistId } : undefined,
    additionalInvalidateKeys: [[...QUERY_KEYS.PROJECTS]],
    onMutationSuccess: {
      onCreate: (o) =>
        emit(DomainEvents.MUSIC_REGISTERED, {
          work_id: (o as WorkWithRelations & { id: string }).id,
          title: o.title ?? "",
          org_id: orgId,
        }),
      onUpdate: (o) =>
        emit(DomainEvents.MUSIC_UPDATED, {
          work_id: (o as WorkWithRelations & { id: string }).id,
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
    works: result.data,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
    addWork: result.create,
    updateWork: result.update,
    deleteWork: result.delete,
  };
}
