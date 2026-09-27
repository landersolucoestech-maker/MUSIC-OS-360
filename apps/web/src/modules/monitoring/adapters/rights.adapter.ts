/**
 * modules/monitoring/adapters/rights.adapter.ts
 *
 * Rights adapter for the monitoring module.
 *
 * RESPONSIBILITY: convert collection/reconciliation data coming
 * from the rights APIs (ECAD, UBC, Abramus) into the shape of the monitoring
 * module's local entities (Takedown, ECAD reconciliation).
 *
 * CURRENT STATE: transformations from/to MOCK_DATA.
 * FUTURE MIGRATION:
 *   - ECAD → useEcadArrecadacao / useEcadConciliacao (hooks)
 *   - UBC  → useUbcDistribuicao (hook)
 *   - Abramus → useAbramus (existing working hook)
 *   The shapes of this adapter stay stable during the migration.
 *
 * Expected flow (future):
 *   rights API → fromRightsRecord() → local entity → UI
 *   local entity → toRightsQuery()     → rights API
 */

import type { Takedown } from "@/modules/monitoring/types/monitoring.types";

// ─── Adapter input types (external API shape) ─────────────────────────────────

/** Generic collection record coming from ECAD, UBC or Abramus */
export interface RightsRecord {
  source: "ecad" | "ubc" | "abramus";
  external_id: string;
  isrc?: string | null;
  iswc?: string | null;
  obra_titulo?: string | null;
  fonograma_titulo?: string | null;
  periodo_inicio: string;
  periodo_fim: string;
  valor_bruto_cents: number;
  moeda: "BRL";
  status: "pendente" | "conciliado" | "divergente" | "cancelado";
  plataformas?: string[];
  observacoes?: string | null;
}

/** Query sent to the rights APIs */
export interface RightsQuery {
  isrc?: string;
  iswc?: string;
  periodo_inicio: string;
  periodo_fim: string;
  fontes?: Array<"ecad" | "ubc" | "abramus">;
}

// ─── Adapter output types ────────────────────────────────────────────────────

/** Reconciliation record normalized for display in monitoring */
export interface MonitoringRightsEntry {
  id: string;
  source: "ecad" | "ubc" | "abramus";
  source_label: string;
  isrc: string | null;
  iswc: string | null;
  title: string | null;
  periodo: string;
  valor_bruto_brl: string;
  status: RightsRecord["status"];
  status_label: string;
  plataformas: string[];
  observacoes: string | null;
  conciliado_em: string | null;
}

// ─── Static mappings ──────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<RightsRecord["source"], string> = {
  ecad: "ECAD",
  ubc: "UBC",
  abramus: "Abramus",
};

const STATUS_LABELS: Record<RightsRecord["status"], string> = {
  pendente: "Pendente",
  conciliado: "Conciliado",
  divergente: "Divergente",
  cancelado: "Cancelado",
};

// ─── Adaptation functions ─────────────────────────────────────────────────────

/**
 * Converts a RightsRecord (external API) into a MonitoringRightsEntry (UI).
 * FUTURE MIGRATION: receive real data from useEcadArrecadacao / useUbcDistribuicao.
 */
export function fromRightsRecord(record: RightsRecord): MonitoringRightsEntry {
  const valorBrl = (record.valor_bruto_cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  const periodo = `${formatPeriodo(record.periodo_inicio)} – ${formatPeriodo(record.periodo_fim)}`;

  return {
    id: `${record.source}_${record.external_id}`,
    source: record.source,
    source_label: SOURCE_LABELS[record.source],
    isrc: record.isrc ?? null,
    iswc: record.iswc ?? null,
    title: record.fonograma_titulo ?? record.obra_titulo ?? null,
    periodo,
    valor_bruto_brl: valorBrl,
    status: record.status,
    status_label: STATUS_LABELS[record.status],
    plataformas: record.plataformas ?? [],
    observacoes: record.observacoes ?? null,
    conciliado_em: record.status === "conciliado" ? new Date().toISOString() : null,
  };
}

/**
 * Builds a query for the rights APIs from a
 * local Takedown (matches by ISRC when available in the `motivo` field).
 *
 * FUTURE MIGRATION: the isrc field will come directly from Takedown.isrc
 * once that field is added to the entity.
 */
export function toRightsQuery(
  takedown: Takedown,
  options: { periodo_inicio: string; periodo_fim: string; fontes?: RightsQuery["fontes"] }
): RightsQuery {
  return {
    isrc: extractIsrcFromTakedown(takedown),
    periodo_inicio: options.periodo_inicio,
    periodo_fim: options.periodo_fim,
    fontes: options.fontes,
  };
}

// ─── Internal utilities ───────────────────────────────────────────────────────

function formatPeriodo(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

/**
 * Tries to extract the ISRC from the Takedown's `motivo` field.
 * FUTURE MIGRATION: remove this heuristic once Takedown has a dedicated isrc field.
 */
function extractIsrcFromTakedown(takedown: Takedown): string | undefined {
  const isrcPattern = /[A-Z]{2}[A-Z0-9]{3}\d{7}/;
  const motivo = takedown.motivo ?? "";
  const match = isrcPattern.exec(motivo);
  return match?.[0];
}
