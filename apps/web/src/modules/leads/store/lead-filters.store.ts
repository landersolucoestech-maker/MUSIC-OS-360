import { create } from "zustand";
import type { LeadFiltersState } from "../types";

export const defaultLeadFilters: LeadFiltersState = {
  search: "",
  serviceType: "all",
  status: "all",
  responsiblePerson: "all",
  leadSource: "all",
  temperature: "all",
};

type LeadFiltersStore = {
  filters: LeadFiltersState;
  setFilters: (filters: Partial<LeadFiltersState>) => void;
  resetFilters: () => void;
};

export const useLeadFiltersStore = create<LeadFiltersStore>((set) => ({
  filters: defaultLeadFilters,
  setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
  resetFilters: () => set({ filters: defaultLeadFilters }),
}));
