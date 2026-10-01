// @ts-nocheck
// Integration tests for RightsMonitoring page (rebuilt on real content_detections
// + ecad_reports + obras — Decision Gate item 11, product-completion audit).
//
// Covers:
//  1. Clicking a row detail button opens DetectionDetailModal with composer names + ecad_code
//     from the catalog (enriched via work_id lookup against useWorks())
//  2. Clicking a detection with no matching/linked work shows the orphan warning
//  3. The "Divergências" tab badge count reflects detections without a reconciled work

import { describe, it, expect, vi } from "vitest";
import { act } from "react";
import { screen, fireEvent, within, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { renderWithProviders } from "./_helpers/render-with-providers";

vi.mock("@/shared/components/MainLayout", () => ({
  MainLayout: ({ children, actions }: { children: React.ReactNode; actions?: React.ReactNode }) => (
    <div>{actions}{children}</div>
  ),
}));

const DETECTIONS = [
  {
    id: "det-001", work_id: "work-001", artist_id: null,
    platform: "YouTube", detected_title: "Noite de Luz", url: "https://youtube.com/x",
    score: "0.92", status: "completed", type: "unauthorized_use",
    detected_at: "2026-05-08T14:32:00", metadata: {}, created_at: "2026-05-08T14:32:00", updated_at: "2026-05-08T14:32:00",
  },
  {
    id: "det-011", work_id: null, artist_id: null,
    platform: "TikTok", detected_title: "Track Desconhecida", url: null,
    score: null, status: "pending", type: "unauthorized_use",
    detected_at: "2026-05-02T11:20:00", metadata: {}, created_at: "2026-05-02T11:20:00", updated_at: "2026-05-02T11:20:00",
  },
];

const WORKS = [
  {
    id: "work-001", title: "Noite de Luz",
    composer_name: "Vitória Carvalho", composer_names: ["Vitória Carvalho", "Lucas Mendes"],
    publisher_name: "MusicOS Publishing", isrc: "BRMSC2500001", iswc: "T-123.456.789-0",
    society_code: "ABR-001-2025", ecad_code: "ECAD-0001-VL",
    music_genre: "Pop", status: "registered", duration_text: "3:42",
    artist: { id: "art-1", stage_name: "Vitória Lunar" },
  },
];

const deleteMutateAsync = vi.fn();

vi.mock("@/modules/monitoring/hooks/useDetections", () => ({
  useDetections: () => ({
    detections: DETECTIONS,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    addDetection: { mutateAsync: vi.fn() },
    updateDetection: { mutateAsync: vi.fn() },
    deleteDetection: { mutateAsync: deleteMutateAsync },
  }),
}));

vi.mock("@/modules/monitoring/hooks/useEcadReports", () => ({
  useEcadReports: () => ({
    reports: [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/shared/lib/storage", () => ({
  storage: {
    findById: async (table: string, id: string) => {
      if (table !== "works") return undefined;
      return WORKS.find((o) => o.id === id);
    },
  },
}));

import RightsMonitoring from "@/modules/monitoring/rights/pages/RightsMonitoring";

function renderPage() {
  return renderWithProviders(
    <MemoryRouter>
      <RightsMonitoring />
    </MemoryRouter>,
  );
}

describe("RightsMonitoring page — detail modal with catalog data", () => {
  it("clicking a matched row detail button opens modal with composer names and ecad_code", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("row-exec-det-001")).toBeInTheDocument();
    });

    const detailBtn = screen.getByTestId("btn-detail-det-001");
    await act(async () => { fireEvent.click(detailBtn); });

    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByText(/Noite de Luz/i)).toBeInTheDocument();
    expect(within(dialog).getByText("Vitória Carvalho, Lucas Mendes")).toBeInTheDocument();
    expect(within(dialog).getByText("ECAD-0001-VL")).toBeInTheDocument();
    expect(
      within(dialog).queryByText(/Obra não encontrada no catálogo/i),
    ).not.toBeInTheDocument();
  });
});

describe("RightsMonitoring page — detail modal for orphan detection", () => {
  it("clicking a detection with no work_id shows 'Obra não encontrada no catálogo' warning", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("row-exec-det-011")).toBeInTheDocument();
    });

    const detailBtn = screen.getByTestId("btn-detail-det-011");
    await act(async () => { fireEvent.click(detailBtn); });

    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByText(/Track Desconhecida/i)).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Obra não encontrada no catálogo/i),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText(/Compositor\(es\)/i)).not.toBeInTheDocument();
  });
});

describe("RightsMonitoring page — 'Divergências' tab badge", () => {
  it("'Divergências' tab shows a badge count reflecting the unreconciled detection", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("tab-divergences")).toBeDefined();
    });

    const divTab = screen.getByTestId("tab-divergences");

    // Only det-011 (work_id null) is unreconciled — det-001 has a matched obra
    // with ecad_code, but that match resolves asynchronously (GET /works/:id),
    // so wait for it to settle before reading the badge.
    await waitFor(() => {
      const badgeSpan = within(divTab).getByText(/^\d+$/);
      expect(parseInt(badgeSpan.textContent ?? "0", 10)).toBe(1);
    });
  });

  it("clicking Divergências tab shows panel with the unreconciled detection entry", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("tab-divergences")).toBeDefined();
    });

    const divTab = screen.getByTestId("tab-divergences");
    await act(async () => {
      fireEvent.pointerDown(divTab, { button: 0, ctrlKey: false });
      fireEvent.mouseDown(divTab, { button: 0 });
      fireEvent.click(divTab);
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Detecção sem obra vinculada/i),
      ).toBeInTheDocument();
    });

    expect(screen.getAllByText(/TikTok/i).length).toBeGreaterThan(0);
  });
});
