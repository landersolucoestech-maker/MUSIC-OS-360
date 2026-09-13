import { QUERY_KEYS } from "@/shared/lib/query-config";
import { useDataQuery } from "@/shared/hooks/useDataQuery";
import { emit, DomainEvents } from "@/shared/domain-events";
import { useTenant } from "@/app/providers/TenantContext";
import type {
  Invoice,
  InvoiceInsert,
  InvoiceUpdate,
  InvoiceWithRelations,
} from "../types/accounting.types";

export type { Invoice, InvoiceInsert, InvoiceUpdate, InvoiceWithRelations };

function invoiceValue(invoice: InvoiceWithRelations): number | undefined {
  const row = invoice as InvoiceWithRelations & {
    valor_servicos?: number | string;
    valor?: number | string;
  };
  const raw = row.valor_servicos ?? row.valor;
  if (raw === null || raw === undefined || raw === "") return undefined;
  const parsed = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function useInvoices() {
  const { tenant } = useTenant();
  const orgId = tenant?.id ?? "unknown";

  const result = useDataQuery<InvoiceWithRelations>({
    queryKey: [...QUERY_KEYS.INVOICES],
    table: "invoices",
    onMutationSuccess: {
      onCreate: (nf) =>
        emit(DomainEvents.INVOICE_CREATED, {
          id: (nf as InvoiceWithRelations & { id: string }).id,
          numero: (nf as InvoiceWithRelations & { numero?: string }).numero ?? undefined,
          client_id: (nf as InvoiceWithRelations & { client_id?: string }).client_id ?? undefined,
          valor: invoiceValue(nf),
          org_id: orgId,
        }),
      onUpdate: (nf) =>
        emit(DomainEvents.INVOICE_UPDATED, {
          id: (nf as InvoiceWithRelations & { id: string }).id,
          numero: (nf as InvoiceWithRelations & { numero?: string }).numero ?? undefined,
          client_id: (nf as InvoiceWithRelations & { client_id?: string }).client_id ?? undefined,
          valor: invoiceValue(nf),
          org_id: orgId,
        }),
      onDelete: (id) =>
        emit(DomainEvents.INVOICE_DELETED, { id, org_id: orgId }),
    },
  }, {
    create: { success: "Nota fiscal criada com sucesso!", error: "Erro ao criar nota fiscal" },
    update: { success: "Nota fiscal atualizada com sucesso!", error: "Erro ao atualizar nota fiscal" },
    delete: { success: "Nota fiscal excluída com sucesso!", error: "Erro ao excluir nota fiscal" },
  });

  return {
    invoices: result.data,
    isLoading: result.isLoading,
    error: result.error,
    addInvoice: result.create,
    updateInvoice: result.update,
    deleteInvoice: result.delete,
  };
}
