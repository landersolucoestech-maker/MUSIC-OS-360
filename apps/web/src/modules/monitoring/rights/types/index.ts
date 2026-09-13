/**
 * Tipos de domínio — Rights Monitoring.
 * Espelham os campos reais de content_detections e ecad_reports
 * (apps/api/src/database/entities.ts) — nenhum campo aqui existe apenas em
 * mock. Enriquecimento de catálogo (compositor/editora/iswc/cod_ecad) é
 * resolvido em runtime via work_id contra o catálogo real (useObras()).
 */

export type DetectionStatus = "pending" | "in_progress" | "completed" | "rejected" | "archived";
export type EcadReportStatus = "pendente" | "importado" | "concluido" | "erro";

export interface CatalogObraRef {
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
  duracao: string | null;
  artista_nome?: string | null;
}

export interface ContentDetection {
  id: string;
  work_id: string | null;
  artist_id: string | null;
  plataforma: string;
  titulo_detectado: string | null;
  url: string | null;
  score: string | null;
  status: DetectionStatus;
  type: string;
  detectado_em: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface EcadReport {
  id: string;
  work_id: string | null;
  periodo: string;
  type: string;
  valor_bruto: string | null;
  valor_liquido: string | null;
  status: EcadReportStatus;
  arquivo_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
