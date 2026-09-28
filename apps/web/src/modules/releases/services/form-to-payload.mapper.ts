/**
 * releases/services/form-to-payload.mapper.ts
 * Form field values → backend DTO payload (camelCase, matching CreateReleaseDto / UpdateReleaseDto).
 *
 * Backend expects:
 *   POST /releases  → CreateReleaseDto  { title, type, artistId, upc, distributor, releasedAt,
 *                                         platforms, coverUrl, metadata, isrc_global, internal_notes,
 *                                         notes, record_label, copyright, music_genre, language, assets, schedule }
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
    cover_url:         ns(f.assetCoverUrl),
    music_video_url:   ns(f.assetMusicVideoUrl),
    lyrics:            ns(f.assetLyrics),
    credits:           ns(f.assetCredits),
    press_release:     ns(f.assetPressRelease),
    epk_url:           ns(f.assetEpkUrl),
  };
  const schedule = {
    recording_date:            ns(f.scheduleRecordingDate),
    mix_master_date:           ns(f.scheduleMixMasterDate),
    distributor_delivery_date: ns(f.scheduleDistributorDeliveryDate),
  };
  const hasAssets = Object.values(assets).some(Boolean);
  const hasSchedule = Object.values(schedule).some(Boolean);

  const payload: Record<string, unknown> = {
    title:       f.title.trim(),
    type:        ns(f.type) ?? "single",
  };

  const artistId    = ns(f.artist_id);
  const upc         = ns(f.upc) || ns(f.upcCode);
  const distributor = ns(f.distributor);
  const releasedAt  = ns(f.releaseDate);
  const coverUrl    = ns(f.assetCoverUrl);

  if (artistId)    payload["artistId"]    = artistId;
  if (upc)         payload["upc"]         = upc;
  if (distributor) payload["distributor"] = distributor;
  if (releasedAt)  payload["releasedAt"]  = releasedAt;
  if (coverUrl)    payload["coverUrl"]    = coverUrl;

  if (ns(f.isrcGlobal))        payload["isrc_global"]    = ns(f.isrcGlobal);
  if (ns(f.internalNotes))     payload["internal_notes"] = ns(f.internalNotes);
  if (ns(f.distributionNotes)) payload["notes"]          = ns(f.distributionNotes);
  if (ns(f.recordLabel))       payload["record_label"]   = ns(f.recordLabel);
  if (ns(f.copyright))         payload["copyright"]      = ns(f.copyright);
  if (ns(f.genre))             payload["music_genre"]    = ns(f.genre);
  if (ns(f.language))          payload["language"]       = ns(f.language);
  if (hasAssets)               payload["assets"]         = assets;
  if (hasSchedule)             payload["schedule"]       = schedule;

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
