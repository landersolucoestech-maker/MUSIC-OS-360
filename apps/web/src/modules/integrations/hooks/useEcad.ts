/**
 * modules/integrations/hooks/useEcad.ts
 *
 * ECAD integration (Brazil's central office for the collection and distribution of music royalties).
 *
 * REAL STATE: access to the ECAD API requires an institutional contract (via
 * ABRAMUS, UBC, AMAR or an affiliated association) and a real backend endpoint.
 * Until then, this hook reports the true state (disconnected) and EVERY
 * operation fails explicitly. Simulating connection, collection,
 * reconciliation or report import is forbidden.
 *
 * Contract: @/shared/integrations/contracts/rights.contract → IRightsProvider
 */

import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import type { IntegrationRuntimeStatus } from "@/shared/integrations/types";

import { toUserMessage } from "@/shared/lib/errors";
// ─── Types ────────────────────────────────────────────────────────────────────

export interface EcadStatus extends IntegrationRuntimeStatus {
  integration_id:       "ecad";
  associacao_filiada?:  string | null;
  username?:            string | null;
  ultimo_relatorio_em?: string | null;
}

export interface EcadCollectionEntry {
  isrc:                 string;
  title:               string;
  artista:              string;
  periodo:              string;
  fonte:                string;
  execucoes:            number;
  valor_bruto_cents:    number;
  valor_liquido_cents:  number;
}

export interface EcadArrecadacaoSummary {
  periodo:                string;
  total_execucoes:        number;
  valor_bruto_cents:      number;
  valor_liquido_cents:    number;
  obras:                  number;
  entries:                EcadCollectionEntry[];
}

export interface EcadConciliacaoResult {
  total_fonogramas:     number;
  conciliados:          number;
  nao_encontrados:      number;
  sem_cod_ecad:         number;
  discrepancias:        number;
}

const ECAD_UNAVAILABLE =
  "Integração ECAD ainda não está disponível (requer contrato institucional e endpoint real no backend).";

function ecadUnavailable(): never {
  throw new Error(ECAD_UNAVAILABLE);
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useEcadStatus() {
  return useQuery<EcadStatus>({
    queryKey: ["integrations", "ecad", "status"],
    // True state: there is no configurable ECAD integration today.
    queryFn: async (): Promise<EcadStatus> => ({
      integration_id:      "ecad",
      status:              "disconnected",
      connected:           false,
      associacao_filiada:  null,
      username:            null,
      ultimo_relatorio_em: null,
      last_error:          ECAD_UNAVAILABLE,
      last_checked_at:     new Date().toISOString(),
    }),
    staleTime: Infinity,
  });
}

export function useEcadSaveCredentials() {
  return useMutation({
    mutationFn: async (_input: { associacao: string; username: string; password: string }) =>
      ecadUnavailable(),
    onError: (err: Error) => toast.error(toUserMessage(err)),
  });
}

export function useEcadDeleteCredentials() {
  return useMutation({
    mutationFn: async () => ecadUnavailable(),
    onError: (err: Error) => toast.error(toUserMessage(err)),
  });
}

export function useEcadArrecadacao(periodo: string, enabled = true) {
  return useQuery<EcadArrecadacaoSummary>({
    queryKey: ["ecad", "arrecadacao", periodo],
    queryFn: async (): Promise<EcadArrecadacaoSummary> => ecadUnavailable(),
    enabled: enabled && Boolean(periodo),
    staleTime: 300_000,
    retry: false,
  });
}

export function useEcadConciliacao() {
  return useMutation<EcadConciliacaoResult, Error, { periodo: string }>({
    mutationFn: async (_input) => ecadUnavailable(),
    onError: (err) => toast.error(`Erro na conciliação ECAD: ${toUserMessage(err)}`),
  });
}

export function useEcadImportReport() {
  return useMutation<{ linhas: number; importadas: number }, Error, File>({
    mutationFn: async (_file: File) => ecadUnavailable(),
    onError: (err) => toast.error(`Erro ao importar relatório: ${toUserMessage(err)}`),
  });
}
