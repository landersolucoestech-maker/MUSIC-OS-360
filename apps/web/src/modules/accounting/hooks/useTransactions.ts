import { QUERY_KEYS } from "@/shared/lib/query-config";
import { useDataQuery } from "@/shared/hooks/useDataQuery";
import { emit, DomainEvents } from "@/shared/domain-events";
import { useTenant } from "@/app/providers/TenantContext";
import type {
  Transaction,
  TransactionInsert,
  TransactionUpdate,
  TransactionWithRelations,
} from "../types/accounting.types";

export type { Transaction, TransactionInsert, TransactionUpdate, TransactionWithRelations };

export function useTransactions(enabled = true, artistId?: string) {
  const { tenant } = useTenant();
  const orgId = tenant?.id ?? "unknown";

  const result = useDataQuery<TransactionWithRelations>({
    queryKey: artistId ? [...QUERY_KEYS.TRANSACTIONS, "by-artist", artistId] : [...QUERY_KEYS.TRANSACTIONS],
    table: "transactions",
    orderBy: { column: "data", ascending: false },
    enabled,
    // QueryTransactionDto: "artistId" is a legacy alias NEVER read by the service (it only exists
    // so old callers do not get a 400) — the real field is "artist_id". Sending
    // "artistId" made this filter silently ignored (200 with every
    // transaction of the tenant, not only the artist's) in the finance tab of the 360° View.
    filters: artistId ? { artist_id: artistId } : undefined,
    onMutationSuccess: {
      onCreate: (t) =>
        emit(DomainEvents.TRANSACTION_CREATED, {
          id: (t as TransactionWithRelations & { id: string }).id,
          type: t.type as "receita" | "despesa",
          valor: t.valor ?? 0,
          artist_id: t.artist_id ?? undefined,
          project_id: typeof t.project_id === "string" ? t.project_id : undefined,
          org_id: orgId,
        }),
      onUpdate: (t) =>
        emit(DomainEvents.TRANSACTION_UPDATED, {
          id: (t as TransactionWithRelations & { id: string }).id,
          type: t.type as "receita" | "despesa",
          valor: t.valor ?? 0,
          artist_id: t.artist_id ?? undefined,
          project_id: typeof t.project_id === "string" ? t.project_id : undefined,
          org_id: orgId,
        }),
      onDelete: (id) =>
        emit(DomainEvents.TRANSACTION_DELETED, { id, org_id: orgId }),
    },
  }, {
    create: { success: "Transação criada com sucesso!", error: "Erro ao criar transação" },
    update: { success: "Transação atualizada com sucesso!", error: "Erro ao atualizar transação" },
    delete: { success: "Transação excluída com sucesso!", error: "Erro ao excluir transação" },
  });

  return {
    transactions: result.data,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
    addTransaction: result.create,
    updateTransaction: result.update,
    deleteTransaction: result.delete,
  };
}
