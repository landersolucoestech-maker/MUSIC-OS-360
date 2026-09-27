/**
 * Domain types — Rights Monitoring.
 * They mirror the real fields of content_detections and ecad_reports
 * (apps/api/src/database/entities.ts) — no field here exists only in
 * mock data. Catalog enrichment (composer/publisher/iswc/cod_ecad) is
 * resolved at runtime via work_id against the real catalog (useWorks()).
 */

export type DetectionStatus = "pending" | "in_progress" | "completed" | "rejected" | "archived";
export type EcadReportStatus = "pendente" | "importado" | "concluido" | "erro";

export interface CatalogWorkRef {
  id: string;
  title: string;
  compositor: string | null;
  compositores: string | string[] | null;
  editora: string | null;
  isrc: string | null;
  iswc: string | null;
  cod_ecad: string | null;
  cod_entidade: string | null;
  genero: string | null;
  status: string | null;
  duration_text: string | null;
  artista_nome?: string | null;
}

export interface ContentDetection {
  id: string;
  work_id: string | null;
  artist_id: string | null;
  platform: string;
  detected_title: string | null;
  url: string | null;
  score: string | null;
  status: DetectionStatus;
  type: string;
  detected_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface EcadReport {
  id: string;
  work_id: string | null;
  periodo: string;
  type: string;
  gross_amount: string | null;
  net_amount: string | null;
  status: EcadReportStatus;
  arquivo_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
