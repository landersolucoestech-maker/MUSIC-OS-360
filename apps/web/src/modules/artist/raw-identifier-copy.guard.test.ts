/**
 * Guard: raw technical identifiers (metric keys, sync skip reason codes) never
 * reach end-user copy. Both previously leaked: PositioningCard rendered
 * `e.metricKey` ("spotify.monthly_listeners") and the sync toast rendered the
 * API reason code ("missing_external_profile").
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/api-client", () => ({ api: {} }));

import { metricLabel } from "./lib/metric-labels";
import { syncSkipReasonCopy } from "./hooks/useArtistPlatformProfiles";

const API_METRIC_KEYS = [
  "spotify.monthly_listeners",
  "youtube.subscribers",
  "youtube.total_views",
  "youtube.total_videos",
  "deezer.fans",
  "soundcloud.followers",
  "instagram.followers",
  "tiktok.followers",
  "apple-music.playlist_count",
];

describe("raw identifiers never become end-user copy", () => {
  it("every API metric key has a PT-BR label", () => {
    for (const key of API_METRIC_KEYS) {
      const label = metricLabel(key);
      expect(label).not.toBe(key);
      expect(label).not.toMatch(/[._]/);
    }
  });

  it("an unknown metric key falls back to generic copy, not the key", () => {
    expect(metricLabel("future.metric_key")).toBe("Métrica da plataforma");
  });

  it("sync skip reason codes map to PT-BR copy", () => {
    for (const code of ["missing_external_profile", "pending_sync_exists", "some_new_code", undefined]) {
      const copy = syncSkipReasonCopy(code);
      expect(copy).not.toMatch(/_/);
      if (code) expect(copy).not.toContain(code);
    }
  });
});
