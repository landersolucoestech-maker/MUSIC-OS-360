import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";
import { api } from "@/shared/lib/api-client";
import type {
  RegisterObraInput,
  RegisterFonogramaInput,
  RegistrationResult,
  RegistrationHistoryEntry,
  GenerateISWCInput,
  GenerateISWCResult,
  GenerateISRCInput,
  GenerateISRCResult,
  ArtistSearchResult,
} from "@/modules/integrations/dto";

// Schedule é preferência local de agendamento (não é credencial nem dado de domínio).
const SCHED_KEY = "musicos360_abramus_schedule";
function readSchedule(): AbramusSyncSchedule {
  try { return (sessionStorage.getItem(SCHED_KEY) as AbramusSyncSchedule) || "off"; } catch { return "off"; }
}
function writeSchedule(s: AbramusSyncSchedule) {
  try { sessionStorage.setItem(SCHED_KEY, s); } catch { /* ignore */ }
}

// ─── Types ────────────────────────────────────────────────────────────────────
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
  title: string;
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
  title: string;
}

function backendUnavailable(operation: string): never {
  throw new Error(
    `${operation} requer o endpoint real /integrations/abramus no backend — funcionalidade ainda não disponível.`,
  );
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useAbramusStatus() {
  return useQuery<AbramusStatus>({
    queryKey: ["abramus", "status"],
    queryFn: async () => api.get<AbramusStatus>("/integrations/abramus/status"),
    staleTime: 30_000,
  });
}

export function useAbramusSaveCredentials() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { username: string; password: string; base_url?: string }) => {
      if (!input.username.trim() || !input.password.trim()) {
        throw new Error("Usuário e senha são obrigatórios.");
      }
      return api.post("/integrations/abramus/configure", {
        username: input.username.trim(),
        password: input.password,
        baseUrl:  input.base_url?.trim() ?? "",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["abramus", "status"] });
      toast.success("Credenciais ABRAMUS salvas. Conectado com sucesso.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useAbramusDeleteCredentials() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => api.delete("/integrations/abramus/disconnect"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["abramus", "status"] });
      toast.success("Integração ABRAMUS desconectada.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useAbramusSearch(kind: AbramusKind, query: string) {
  const trimmed = query.trim();
  return useQuery<AbramusSearchResponse>({
    queryKey: ["abramus", "search", kind, trimmed],
    queryFn: async () =>
      api.get<AbramusSearchResponse>(
        `/integrations/abramus/search-work?q=${encodeURIComponent(trimmed)}&kind=${kind}`,
      ),
    enabled: trimmed.length >= 2,
    staleTime: 30_000,
  });
}

export function useAbramusSearchArtists(query: string) {
  const trimmed = query.trim();
  return useQuery<ArtistSearchResult[]>({
    queryKey: ["abramus", "search-artists", trimmed],
    queryFn: async () => {
      const res = await api.get<{ results?: ArtistSearchResult[] }>(
        `/integrations/abramus/search-artist?q=${encodeURIComponent(trimmed)}&limit=10`,
      );
      return res?.results ?? (res as unknown as ArtistSearchResult[]) ?? [];
    },
    enabled: trimmed.length >= 2,
    staleTime: 30_000,
  });
}

export function useAbramusImport(kind: AbramusKind) {
  return useMutation({
    mutationFn: async (_input: { external_id: string; record?: AbramusSearchResult }): Promise<{ record?: AbramusSearchResult }> =>
      backendUnavailable(kind === "obras" ? "Importação de obras do ABRAMUS" : "Importação de fonogramas do ABRAMUS"),
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useAbramusSyncAll() {
  return useMutation({
    mutationFn: async (_input?: { kinds?: AbramusKind[] }): Promise<AbramusSyncSummary> =>
      backendUnavailable("Sincronização completa com o ABRAMUS"),
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useAbramusLocalLookup(kind: AbramusKind, externalIds: string[]) {
  const ids = useMemo(
    () => Array.from(new Set(externalIds.filter((id) => typeof id === "string" && id.length > 0))).sort(),
    [externalIds],
  );
  return useQuery<Map<string, AbramusLocalMatch>>({
    queryKey: ["abramus", "local-lookup", kind, ids],
    // Correspondência local depende do vínculo real obra/fonograma ↔ código externo
    // persistido no backend; sem ele, não há match a exibir.
    queryFn: async () => new Map<string, AbramusLocalMatch>(),
    enabled: ids.length > 0,
    staleTime: 10_000,
  });
}

export function useAbramusSetSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (schedule: AbramusSyncSchedule) => {
      writeSchedule(schedule);
      return { ok: true };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["abramus", "status"] }),
    onError:   (err: Error) => toast.error(err.message),
  });
}

export function useAbramusRegistrationHistory(kind: AbramusKind, localId: string) {
  return useQuery<RegistrationHistoryEntry[]>({
    queryKey: ["abramus", "registration-history", kind, localId],
    // Histórico de registro vive no backend; sem endpoint, não há histórico a exibir.
    queryFn: async () => [],
    enabled: Boolean(localId),
    staleTime: 60_000,
  });
}

export function useAbramusRegisterObra() {
  const queryClient = useQueryClient();
  return useMutation<RegistrationResult, Error, RegisterObraInput>({
    mutationFn: async (input) => {
      // find-93fe3250: this submits a real registration to the Abramus API --
      // a network-level retry or double submission of this mutation must not
      // register the same work twice. Fresh key per mutationFn invocation
      // (i.e. per user-initiated attempt), same convention as
      // signing.service.ts's sendForSigning.
      const res = await api.post<{ external_id?: string; code?: string; iswc?: string | null }>(
        "/integrations/abramus/register-work",
        {
          title: input.title,
          compositor: input.compositores[0] ?? "",
          coautores: input.compositores.slice(1),
          iswc: input.iswc,
          genero: input.genero,
          duracao: input.duracao,
          editora: input.editora,
        },
        { headers: { "X-Idempotency-Key": crypto.randomUUID() } },
      );
      return {
        entity: "abramus",
        kind: "obra",
        local_id: input.local_id,
        external_id: res.external_id ?? "",
        code: res.code ?? res.external_id ?? "",
        iswc: res.iswc ?? input.iswc ?? null,
        registered_at: new Date().toISOString(),
        status: "registered",
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["obras"] });
      queryClient.invalidateQueries({ queryKey: ["abramus", "registration-history"] });
      toast.success(`Obra registrada na ABRAMUS. Código: ${data.code}${data.iswc ? ` | ISWC: ${data.iswc}` : ""}`);
    },
    onError: (err) => toast.error(`Erro ao registrar obra: ${err.message}`),
  });
}

export function useAbramusRegisterFonograma() {
  return useMutation<RegistrationResult, Error, RegisterFonogramaInput>({
    mutationFn: async (_input) =>
      backendUnavailable("Registro de fonograma na ABRAMUS"),
    onError: (err) => toast.error(`Erro ao registrar fonograma: ${err.message}`),
  });
}

export function useAbramusGenerateISWC() {
  return useMutation<GenerateISWCResult, Error, GenerateISWCInput>({
    mutationFn: async (_input) => backendUnavailable("Geração de ISWC via ABRAMUS"),
    onError: (err) => toast.error(`Erro ao gerar ISWC: ${err.message}`),
  });
}

export function useAbramusGenerateISRC() {
  return useMutation<GenerateISRCResult, Error, GenerateISRCInput>({
    mutationFn: async (_input) => backendUnavailable("Geração de ISRC via ABRAMUS"),
    onError: (err) => toast.error(`Erro ao gerar ISRC: ${err.message}`),
  });
}
