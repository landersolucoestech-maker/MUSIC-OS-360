/**
 * releases/mappers/entity-to-form.mapper.ts
 * Entity (DB record / WS payload) → form field values.
 * Source of truth for Release hydration.
 */

import type { Release } from "@/modules/releases/hooks/useReleases";

export interface ReleaseFormFields {
  projectSeed: string;
  title: string;
  artist_id: string;
  type: string;
  upcCode: string;
  genre: string;
  language: string;
  releaseDate: string;
  recordLabel: string;
  copyright: string;
  distributor: string;
  distributionNotes: string;
  // ── New fields ──────────────────────────
  isrcGlobal: string;
  upc: string;
  internalNotes: string;
  // Assets
  assetAudioMasterUrl: string;
  assetCoverUrl: string;
  assetMusicVideoUrl: string;
  assetLyrics: string;
  assetCredits: string;
  assetPressRelease: string;
  assetEpkUrl: string;
  // Schedule
  scheduleRecordingDate: string;
  scheduleMixMasterDate: string;
  scheduleDistributorDeliveryDate: string;
}

function ps(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

export function releaseToFormFields(l: Release | null | undefined): ReleaseFormFields {
  const assets = (l?.assets ?? {}) as Record<string, unknown>;
  const schedule = (l?.schedule ?? {}) as Record<string, unknown>;

  return {
    projectSeed:                     "",
    title:                           ps(l?.title),
    artist_id:                       ps(l?.artist_id),
    type:                            ps(l?.type),
    upcCode:                         ps(l?.codigo_upc ?? l?.upc),
    genre:                           ps(l?.music_genre),
    language:                        ps(l?.language),
    releaseDate:                     ps(l?.release_date),
    recordLabel:                     ps(l?.record_label),
    copyright:                       ps(l?.copyright),
    distributor:                     ps(l?.distributor) || "onerpm",
    distributionNotes:               ps(l?.notes),
    isrcGlobal:                      ps(l?.isrc_global),
    upc:                             ps(l?.upc),
    internalNotes:                   ps(l?.internal_notes),
    assetAudioMasterUrl:             ps(assets["audio_master_url"]),
    assetCoverUrl:                   ps(assets["cover_url"] ?? l?.cover_url),
    assetMusicVideoUrl:              ps(assets["music_video_url"]),
    assetLyrics:                     ps(assets["lyrics"]),
    assetCredits:                    ps(assets["credits"]),
    assetPressRelease:               ps(assets["press_release"]),
    assetEpkUrl:                     ps(assets["epk_url"]),
    scheduleRecordingDate:           ps(schedule["recording_date"]),
    scheduleMixMasterDate:           ps(schedule["mix_master_date"]),
    scheduleDistributorDeliveryDate: ps(schedule["distributor_delivery_date"]),
  };
}

export function emptyReleaseFormFields(): ReleaseFormFields {
  return {
    projectSeed: "", title: "", artist_id: "", type: "",
    upcCode: "", genre: "", language: "", releaseDate: "",
    recordLabel: "", copyright: "",
    distributor: "onerpm", distributionNotes: "",
    isrcGlobal: "", upc: "", internalNotes: "",
    assetAudioMasterUrl: "", assetCoverUrl: "", assetMusicVideoUrl: "",
    assetLyrics: "", assetCredits: "", assetPressRelease: "", assetEpkUrl: "",
    scheduleRecordingDate: "", scheduleMixMasterDate: "", scheduleDistributorDeliveryDate: "",
  };
}
