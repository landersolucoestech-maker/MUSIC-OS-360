import { QUERY_KEYS } from "@/shared/lib/query-config";
import { useDataQuery } from "@/shared/hooks/useDataQuery";
import { emit, DomainEvents } from "@/shared/domain-events";
import { useTenant } from "@/app/providers/TenantContext";
import type {
  Release,
  ReleaseInsert,
  ReleaseUpdate,
  ReleaseWithRelations,
} from "../types";

export type { Release, ReleaseInsert, ReleaseUpdate, ReleaseWithRelations };

export function useReleases(enabled = true, artistId?: string) {
  const { tenant } = useTenant();
  const orgId = tenant?.id ?? "unknown";

  const result = useDataQuery<ReleaseWithRelations>({
    queryKey: artistId ? [...QUERY_KEYS.RELEASES, "by-artist", artistId] : [...QUERY_KEYS.RELEASES],
    table: "releases",
    select: "*, artistas(*)",
    orderBy: { column: "release_date", ascending: false },
    enabled,
    // The releases backend uses "artistId" (camelCase), not "artist_id" — see releases.dto.ts/releases.service.ts.
    filters: artistId ? { artistId } : undefined,
    onMutationSuccess: {
      onCreate: (l) =>
        emit(DomainEvents.RELEASE_CREATED, {
          id: (l as ReleaseWithRelations & { id: string }).id,
          title: l.title ?? "",
          artist_id: l.artist_id ?? undefined,
          org_id: orgId,
        }),
      onUpdate: (l) =>
        emit(DomainEvents.RELEASE_UPDATED, {
          id: (l as ReleaseWithRelations & { id: string }).id,
          title: l.title ?? "",
          artist_id: l.artist_id ?? undefined,
          org_id: orgId,
        }),
      onDelete: (id) =>
        emit(DomainEvents.RELEASE_DELETED, { id, org_id: orgId }),
    },
  }, {
    create: { success: "Lançamento criado com sucesso!", error: "Erro ao criar lançamento" },
    update: { success: "Lançamento atualizado com sucesso!", error: "Erro ao atualizar lançamento" },
    delete: { success: "Lançamento excluído com sucesso!", error: "Erro ao excluir lançamento" },
  });

  return {
    releases: result.data,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
    addRelease: result.create,
    updateRelease: result.update,
    deleteRelease: result.delete,
  };
}
