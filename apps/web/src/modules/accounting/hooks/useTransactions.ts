import { QUERY_KEYS } from "@/shared/lib/query-config";
import { useDataQuery } from "@/shared/hooks/useDataQuery";
import { emit, DomainEvents } from "@/shared/domain-events";
import { useTenant } from "@/app/providers/TenantContext";
import { toNumber } from "../pages/profit-and-loss-calc";
import { useAllTransactions } from "./useAllTransactions";
import type {
  Transaction,
  TransactionInsert,
  TransactionUpdate,
  TransactionWithRelations,
} from "../types/accounting.types";

export type { Transaction, TransactionInsert, TransactionUpdate, TransactionWithRelations };

/**
 * Transactions + create/update/delete mutations.
 *
 * The list is the COMPLETE sweep (useAllTransactions: every page, hard safety
 * ceiling, explicit `truncated`), never a plain `storage.list`: that sends no
 * limit and the API answers its default page (50), which silently capped every
 * total computed from it (find-85dfc055). Callers that only need the mutations
 * (form controllers, imports) pass `enabled = false`, which runs no list request.
 *
 * The artist filter uses "artist_id": QueryTransactionDto's "artistId" is a legacy
 * alias NEVER read by the service (it only exists so old callers do not get a 400),
 * so sending it made the filter silently ignored (200 with every transaction of the tenant).
 */
export function useTransactions(enabled = true, artistId?: string) {
  const { tenant } = useTenant();
  const orgId = tenant?.id ?? "unknown";
  const all = useAllTransactions({ enabled, artistId });

  const result = useDataQuery<TransactionWithRelations>({
    // Mutations only: the list is owned by useAllTransactions (same QUERY_KEYS.TRANSACTIONS prefix,
    // so every mutation invalidates it).
    queryKey: [...QUERY_KEYS.TRANSACTIONS, "mutations"],
    table: "transactions",
    orderBy: { column: "transaction_date", ascending: false },
    enabled: false,
    onMutationSuccess: {
      onCreate: (t) =>
        emit(DomainEvents.TRANSACTION_CREATED, {
          id: (t as TransactionWithRelations & { id: string }).id,
          type: t.type,
          amount: toNumber(t.amount),
          artist_id: t.artist_id ?? undefined,
          project_id: t.project_id ?? undefined,
          org_id: orgId,
        }),
      onUpdate: (t) =>
        emit(DomainEvents.TRANSACTION_UPDATED, {
          id: (t as TransactionWithRelations & { id: string }).id,
          type: t.type,
          amount: toNumber(t.amount),
          artist_id: t.artist_id ?? undefined,
          project_id: t.project_id ?? undefined,
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
    transactions: all.transactions,
    /** Backend total (all pages); compare with `transactions.length` or use `truncated`. */
    total: all.total,
    /** true when the sweep stopped at the safety ceiling: totals computed from `transactions` are partial. */
    truncated: all.truncated,
    isLoading: all.isLoading,
    error: all.error,
    refetch: all.refetch,
    addTransaction: result.create,
    updateTransaction: result.update,
    deleteTransaction: result.delete,
  };
}
