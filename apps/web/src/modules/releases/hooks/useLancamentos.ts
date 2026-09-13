import { QUERY_KEYS } from "@/shared/lib/query-config";
import { useDataQuery } from "@/shared/hooks/useDataQuery";
import { emit, DomainEvents } from "@/shared/domain-events";
import { useTenant } from "@/app/providers/TenantContext";
import type {
  Lancamento,
  LancamentoInsert,
  LancamentoUpdate,
  LancamentoWithRelations,
} from "../types";

export type { Lancamento, LancamentoInsert, LancamentoUpdate, LancamentoWithRelations };

export function useLancamentos(enabled = true, artistId?: string) {
  const { tenant } = useTenant();
  const orgId = tenant?.id ?? "unknown";

  const result = useDataQuery<LancamentoWithRelations>({
    queryKey: artistId ? [...QUERY_KEYS.RELEASES, "by-artist", artistId] : [...QUERY_KEYS.RELEASES],
    table: "lancamentos",
    select: "*, artistas(*)",
    orderBy: { column: "data_lancamento", ascending: false },
    enabled,
    // Backend de releases usa "artistId" (camelCase), não "artist_id" — ver releases.dto.ts/releases.service.ts.
    filters: artistId ? { artistId: artistId } : undefined,
    onMutationSuccess: {
      onCreate: (l) =>
        emit(DomainEvents.RELEASE_CREATED, {
          id: (l as LancamentoWithRelations & { id: string }).id,
          title: l.title ?? "",
          artist_id: l.artist_id ?? undefined,
          org_id: orgId,
        }),
      onUpdate: (l) =>
        emit(DomainEvents.RELEASE_UPDATED, {
          id: (l as LancamentoWithRelations & { id: string }).id,
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
    lancamentos: result.data,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
    addLancamento: result.create,
    updateLancamento: result.update,
    deleteLancamento: result.delete,
  };
}
