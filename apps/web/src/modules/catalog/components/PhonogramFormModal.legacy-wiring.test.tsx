// @ts-nocheck
// Wiring of PhonogramFormModal to the canonical mapper: a persisted phonogram is edited and
// the exact request body comes from formToPhonogramPayload; the ISRC validated/sent is built by joinIsrc.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { renderWithProviders } from "@/test/_helpers/render-with-providers";

const { updateMock, addMock, toastError } = vi.hoisted(() => ({
  updateMock: vi.fn(async () => ({})),
  addMock: vi.fn(async () => ({})),
  toastError: vi.fn(),
}));

vi.mock("@/modules/catalog/hooks/usePhonograms", () => {
  const stableReturn = {
    phonograms: [], isLoading: false, error: null,
    addPhonogram: { mutateAsync: (...a: unknown[]) => addMock(...a) },
    updatePhonogram: { mutateAsync: (...a: unknown[]) => updateMock(...a) },
    deletePhonogram: { mutateAsync: vi.fn() },
  };
  return { usePhonograms: () => stableReturn };
});
vi.mock("@/modules/catalog/hooks/useWorks", () => {
  const stableReturn = {
    works: [], isLoading: false, error: null,
    addWork: { mutateAsync: vi.fn() }, updateWork: { mutateAsync: vi.fn() }, deleteWork: { mutateAsync: vi.fn() },
  };
  return { useWorks: () => stableReturn };
});
vi.mock("@/modules/artist/hooks/useArtists", async () => {
  const actual = await vi.importActual("@/modules/artist/hooks/useArtists");
  return {
    ...actual,
    useArtists: () => ({
      artists: [], isLoading: false, error: null,
      addArtist: { mutateAsync: vi.fn() }, updateArtist: { mutateAsync: vi.fn() }, deleteArtist: { mutateAsync: vi.fn() },
    }),
  };
});
vi.mock("@/shared/hooks/useCurrentOrgId", () => ({ useCurrentOrgId: () => ({ orgId: "org-1", isLoading: false }) }));
vi.mock("@/modules/catalog/components/AbramusSearchRow", () => ({ AbramusSearchRow: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: (...a: unknown[]) => toastError(...a), warning: vi.fn() } }));

import { PhonogramFormModal } from "@/modules/catalog/components/PhonogramFormModal";

const UPDATED_AT = "2026-09-01T10:00:00.000Z";

function record(extra: Record<string, unknown> = {}) {
  return {
    id: "pho-1",
    title: "  Faixa Legada  ",
    status: "registered",
    isrc_country_code: "BR",
    isrc_registrant_code: "ABC",
    isrc_year: "26",
    isrc_designation_code: "00123",
    ecad_code: "ECAD-9",
    duration_seconds: 185,
    updated_at: UPDATED_AT,
    ...extra,
  };
}

function renderEdit(phonogram: Record<string, unknown>) {
  return renderWithProviders(
    <PhonogramFormModal open={true} onOpenChange={() => {}} mode="edit" phonogram={phonogram} />,
  );
}

describe("PhonogramFormModal submit goes through formToPhonogramPayload / joinIsrc", () => {
  beforeEach(() => { updateMock.mockClear(); addMock.mockClear(); toastError.mockClear(); });

  it("edit sends the canonical snake_case body with the joined ISRC and derived duration", async () => {
    renderEdit(record());
    fireEvent.click(screen.getByTestId("button-submit-phonogram"));
    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    const body = updateMock.mock.calls[0][0] as Record<string, unknown>;
    expect(body).toMatchObject({
      id: "pho-1",
      title: "Faixa Legada",
      isrc: "BR-ABC-26-00123",
      isrc_country_code: "BR",
      isrc_registrant_code: "ABC",
      isrc_year: "26",
      isrc_designation_code: "00123",
      ecad_code: "ECAD-9",
      status: "registered",
      duration_seconds: 185,
      duration_text: "03:05",
      work_id: null,
      society_code: null,
      audio_file_id: null,
      ai_used: false,
      expectedUpdatedAt: UPDATED_AT,
    });
    expect(body.participation).toEqual({ phonographic_producers: [], performers: [], session_musicians: [] });
    // form-state names never leak into the request body
    for (const formOnly of ["ecadCode", "isrcYear", "durationMinutes", "workId", "isrcCountryCode"]) {
      expect(body).not.toHaveProperty(formOnly);
    }
  });

  it("negative: an incomplete ISRC is sent as null (not as an object or partial string)", async () => {
    renderEdit(record({ isrc_year: "", isrc_registrant_code: "" }));
    fireEvent.click(screen.getByTestId("button-submit-phonogram"));
    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    const body = updateMock.mock.calls[0][0] as Record<string, unknown>;
    expect(body.isrc).toBeNull();
    expect(body.isrc_country_code).toBe("BR");
    expect(body.isrc_year).toBeNull();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("create from a seed record sends the canonical body (default status, null optional fields)", async () => {
    renderWithProviders(<PhonogramFormModal open={true} onOpenChange={() => {}} mode="create" phonogram={{ title: "Seed" }} />);
    fireEvent.click(screen.getByTestId("button-submit-phonogram"));
    await waitFor(() => expect(addMock).toHaveBeenCalledTimes(1));
    const body = addMock.mock.calls[0][0] as Record<string, unknown>;
    expect(body).toMatchObject({ title: "Seed", isrc: null, status: "pending", duration_seconds: null, duration_text: null });
    expect(body).not.toHaveProperty("isrcCountryCode");
  });
});
