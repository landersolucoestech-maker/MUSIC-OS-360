// @ts-nocheck
// WorkFormModal reads the record through workToFormFields (initial state AND re-sync on open) and
// writes through formToWorkPayload: a work carrying only derived name lists / delimited strings is
// prefilled and submitted with the canonical body.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { renderWithProviders } from "@/test/_helpers/render-with-providers";

const { updateMock, addMock, toastError } = vi.hoisted(() => ({
  updateMock: vi.fn(async () => ({})),
  addMock: vi.fn(async () => ({})),
  toastError: vi.fn(),
}));

vi.mock("@/modules/catalog/hooks/useWorks", () => {
  const stable = {
    works: [], isLoading: false, error: null,
    addWork: { mutateAsync: (...a: unknown[]) => addMock(...a), isPending: false },
    updateWork: { mutateAsync: (...a: unknown[]) => updateMock(...a), isPending: false },
    deleteWork: { mutateAsync: vi.fn() },
  };
  return { useWorks: () => stable };
});
vi.mock("@/shared/hooks/useEntityLookup", () => ({
  useEntityLookup: () => ({ items: [], isLoading: false }),
  useEntityById: () => ({ entity: undefined }),
}));
vi.mock("@/shared/hooks/useCurrentOrgId", () => ({ useCurrentOrgId: () => ({ orgId: "org-1", isLoading: false }) }));
vi.mock("@/modules/catalog/components/AbramusSearchRow", () => ({ AbramusSearchRow: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: (...a: unknown[]) => toastError(...a), warning: vi.fn() } }));

import { WorkFormModal } from "@/modules/catalog/components/WorkFormModal";

const UPDATED_AT = "2026-09-01T10:00:00.000Z";

function legacyWork(extra: Record<string, unknown> = {}) {
  return {
    id: "w-1",
    title: "  Obra Legada ",
    status: "registered",
    music_genre: "POP",
    language: "pt",
    duration_text: "04:30",
    is_instrumental: true,
    ecad_code: "ECAD-1",
    alternative_titles: "Alt Um; Alt Dois",
    related_references: "Ref Um, Ref Dois",
    lyrics: "letra legada",
    composer_names: ["Compositor Legado"],
    translator_names: ["Tradutor Legado"],
    work_origin: "reference",
    updated_at: UPDATED_AT,
    ...extra,
  };
}

function renderEdit(work: Record<string, unknown>) {
  return renderWithProviders(<WorkFormModal open={true} onOpenChange={() => {}} work={work} mode="edit" />);
}

describe("WorkFormModal prefill + submit through the mapper", () => {
  beforeEach(() => { updateMock.mockClear(); addMock.mockClear(); toastError.mockClear(); });

  it("prefills duration and participants from a work with name lists only, and submits the canonical body", async () => {
    renderEdit(legacyWork());
    // prefill (workToFormFields)
    await waitFor(() => expect(screen.getByTestId("input-duration-minutes")).toHaveValue("4"));
    expect(screen.getByTestId("input-duration-seconds")).toHaveValue("30");
    expect(screen.getByDisplayValue("Compositor Legado")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Tradutor Legado")).toBeInTheDocument();
    expect(screen.getByTestId("switch-work-instrumental")).toHaveAttribute("aria-checked", "true");

    fireEvent.click(screen.getByTestId("button-submit-work"));
    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    const body = updateMock.mock.calls[0][0] as Record<string, any>;
    expect(body).toMatchObject({
      id: "w-1",
      title: "Obra Legada",
      music_genre: "pop",
      language: "pt",
      duration_text: "04:30",
      is_instrumental: true,
      ai_used: false,
      ai_usage_level: null,
      ai_harmony: null,
      alternative_titles: ["Alt Um", "Alt Dois"],
      related_references: ["Ref Um", "Ref Dois"],
      lyrics: "letra legada",
      status: "registered",
      composer_names: ["Compositor Legado"],
      translator_names: ["Tradutor Legado"],
      project_id: null,
      artist_id: null,
      work_origin: "reference",
      expectedUpdatedAt: UPDATED_AT,
    });
    expect(body.participants).toEqual([
      expect.objectContaining({ name: "Compositor Legado", role: "composer_author", link: null, percentage: null }),
      expect.objectContaining({ name: "Tradutor Legado", role: "translator", link: null, percentage: null }),
    ]);
    for (const formOnly of ["musicGenre", "durationMinutes", "isInstrumental", "alternativeTitles", "projectId", "workOrigin"]) {
      expect(body).not.toHaveProperty(formOnly);
    }
  });

  it("negative: a plain work submits null optional fields and empty participants (no stale legacy values)", async () => {
    renderEdit({ id: "w-2", title: "Obra Plana", updated_at: UPDATED_AT });
    expect(screen.getByTestId("input-duration-minutes")).toHaveValue("");
    expect(screen.getByTestId("switch-work-instrumental")).toHaveAttribute("aria-checked", "false");
    fireEvent.click(screen.getByTestId("button-submit-work"));
    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    const body = updateMock.mock.calls[0][0] as Record<string, any>;
    expect(body).toMatchObject({
      title: "Obra Plana",
      music_genre: null,
      language: null,
      duration_text: null,
      is_instrumental: false,
      alternative_titles: null,
      related_references: null,
      lyrics: null,
      participants: [],
      composer_names: null,
      translator_names: null,
      status: "pending",
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("re-syncs the form when the record changes while open", async () => {
    const { rerender } = renderEdit(legacyWork());
    await waitFor(() => expect(screen.getByTestId("input-duration-minutes")).toHaveValue("4"));
    rerender(
      <WorkFormModal open={true} onOpenChange={() => {}} mode="edit" work={legacyWork({ id: "w-3", duration_text: "01:05", composer_names: ["Outro Nome"], translator_names: [] })} />,
    );
    await waitFor(() => expect(screen.getByTestId("input-duration-minutes")).toHaveValue("1"));
    expect(screen.getByTestId("input-duration-seconds")).toHaveValue("5");
    expect(screen.getByDisplayValue("Outro Nome")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Compositor Legado")).toBeNull();
  });
});
