/**
 * AudiovisualProjectFormModal.payload.test.ts
 *
 * Permanent guard (audit 2026-07-18 — audiovisual CRITICAL confirmed):
 * the real audiovisual production form sent, without any intermediate
 * mapper, fields that CreateAudiovisualProjectDto did not declare
 * (format, videomaker, editor, location, capture_status, editing_status,
 * approval_status, pre_release_date, observations, concept, final_status,
 * music_title, artist_name) — with ValidationPipe (whitelist +
 * forbidNonWhitelisted), every audiovisual production create/edit
 * returned 400. This test pins the real payload and guarantees the invented
 * names (music_id, budget, real_cost, name) are never sent again.
 */
import { describe, it, expect } from "vitest";
import { buildAudiovisualProjectPayload } from "./AudiovisualProjectFormModal";

const BASE_FORM = {
  music_id: "",
  music_title: "Minha Música",
  artist_name: "Artista X",
  type: "music_video" as const,
  format: "16:9",
  director: "Fulano",
  videomaker: "Beltrano",
  editor: "Ciclano",
  shooting_date: "2026-08-01",
  location: "Estúdio A",
  capture_status: "scheduled",
  editing_status: "not_started",
  approval_status: "pending",
  pre_release_date: "2026-08-10",
  release_date: "2026-08-15",
  budget: "1000",
  real_cost: "500",
  concept: "Conceito inicial",
  observations: "Nenhuma",
};

describe("buildAudiovisualProjectPayload — canonical audiovisual_projects contract", () => {
  it("never sends music_id/budget/real_cost/name — they are not real columns", () => {
    const payload = buildAudiovisualProjectPayload(BASE_FORM, "create");
    expect(payload).not.toHaveProperty("music_id");
    expect(payload).not.toHaveProperty("budget");
    expect(payload).not.toHaveProperty("real_cost");
    expect(payload).not.toHaveProperty("name");
  });

  it("maps the selected music_id to phonogram_id (same relation, real name)", () => {
    const payload = buildAudiovisualProjectPayload({ ...BASE_FORM, music_id: "phono-1" }, "create");
    expect(payload.phonogram_id).toBe("phono-1");
  });

  it("omits phonogram_id when no track is selected (does not send an empty string)", () => {
    const payload = buildAudiovisualProjectPayload(BASE_FORM, "create");
    expect(payload.phonogram_id).toBeUndefined();
  });

  it("maps budget/real_cost to budget_estimated/budget_actual (the same column the dashboard sums)", () => {
    const payload = buildAudiovisualProjectPayload(BASE_FORM, "create");
    expect(payload.budget_estimated).toBe("1000");
    expect(payload.budget_actual).toBe("500");
  });

  it("sends every real form field as a top-level column", () => {
    const payload = buildAudiovisualProjectPayload(BASE_FORM, "create");
    expect(payload).toMatchObject({
      music_title: "Minha Música",
      artist_name: "Artista X",
      title: "Minha Música",
      format: "16:9",
      director: "Fulano",
      videomaker: "Beltrano",
      editor: "Ciclano",
      shooting_date: "2026-08-01",
      location: "Estúdio A",
      capture_status: "scheduled",
      editing_status: "not_started",
      approval_status: "pending",
      pre_release_date: "2026-08-10",
      release_date: "2026-08-15",
      concept: "Conceito inicial",
      observations: "Nenhuma",
    });
  });
});
