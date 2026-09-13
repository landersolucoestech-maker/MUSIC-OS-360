import { create } from "zustand";

export type AccountingPeriod = "current_month" | "last_month" | "current_quarter" | "ytd" | "custom";
export type AccountingView = "transactions" | "cashflow" | "reconciliation" | "reports" | "pl" | "invoices";

interface AccountingFilters {
  period: AccountingPeriod;
  startDate?: string;
  endDate?: string;
  type?: "receita" | "despesa" | "all";
  status?: string;
  category?: string;
  search: string;
}

interface AccountingState {
  view: AccountingView;
  filters: AccountingFilters;
  selectedTransactionId: string | null;
  sidebarOpen: boolean;
  setView: (view: AccountingView) => void;
  setFilters: (filters: Partial<AccountingFilters>) => void;
  resetFilters: () => void;
  selectTransaction: (id: string | null) => void;
  toggleSidebar: () => void;
}

const DEFAULT_FILTERS: AccountingFilters = {
  period: "current_month",
  type: "all",
  search: "",
};

export const useAccountingStore = create<AccountingState>((set) => ({
  view: "transactions",
  filters: DEFAULT_FILTERS,
  selectedTransactionId: null,
  sidebarOpen: false,

  setView: (view) => set({ view }),
  setFilters: (filters) =>
    set((s) => ({ filters: { ...s.filters, ...filters } })),
  resetFilters: () => set({ filters: DEFAULT_FILTERS }),
  selectTransaction: (id) => set({ selectedTransactionId: id }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
