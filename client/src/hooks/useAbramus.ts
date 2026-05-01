import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";
import {
  DisabledIntegrationError,
  INTEGRATION_DISABLED_CODE,
} from "@/lib/disabled-integration";

/**
 * Stubs do ABRAMUS — toda sincronização foi desligada junto com o
 * backend. Os hooks continuam exportando a mesma assinatura para que
 * a UI legada (Configurações, busca de obras/fonogramas) renderize a
 * mensagem de "integração desativada" sem quebrar.
 */

export interface AbramusSyncCategorySummary {
  fetched: number;
  inserted: number;
  updated: number;
  errors: number;
}

export interface AbramusSyncSummary {
  started_at: string;
  finished_at: string;
  duration_ms: number;
  obras: AbramusSyncCategorySummary;
  fonogramas: AbramusSyncCategorySummary;
  total_fetched: number;
  total_inserted: number;
  total_updated: number;
  total_errors: number;
  truncated?: boolean;
}

export type AbramusSyncSchedule = "off" | "daily" | "weekly";

export interface AbramusStatus {
  connected: boolean;
  status?: string;
  base_url?: string | null;
  username?: string | null;
  last_error?: string | null;
  last_sync_at?: string | null;
  last_sync_summary?: AbramusSyncSummary | null;
  sync_schedule?: AbramusSyncSchedule;
  next_sync_at?: string | null;
}

export interface AbramusSearchResult {
  external_id: string;
  titulo: string;
  iswc?: string | null;
  isrc?: string | null;
  duracao?: string | null;
  genero?: string | null;
  compositores?: string[] | null;
  letristas?: string[] | null;
  gravadora?: string | null;
  produtores?: string[] | null;
  data_registro?: string | null;
  artista_nome?: string | null;
}

export type AbramusKind = "obras" | "fonogramas";

export interface AbramusSearchResponse {
  results: AbramusSearchResult[];
  total?: number;
  has_more?: boolean;
  error?: string;
}

export interface AbramusLocalMatch {
  id: string;
  titulo: string;
}

const DISABLED_STATUS: AbramusStatus = {
  connected: false,
  status: INTEGRATION_DISABLED_CODE,
  last_error: "Integração ABRAMUS desativada — backend não configurado.",
  sync_schedule: "off",
};

function fail(): never {
  throw new DisabledIntegrationError("ABRAMUS");
}

export function useAbramusStatus() {
  return useQuery<AbramusStatus>({
    queryKey: ["abramus", "status"] as const,
    queryFn: async () => DISABLED_STATUS,
    staleTime: Infinity,
  });
}

export function useAbramusSaveCredentials() {
  return useMutation({
    mutationFn: async (_input: {
      username: string;
      password: string;
      base_url?: string;
    }) => fail(),
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useAbramusDeleteCredentials() {
  return useMutation({
    mutationFn: async () => fail(),
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useAbramusSearch(_kind: AbramusKind, _query: string) {
  return useQuery<AbramusSearchResponse>({
    queryKey: ["abramus", "search", _kind, _query.trim()],
    queryFn: async () => ({
      results: [],
      error: "Integração ABRAMUS desativada — backend não configurado.",
    }),
    enabled: false,
    staleTime: Infinity,
  });
}

export function useAbramusImport(_kind: AbramusKind) {
  return useMutation({
    mutationFn: async (_input: {
      external_id: string;
      record?: AbramusSearchResult;
    }) => fail(),
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useAbramusSyncAll() {
  return useMutation({
    mutationFn: async (_input?: { kinds?: AbramusKind[] }) => fail(),
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

/**
 * Antes consultava o banco para flagar quais resultados já tinham sido
 * importados localmente. Sem backend, nunca há matches — devolvemos
 * sempre um Map vazio.
 */
export function useAbramusLocalLookup(
  kind: AbramusKind,
  externalIds: string[],
) {
  const ids = useMemo(
    () =>
      Array.from(
        new Set(
          externalIds.filter((id) => typeof id === "string" && id.length > 0),
        ),
      ).sort(),
    [externalIds],
  );

  return useQuery<Map<string, AbramusLocalMatch>>({
    queryKey: ["abramus", "local-lookup", kind, ids],
    queryFn: async () => new Map<string, AbramusLocalMatch>(),
    enabled: false,
    staleTime: Infinity,
  });
}

export function useAbramusSetSchedule() {
  return useMutation({
    mutationFn: async (_schedule: AbramusSyncSchedule) => fail(),
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
