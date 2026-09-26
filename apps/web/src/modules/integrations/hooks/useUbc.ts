/**
 * modules/integrations/hooks/useUbc.ts
 *
 * UBC integration (Brazilian composers' union).
 *
 * REAL STATE: UBC exposes no public API — the integration requires an institutional
 * contract and a real backend endpoint. Until then, this hook reports the
 * true state (disconnected) and EVERY operation fails explicitly.
 * Simulating connection, search, import or registration is forbidden.
 *
 * Contract: @/shared/integrations/contracts/rights.contract → IRightsProvider
 */

import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";
import type {
  RegisterObraInput,
  RegistrationResult,
  RegistrationHistoryEntry,
  GenerateISWCInput,
  GenerateISWCResult,
  GenerateISRCInput,
  GenerateISRCResult,
  ArtistSearchResult,
} from "@/modules/integrations/dto";
import type { IntegrationRuntimeStatus } from "@/shared/integrations/types";

import { toUserMessage } from "@/shared/lib/errors";
// ─── Types ────────────────────────────────────────────────────────────────────

export interface UbcSyncCategorySummary {
  fetched:  number;
  inserted: number;
  updated:  number;
  errors:   number;
}

export interface UbcSyncSummary {
  started_at:     string;
  finished_at:    string;
  duration_ms:    number;
  obras:          UbcSyncCategorySummary;
  total_fetched:  number;
  total_inserted: number;
  total_updated:  number;
  total_errors:   number;
  truncated?:     boolean;
}

export type UbcSyncSchedule = "off" | "daily" | "weekly";

export interface UbcStatus extends IntegrationRuntimeStatus {
  integration_id:      "ubc";
  numero_filiado?:     string | null;
  username?:           string | null;
  base_url?:           string | null;
  ultimo_relatorio_em?: string | null;
  sync_schedule?:      UbcSyncSchedule;
  next_sync_at?:       string | null;
  last_sync_at?:       string | null;
  last_sync_summary?:  UbcSyncSummary | null;
}

export interface UbcSearchResult {
  external_id:     string;
  title:          string;
  iswc?:           string | null;
  genero?:         string | null;
  compositores?:   string[] | null;
  letristas?:      string[] | null;
  editora?:        string | null;
  duracao?:        string | null;
  data_registro?:  string | null;
  artista_nome?:   string | null;
}

export type UbcKind = "obras";

export interface UbcSearchResponse {
  results:   UbcSearchResult[];
  total?:    number;
  has_more?: boolean;
  error?:    string;
}

export interface UbcLocalMatch {
  id:     string;
  title: string;
}

const UBC_UNAVAILABLE =
  "Integração UBC ainda não está disponível (requer contrato institucional e endpoint real no backend).";

function ubcUnavailable(): never {
  throw new Error(UBC_UNAVAILABLE);
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useUbcStatus() {
  return useQuery<UbcStatus>({
    queryKey: ["integrations", "ubc", "status"],
    // True state: there is no configurable UBC integration today.
    queryFn: async (): Promise<UbcStatus> => ({
      integration_id:  "ubc",
      status:          "disconnected",
      connected:       false,
      numero_filiado:  null,
      username:        null,
      base_url:        null,
      last_error:      UBC_UNAVAILABLE,
      last_checked_at: new Date().toISOString(),
      sync_schedule:   "off",
      next_sync_at:    null,
      last_sync_at:    null,
      last_sync_summary: null,
    }),
    staleTime: Infinity,
  });
}

export function useUbcSaveCredentials() {
  return useMutation({
    mutationFn: async (_input: { numero_filiado: string; username: string; password: string; base_url?: string }) =>
      ubcUnavailable(),
    onError: (err: Error) => toast.error(toUserMessage(err)),
  });
}

export function useUbcDeleteCredentials() {
  return useMutation({
    mutationFn: async () => ubcUnavailable(),
    onError: (err: Error) => toast.error(toUserMessage(err)),
  });
}

export function useUbcSearch(query: string) {
  const trimmed = query.trim();
  return useQuery<UbcSearchResponse>({
    queryKey: ["integrations", "ubc", "search", trimmed],
    queryFn: async (): Promise<UbcSearchResponse> => ({ results: [], error: "not_available" }),
    enabled: trimmed.length >= 2,
    staleTime: 30_000,
  });
}

export function useUbcSearchArtists(query: string) {
  const trimmed = query.trim();
  return useQuery<ArtistSearchResult[]>({
    queryKey: ["integrations", "ubc", "search-artists", trimmed],
    queryFn: async () => [],
    enabled: trimmed.length >= 2,
    staleTime: 30_000,
  });
}

export function useUbcImport() {
  return useMutation({
    mutationFn: async (_input: { external_id: string; record?: UbcSearchResult }): Promise<{ record?: UbcSearchResult }> =>
      ubcUnavailable(),
    onError: (err: Error) => toast.error(toUserMessage(err)),
  });
}

export function useUbcSyncAll() {
  return useMutation({
    mutationFn: async (): Promise<UbcSyncSummary> => ubcUnavailable(),
    onError: (err: Error) => toast.error(toUserMessage(err)),
  });
}

export function useUbcSetSchedule() {
  return useMutation({
    mutationFn: async (_schedule: UbcSyncSchedule) => ubcUnavailable(),
    onError: (err: Error) => toast.error(toUserMessage(err)),
  });
}

export function useUbcLocalLookup(externalIds: string[]) {
  const ids = useMemo(
    () => Array.from(new Set(externalIds.filter((id) => typeof id === "string" && id.length > 0))).sort(),
    [externalIds],
  );
  return useQuery<Map<string, UbcLocalMatch>>({
    queryKey: ["integrations", "ubc", "local-lookup", ids],
    queryFn: async () => new Map<string, UbcLocalMatch>(),
    enabled: ids.length > 0,
    staleTime: 10_000,
  });
}

export function useUbcRegistrationHistory(localId: string) {
  return useQuery<RegistrationHistoryEntry[]>({
    queryKey: ["integrations", "ubc", "registration-history", localId],
    queryFn: async () => [],
    enabled: Boolean(localId),
    staleTime: 60_000,
  });
}

export function useUbcRegisterObra() {
  return useMutation<RegistrationResult, Error, RegisterObraInput>({
    mutationFn: async (_input) => ubcUnavailable(),
    onError: (err) => toast.error(`Erro ao registrar obra: ${toUserMessage(err)}`),
  });
}

export function useUbcGenerateISWC() {
  return useMutation<GenerateISWCResult, Error, GenerateISWCInput>({
    mutationFn: async (_input) => ubcUnavailable(),
    onError: (err) => toast.error(`Erro ao gerar ISWC: ${toUserMessage(err)}`),
  });
}

export function useUbcGenerateISRC() {
  return useMutation<GenerateISRCResult, Error, GenerateISRCInput>({
    mutationFn: async (_input) => ubcUnavailable(),
    onError: (err) => toast.error(`Erro ao gerar ISRC: ${toUserMessage(err)}`),
  });
}
