/**
 * integrations/hooks/useNfe.ts
 *
 * Configuration hook for issuing NF-e (Brazilian electronic invoices).
 * Each company authenticates with its own digital certificate + SEFAZ credentials.
 * Data stored in localStorage (musicos360_ prefix).
 *
 * FUTURE MIGRATION:
 *   - Integration with SEFAZ via web service (NF-e 4.0 + NFS-e)
 *   - Support for A1 (PFX) and A3 (token/card) certificates
 *   - Issuing, cancellation, number voiding and SEFAZ status queries
 *   - DANFE as PDF via foco nfe / nfe.io / emites / plugnotas
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const STORAGE_KEY = "musicos360_nfe_credentials";

export type NfeEnvironment = "production" | "sandbox";
export type NfeCertificateType = "A1" | "A3";

interface NfeCredentials {
  cnpj: string;
  ie?: string;
  tax_regime: "simples_nacional" | "lucro_presumido" | "lucro_real";
  environment: NfeEnvironment;
  certificate_type: NfeCertificateType;
  certificate_serial?: string;
  provider_token?: string;
  provider: "focusnfe" | "nfeio" | "emites" | "plugnotas" | "custom";
  saved_at: string;
}

export interface NfeStatus {
  connected: boolean;
  has_credentials: boolean;
  cnpj?: string;
  environment?: NfeEnvironment;
  provider?: string;
  certificate_type?: NfeCertificateType;
  tax_regime?: string;
  saved_at?: string;
}

function loadCredentials(): NfeCredentials | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const creds = JSON.parse(raw) as NfeCredentials;
    // Dual-read: sessions saved before the rename stored provider "proprio".
    if ((creds.provider as string) === "proprio") creds.provider = "custom";
    return creds;
  } catch {
    return null;
  }
}

export function useNfeStatus() {
  return useQuery<NfeStatus>({
    queryKey: ["integrations", "nfe", "status"],
    queryFn: (): NfeStatus => {
      const creds = loadCredentials();
      if (!creds) return { connected: false, has_credentials: false };
      return {
        connected: true,
        has_credentials: true,
        cnpj: creds.cnpj,
        environment: creds.environment,
        provider: creds.provider,
        certificate_type: creds.certificate_type,
        tax_regime: creds.tax_regime,
        saved_at: creds.saved_at,
      };
    },
    staleTime: 0,
  });
}

export function useNfeSaveCredentials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<NfeCredentials, "saved_at">) => {
      const creds: NfeCredentials = {
        ...payload,
        saved_at: new Date().toISOString(),
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(creds));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["integrations", "nfe", "status"] });
    },
  });
}

export function useNfeDeleteCredentials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      sessionStorage.removeItem(STORAGE_KEY);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["integrations", "nfe", "status"] });
    },
  });
}
