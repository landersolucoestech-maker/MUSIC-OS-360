/**
 * releases/mappers/entity-to-form.mapper.ts
 * Entity (DB record / WS payload) → form field values.
 * Source of truth for Lancamento hydration.
 */

import type { Lancamento } from "@/modules/releases/hooks/useLancamentos";

export interface LancamentoFormFields {
  projetoSeed: string;
  title: string;
  artist_id: string;
  type: string;
  codigoUPC: string;
  genero: string;
  idioma: string;
  dataLancamento: string;
  status: string;
  gravadora: string;
  copyright: string;
  distribuidora: string;
  notasDistribuicao: string;
  // ── Novos campos ──────────────────────────
  isrcGlobal: string;
  upc: string;
  notasInternas: string;
  // Assets
  assetAudioMasterUrl: string;
  assetCapaUrl: string;
  assetVideoClipeUrl: string;
  assetLetra: string;
  assetFichaTecnica: string;
  assetPressRelease: string;
  assetEpkUrl: string;
  // Cronograma
  cronGravacao: string;
  cronMixMaster: string;
  cronEntregaDistribuidora: string;
}

function ps(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

// Maps backend ReleaseStatus enum → frontend form status values
const BACKEND_STATUS_TO_FORM: Record<string, string> = {
  draft:             "planejado",
  metadata_pending:  "em_producao",
  assets_pending:    "em_producao",
  review:            "analise",
  approved:          "aprovado",
  scheduled:         "programado",
  distributed:       "aguardando_distribuicao",
  released:          "ativo",
  archived:          "ativo",
  cancelled:         "cancelado",
};

function mapStatusToForm(raw: unknown): string {
  if (!raw) return "analise";
  const s = String(raw).trim().toLowerCase();
  return BACKEND_STATUS_TO_FORM[s] ?? (s || "analise");
}

export function lancamentoToFormFields(l: Lancamento | null | undefined): LancamentoFormFields {
  const r = l as Record<string, unknown> | null | undefined;
  // Support both snake_case (from backend entity) and camelCase (legacy mock data)
  const assets = (l?.assets ?? (r?.["metadata"] as Record<string, unknown>)?.["assets"] ?? {}) as Record<string, unknown>;
  const cron = (l?.cronograma ?? (r?.["metadata"] as Record<string, unknown>)?.["cronograma"] ?? {}) as Record<string, unknown>;
  const meta = (r?.["metadata"] as Record<string, unknown>) ?? {};

  return {
    projetoSeed:               "",
    title:                    ps(l?.title ?? r?.["title"]),
    artist_id:                ps(l?.artist_id ?? r?.["artistId"]),
    type:                      ps(l?.type ?? r?.["type"]),
    codigoUPC:                 ps(l?.codigo_upc ?? l?.upc ?? r?.["upc"]),
    genero:                    ps(l?.genero ?? meta["genero"]),
    idioma:                    ps(l?.idioma ?? meta["idioma"]),
    dataLancamento:            ps(l?.data_lancamento ?? r?.["releasedAt"]),
    status:                    mapStatusToForm(l?.status),
    gravadora:                 ps(l?.gravadora ?? meta["gravadora"]),
    copyright:                 ps(l?.copyright ?? meta["copyright"]),
    distribuidora:             ps(l?.distribuidora ?? r?.["distributor"]) || "onerpm",
    notasDistribuicao:         ps(l?.notes ?? meta["observacoes"]),
    isrcGlobal:                ps(l?.isrc_global ?? meta["isrc_global"]),
    upc:                       ps(l?.upc ?? r?.["upc"]),
    notasInternas:             ps(l?.notas_internas ?? meta["notas_internas"]),
    assetAudioMasterUrl:       ps(assets["audio_master_url"]),
    assetCapaUrl:              ps(assets["capa_url"] ?? r?.["capa_url"]),
    assetVideoClipeUrl:        ps(assets["video_clipe_url"]),
    assetLetra:                ps(assets["letra"]),
    assetFichaTecnica:         ps(assets["ficha_tecnica"]),
    assetPressRelease:         ps(assets["press_release"]),
    assetEpkUrl:               ps(assets["epk_url"]),
    cronGravacao:              ps(cron["data_gravacao"]),
    cronMixMaster:             ps(cron["data_mix_master"]),
    cronEntregaDistribuidora:  ps(cron["data_entrega_distribuidora"]),
  };
}

export function emptyLancamentoFormFields(): LancamentoFormFields {
  return {
    projetoSeed: "", title: "", artist_id: "", type: "",
    codigoUPC: "", genero: "", idioma: "", dataLancamento: "",
    status: "analise", gravadora: "", copyright: "",
    distribuidora: "onerpm", notasDistribuicao: "",
    isrcGlobal: "", upc: "", notasInternas: "",
    assetAudioMasterUrl: "", assetCapaUrl: "", assetVideoClipeUrl: "",
    assetLetra: "", assetFichaTecnica: "", assetPressRelease: "", assetEpkUrl: "",
    cronGravacao: "", cronMixMaster: "", cronEntregaDistribuidora: "",
  };
}
