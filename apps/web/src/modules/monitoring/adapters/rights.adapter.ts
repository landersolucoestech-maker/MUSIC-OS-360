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
  work_title?: string | null;
  recording_title?: string | null;
  period_start: string;
  period_end: string;
  gross_amount_cents: number;
  currency: "BRL";
  status: "pending" | "reconciled" | "divergent" | "cancelled";
  platforms?: string[];
  notes?: string | null;
}

/** Query sent to the rights APIs */
export interface RightsQuery {
  isrc?: string;
  iswc?: string;
  period_start: string;
  period_end: string;
  sources?: Array<"ecad" | "ubc" | "abramus">;
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
  period: string;
  gross_amount_brl: string;
  status: RightsRecord["status"];
  status_label: string;
  platforms: string[];
  notes: string | null;
  reconciled_at: string | null;
}

// ─── Static mappings ──────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<RightsRecord["source"], string> = {
  ecad: "ECAD",
  ubc: "UBC",
  abramus: "Abramus",
};

const STATUS_LABELS: Record<RightsRecord["status"], string> = {
  pending: "Pendente",
  reconciled: "Conciliado",
  divergent: "Divergente",
  cancelled: "Cancelado",
};

// ─── Adaptation functions ─────────────────────────────────────────────────────

/**
 * Converts a RightsRecord (external API) into a MonitoringRightsEntry (UI).
 * FUTURE MIGRATION: receive real data from useEcadArrecadacao / useUbcDistribuicao.
 */
export function fromRightsRecord(record: RightsRecord): MonitoringRightsEntry {
  const grossAmountBrl = (record.gross_amount_cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  const period = `${formatPeriod(record.period_start)} – ${formatPeriod(record.period_end)}`;

  return {
    id: `${record.source}_${record.external_id}`,
    source: record.source,
    source_label: SOURCE_LABELS[record.source],
    isrc: record.isrc ?? null,
    iswc: record.iswc ?? null,
    title: record.recording_title ?? record.work_title ?? null,
    period,
    gross_amount_brl: grossAmountBrl,
    status: record.status,
    status_label: STATUS_LABELS[record.status],
    platforms: record.platforms ?? [],
    notes: record.notes ?? null,
    reconciled_at: record.status === "reconciled" ? new Date().toISOString() : null,
  };
}

/**
 * Builds a query for the rights APIs from a
 * local Takedown (matches by ISRC when available in the `reason` field).
 *
 * FUTURE MIGRATION: the isrc field will come directly from Takedown.isrc
 * once that field is added to the entity.
 */
export function toRightsQuery(
  takedown: Takedown,
  options: { period_start: string; period_end: string; sources?: RightsQuery["sources"] }
): RightsQuery {
  return {
    isrc: extractIsrcFromTakedown(takedown),
    period_start: options.period_start,
    period_end: options.period_end,
    sources: options.sources,
  };
}

// ─── Internal utilities ───────────────────────────────────────────────────────

function formatPeriod(iso: string): string {
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
 * Tries to extract the ISRC from the Takedown's `reason` field.
 * FUTURE MIGRATION: remove this heuristic once Takedown has a dedicated isrc field.
 */
function extractIsrcFromTakedown(takedown: Takedown): string | undefined {
  const isrcPattern = /[A-Z]{2}[A-Z0-9]{3}\d{7}/;
  const reason = takedown.reason ?? "";
  const match = isrcPattern.exec(reason);
  return match?.[0];
}
