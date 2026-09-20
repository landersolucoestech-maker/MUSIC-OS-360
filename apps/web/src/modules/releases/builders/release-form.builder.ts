/**
 * releases/builders/release-form.builder.ts
 *
 * Builder pattern for composing Lancamento payloads.
 * Separates construction logic from UI components and mapper utilities.
 *
 * Usage:
 *   const payload = new ReleaseFormBuilder()
 *     .withCore({ title, artist_id, type, status })
 *     .withDistribution({ distribuidora, distribuidoraOutra, plataformas })
 *     .withAssets({ audio_master_url, capa_url })
 *     .withCronograma({ data_gravacao, data_mix_master })
 *     .withCodes({ isrc_global, upc })
 *     .build();
 */

import { normalizeStr } from "@/shared/lib/normalize";
import type { LancamentoInsert } from "@/modules/releases/hooks/useLancamentos";

// ─── Param shapes ─────────────────────────────────────────────────────────────

export interface ReleaseCore {
  title: string;
  artist_id: string;
  type: string;
  status?: string;
  data_lancamento?: string;
  genero?: string;
  idioma?: string;
  gravadora?: string;
  copyright?: string;
  notas_internas?: string;
}

export interface ReleaseDistribution {
  distribuidora?: string;
  distribuidora_outra?: string;
  plataformas?: string[] | null;
  observacoes?: string;
}

export interface ReleaseAssets {
  audio_master_url?: string | null;
  capa_url?: string | null;
  video_clipe_url?: string | null;
  letra?: string | null;
  ficha_tecnica?: string | null;
  press_release?: string | null;
  epk_url?: string | null;
}

export interface ReleaseCronograma {
  data_gravacao?: string | null;
  data_mix_master?: string | null;
  data_entrega_distribuidora?: string | null;
}

export interface ReleaseCodes {
  isrc_global?: string | null;
  upc?: string | null;
  codigo_upc?: string | null;
}

// ─── Builder ─────────────────────────────────────────────────────────────────

function ns(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t || null;
}

export class ReleaseFormBuilder {
  private _core: ReleaseCore | null = null;
  private _distribution: ReleaseDistribution = {};
  private _assets: ReleaseAssets = {};
  private _cronograma: ReleaseCronograma = {};
  private _codes: ReleaseCodes = {};

  withCore(core: ReleaseCore): this {
    this._core = core;
    return this;
  }

  withDistribution(distribution: ReleaseDistribution): this {
    this._distribution = distribution;
    return this;
  }

  withAssets(assets: ReleaseAssets): this {
    this._assets = assets;
    return this;
  }

  withCronograma(cronograma: ReleaseCronograma): this {
    this._cronograma = cronograma;
    return this;
  }

  withCodes(codes: ReleaseCodes): this {
    this._codes = codes;
    return this;
  }

  build(): LancamentoInsert {
    if (!this._core) {
      throw new Error("ReleaseFormBuilder: withCore() must be called before build()");
    }

    const assetsObj: ReleaseAssets = {
      audio_master_url: ns(this._assets.audio_master_url),
      capa_url:         ns(this._assets.capa_url),
      video_clipe_url:  ns(this._assets.video_clipe_url),
      letra:            ns(this._assets.letra),
      ficha_tecnica:    ns(this._assets.ficha_tecnica),
      press_release:    ns(this._assets.press_release),
      epk_url:          ns(this._assets.epk_url),
    };

    const cronObj: ReleaseCronograma = {
      data_gravacao:              ns(this._cronograma.data_gravacao),
      data_mix_master:            ns(this._cronograma.data_mix_master),
      data_entrega_distribuidora: ns(this._cronograma.data_entrega_distribuidora),
    };

    const hasAssets = Object.values(assetsObj).some(Boolean);
    const hasCron = Object.values(cronObj).some(Boolean);

    return {
      title:          this._core.title.trim(),
      artist_id:      normalizeStr(this._core.artist_id),
      type:            normalizeStr(this._core.type),
      status:          normalizeStr(this._core.status) ?? "analise",
      data_lancamento: normalizeStr(this._core.data_lancamento),
      music_genre:     normalizeStr(this._core.genero),
      idioma:          normalizeStr(this._core.idioma),
      gravadora:       normalizeStr(this._core.gravadora),
      copyright:       normalizeStr(this._core.copyright),
      notas_internas:  ns(this._core.notas_internas),
      distribuidora:   normalizeStr(this._distribution.distribuidora),
      notes:           normalizeStr(this._distribution.observacoes),
      plataformas:     this._distribution.plataformas ?? null,
      fonograma_ids:   null,
      isrc_global:     ns(this._codes.isrc_global),
      upc:             ns(this._codes.upc ?? this._codes.codigo_upc),
      assets:          hasAssets ? assetsObj : null,
      cronograma:      hasCron ? cronObj : null,
    } as LancamentoInsert;
  }

  /**
   * Convenience: build from flat form fields (compatible with LancamentoFormFields).
   */
  static fromFormFields(f: {
    title: string;
    artist_id: string;
    type: string;
    status?: string;
    dataLancamento?: string;
    genero?: string;
    idioma?: string;
    gravadora?: string;
    copyright?: string;
    distribuidora?: string;
    notasDistribuicao?: string;
    notasInternas?: string;
    isrcGlobal?: string;
    upc?: string;
    codigoUPC?: string;
    assetAudioMasterUrl?: string;
    assetCapaUrl?: string;
    assetVideoClipeUrl?: string;
    assetLetra?: string;
    assetFichaTecnica?: string;
    assetPressRelease?: string;
    assetEpkUrl?: string;
    cronGravacao?: string;
    cronMixMaster?: string;
    cronEntregaDistribuidora?: string;
  }): LancamentoInsert {
    return new ReleaseFormBuilder()
      .withCore({
        title:          f.title,
        artist_id:      f.artist_id,
        type:            f.type,
        status:          f.status,
        data_lancamento: f.dataLancamento,
        genero:          f.genero,
        idioma:          f.idioma,
        gravadora:       f.gravadora,
        copyright:       f.copyright,
        notas_internas:  f.notasInternas,
      })
      .withDistribution({
        distribuidora: f.distribuidora,
        observacoes:   f.notasDistribuicao,
      })
      .withAssets({
        audio_master_url: f.assetAudioMasterUrl,
        capa_url:         f.assetCapaUrl,
        video_clipe_url:  f.assetVideoClipeUrl,
        letra:            f.assetLetra,
        ficha_tecnica:    f.assetFichaTecnica,
        press_release:    f.assetPressRelease,
        epk_url:          f.assetEpkUrl,
      })
      .withCronograma({
        data_gravacao:              f.cronGravacao,
        data_mix_master:            f.cronMixMaster,
        data_entrega_distribuidora: f.cronEntregaDistribuidora,
      })
      .withCodes({
        isrc_global: f.isrcGlobal,
        upc:         f.upc ?? f.codigoUPC,
      })
      .build();
  }
}
