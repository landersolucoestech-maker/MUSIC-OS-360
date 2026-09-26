/**
 * releases/services/form-to-payload.mapper.ts
 * Form field values → backend DTO payload (camelCase, matching CreateReleaseDto / UpdateReleaseDto).
 *
 * Backend expects:
 *   POST /releases  → CreateReleaseDto  { title, type, artistId, upc, distributor, releasedAt,
 *                                         platforms, coverUrl, metadata, isrc_global, notas_internas,
 *                                         notes, gravadora, copyright, genero, idioma, assets, cronograma }
 *   PATCH /releases → UpdateReleaseDto  (all optional + status: ReleaseStatus)
 *
 * NestJS ValidationPipe runs with { whitelist: true, forbidNonWhitelisted: true } —
 * any snake_case or unknown field causes a 400. Only DTO fields must be sent.
 *
 * Product rule 2026-07-12 (migration ReleasesFormFieldColumns20260718000010):
 * every form field has its own column — no formal field goes into `metadata`.
 */

import type { ReleaseFormFields } from "./entity-to-form.mapper";

function ns(v: string): string | null {
  const t = v.trim();
  return t || null;
}

export function formToReleasePayload(f: ReleaseFormFields, mode: "create" | "edit" = "create"): Record<string, unknown> {
  const assets = {
    audio_master_url:  ns(f.assetAudioMasterUrl),
    capa_url:          ns(f.assetCapaUrl),
    video_clipe_url:   ns(f.assetVideoClipeUrl),
    letra:             ns(f.assetLetra),
    ficha_tecnica:     ns(f.assetFichaTecnica),
    press_release:     ns(f.assetPressRelease),
    epk_url:           ns(f.assetEpkUrl),
  };
  const cronograma = {
    data_gravacao:              ns(f.cronGravacao),
    data_mix_master:            ns(f.cronMixMaster),
    data_entrega_distribuidora: ns(f.cronEntregaDistribuidora),
  };
  const hasAssets = Object.values(assets).some(Boolean);
  const hasCron = Object.values(cronograma).some(Boolean);

  const payload: Record<string, unknown> = {
    title:       f.title.trim(),
    type:        ns(f.type) ?? "single",
  };

  const artistId  = ns(f.artist_id);
  const upc       = ns(f.upc) || ns(f.codigoUPC);
  const distributor = ns(f.distribuidora);
  const releasedAt  = ns(f.dataLancamento);
  const coverUrl    = ns(f.assetCapaUrl);

  if (artistId)   payload["artistId"]    = artistId;
  if (upc)        payload["upc"]         = upc;
  if (distributor) payload["distributor"] = distributor;
  if (releasedAt) payload["releasedAt"]  = releasedAt;
  if (coverUrl)   payload["coverUrl"]    = coverUrl;

  if (ns(f.isrcGlobal))        payload["isrc_global"]    = ns(f.isrcGlobal);
  if (ns(f.notasInternas))     payload["notas_internas"] = ns(f.notasInternas);
  if (ns(f.notasDistribuicao)) payload["notes"]          = ns(f.notasDistribuicao);
  if (ns(f.gravadora))         payload["gravadora"]      = ns(f.gravadora);
  if (ns(f.copyright))         payload["copyright"]      = ns(f.copyright);
  if (ns(f.genero))            payload["music_genre"]    = ns(f.genero);
  if (ns(f.idioma))            payload["idioma"]         = ns(f.idioma);
  if (hasAssets)               payload["assets"]         = assets;
  if (hasCron)                 payload["cronograma"]     = cronograma;

  // find-ed7823e9 (incompatible consumer): the form does NOT write status.
  // Status is read-only in the UI ("Controlado pelo sistema") and the only
  // canonical writer is the workflow (ReleaseViewModal → useWorkflowTransition,
  // driven by the backend's allowed_transitions). The old
  // backend→form→backend mapping was lossy (distributed→scheduled,
  // archived→released, assets_pending→metadata_pending, null→review), and every
  // metadata edit of those releases triggered a nonexistent workflow
  // transition and failed with 400. `mode` stays in the signature for caller
  // compatibility.
  void mode;

  return payload;
}
