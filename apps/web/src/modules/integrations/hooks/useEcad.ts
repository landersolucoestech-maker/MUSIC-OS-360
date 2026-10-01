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
  affiliated_association?:  string | null;
  username?:            string | null;
  last_report_at?: string | null;
}

export interface EcadCollectionEntry {
  isrc:                 string;
  title:               string;
  artist:              string;
  period:              string;
  source:                string;
  performances:            number;
  gross_amount_cents:    number;
  net_amount_cents:  number;
}

export interface EcadCollectionSummary {
  period:                string;
  total_performances:        number;
  gross_amount_cents:      number;
  net_amount_cents:    number;
  works:                  number;
  entries:                EcadCollectionEntry[];
}

export interface EcadReconciliationResult {
  total_phonograms:     number;
  reconciled:          number;
  not_found:      number;
  missing_ecad_code:         number;
  discrepancies:        number;
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
      affiliated_association:  null,
      username:            null,
      last_report_at: null,
      last_error:          ECAD_UNAVAILABLE,
      last_checked_at:     new Date().toISOString(),
    }),
    staleTime: Infinity,
  });
}

export function useEcadSaveCredentials() {
  return useMutation({
    mutationFn: async (_input: { association: string; username: string; password: string }) =>
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

export function useEcadCollection(period: string, enabled = true) {
  return useQuery<EcadCollectionSummary>({
    queryKey: ["ecad", "arrecadacao", period],
    queryFn: async (): Promise<EcadCollectionSummary> => ecadUnavailable(),
    enabled: enabled && Boolean(period),
    staleTime: 300_000,
    retry: false,
  });
}

export function useEcadReconciliation() {
  return useMutation<EcadReconciliationResult, Error, { period: string }>({
    mutationFn: async (_input) => ecadUnavailable(),
    onError: (err) => toast.error(`Erro na conciliação ECAD: ${toUserMessage(err)}`),
  });
}

export function useEcadImportReport() {
  return useMutation<{ rows: number; imported: number }, Error, File>({
    mutationFn: async (_file: File) => ecadUnavailable(),
    onError: (err) => toast.error(`Erro ao importar relatório: ${toUserMessage(err)}`),
  });
}
