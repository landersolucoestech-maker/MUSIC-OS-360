import { ECAD_REPORT_STATUS_LABELS_PT_BR, EcadReportStatus } from "@music-os-360/types";
import type { BadgeVariant } from "@/shared/ui/badge";

/**
 * PT-BR presentation of ECAD report technical values. The API returns the
 * canonical English values; the UI never renders them raw.
 */
export const ECAD_REPORT_STATUS_VARIANT: Readonly<Record<EcadReportStatus, BadgeVariant>> = {
  [EcadReportStatus.COMPLETED]: "success",
  [EcadReportStatus.IMPORTED]: "info",
  [EcadReportStatus.PENDING]: "warning",
  [EcadReportStatus.ERROR]: "danger",
};

export function ecadReportStatusLabel(status: string | null | undefined): string {
  return (status && ECAD_REPORT_STATUS_LABELS_PT_BR[status as EcadReportStatus]) || "Status desconhecido";
}

export function ecadReportStatusVariant(status: string | null | undefined): BadgeVariant {
  return (status && ECAD_REPORT_STATUS_VARIANT[status as EcadReportStatus]) || "neutral";
}

/** Report types seen so far have no product vocabulary yet; never show the raw value. */
export const ECAD_REPORT_TYPE_LABELS_PT_BR: Readonly<Record<string, string>> = {};

export function ecadReportTypeLabel(type: string | null | undefined): string {
  return (type && ECAD_REPORT_TYPE_LABELS_PT_BR[type]) || "Relatório ECAD";
}
