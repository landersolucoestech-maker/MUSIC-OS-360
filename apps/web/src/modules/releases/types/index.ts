import type { ArtistaRef, ObraRef } from "@/shared/types/refs";
import type { ReleaseStatusValue, ReleaseType, ShareStatus, ShareCategory, ShareDirection, ShareType } from "@/shared/types/enums";

export type { ReleaseStatusValue, ReleaseType, ShareStatus, ShareCategory, ShareDirection, ShareType };

export interface LancamentoAssets {
  audio_master_url?: string | null;
  capa_url?: string | null;
  video_clipe_url?: string | null;
  letra?: string | null;
  ficha_tecnica?: string | null;
  press_release?: string | null;
  epk_url?: string | null;
  [key: string]: string | null | undefined;
}

export interface LancamentoCronograma {
  data_gravacao?: string | null;
  data_mix_master?: string | null;
  data_entrega_distribuidora?: string | null;
  [key: string]: string | null | undefined;
}

/**
 * Erro retornado por uma plataforma de distribuição, por campo.
 * `fieldKey` pode ser global (`upc`, `copyrightHolder`) ou de faixa (`tracks[0].isrc`).
 */
export interface PlatformError {
  fieldKey: string;
  message: string;
  code?: string;
  source?: string;
  attemptId?: string;
  createdAt?: string;
}

/**
 * Tentativa de envio a uma plataforma (scaffolding tipado — preenchido por
 * integração real no futuro; nunca simulado). Mantido fora do schema do form.
 */
export interface ReleasePlatformAttempt {
  id: string;
  releaseId: string;
  platformKey: string;
  status: string;
  requestPayload?: Record<string, unknown> | null;
  responsePayload?: Record<string, unknown> | null;
  validationErrors?: PlatformError[] | null;
  submittedAt?: string | null;
  updatedAt?: string | null;
}

export interface Lancamento {
  id: string;
  user_id?: string;
  title: string;
  type?: ReleaseType | string | null;
  status?: ReleaseStatusValue | string | null;
  artist_id?: string | null;
  data_lancamento?: string | null;
  distribuidora?: string | null;
  plataformas?: string[] | null;
  fonograma_ids?: string[] | null;
  observacoes?: string | null;
  isrc_global?: string | null;
  upc?: string | null;
  notas_internas?: string | null;
  assets?: LancamentoAssets | null;
  cronograma?: LancamentoCronograma | null;
  // Campos adicionais presentes no mock e formulário
  genero?: string | null;
  idioma?: string | null;
  gravadora?: string | null;
  copyright?: string | null;
  work_id?: string | null;
  fonograma_id?: string | null;
  codigo_upc?: string | null;
  // ── Separação status interno × status de plataforma ──────────────────────────
  /** Status operacional interno (controle). Ver `release-status`. */
  internal_status?: string | null;
  /** Status retornado pela plataforma — NUNCA editável manualmente; null = controle interno. */
  platform_status?: string | null;
  /** Plataforma de distribuição selecionada (id do catálogo). */
  selected_platform_id?: string | null;
  /** Dados específicos da plataforma (montados conforme schema da plataforma conectada). */
  platform_specific_data?: Record<string, unknown> | null;
  /** Erros retornados pela plataforma, por campo. */
  platform_errors?: PlatformError[] | null;
  platform_last_attempt_at?: string | null;
  platform_last_sync_at?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export type LancamentoInsert = Omit<Lancamento, "id" | "user_id" | "created_at" | "updated_at">;
export type LancamentoUpdate = Partial<LancamentoInsert>;

export interface LancamentoWithRelations extends Lancamento {
  artistas?: ArtistaRef | null;
}

export interface Share {
  id: string;
  user_id?: string;
  /** Discriminador interno/externo. Quando ausente, derivar via `resolveShareType`. */
  share_type?: ShareType | string | null;
  work_id?: string | null;
  artist_id?: string | null;
  percentage?: number | null;
  type?: ShareCategory | string | null;
  direction?: ShareDirection | string | null;
  status?: ShareStatus | string | null;
  valor_total?: number | null;
  valor_liquidado?: number | null;
  holder?: string | null;
  recipient?: string | null;
  // ── Fluxo interno (release) ──────────────────────────────────────────────────
  release_id?: string | null;
  // ── Fluxo externo (recebível) ────────────────────────────────────────────────
  music_title?: string | null;
  artista_externo?: string | null;
  /** Artista/projeto da empresa vinculado ao recebível externo. */
  artista_project_id?: string | null;
  pagador?: string | null;
  pagador_contato?: string | null;
  origem_acordo?: string | null;
  data_prevista?: string | null;
  documents?: string | null;
  // ── Acordo / rastreabilidade (compartilhado) ─────────────────────────────────
  acordo_notas?: string | null;
  acordo_url?: string | null;
  observacoes?: string | null;
  versao?: number | null;
  historico?: ShareHistoricoEntry[] | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export type ShareInsert = Omit<Share, "id" | "user_id" | "created_at" | "updated_at">;
export type ShareUpdate = Partial<ShareInsert>;

export interface ShareWithRelations extends Share {
  obras?: ObraRef | null;
  artistas?: ArtistaRef | null;
}

export interface ShareHistoricoEntry {
  data: string;
  acao: string;
  usuario?: string | null;
  observacao?: string | null;
  valor_anterior?: number | null;
  valor_novo?: number | null;
  versao?: string | null;
  /** Canonical field for newly-written entries. */
  percentage?: number | null;
  /** @deprecated Legacy key on already-persisted (append-only) entries written before the
   * naming-normalization rename; kept for backward-compatible reads only, never written anew. */
  percentual?: number | null;
  descricao?: string | null;
  autor?: string | null;
}

