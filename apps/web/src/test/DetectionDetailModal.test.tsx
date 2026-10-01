// @ts-nocheck
// Component tests for DetectionDetailModal (rebuilt for real content_detections
// data — Decision Gate item 11).
//
// Covers:
//  1. When obra is present: renders composer names, ecad_code (green), no orphan warning
//  2. When obra is absent: renders red "Obra não encontrada no catálogo" warning
//  3. DetectionStatus badge labels and Match ECAD indicator text

import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { DetectionDetailModal } from "@/modules/monitoring/rights/components/DetectionDetailModal";
import type { DetectionRow } from "@/modules/monitoring/rights/components/DetectionsTable";

const BASE_DETECTION: DetectionRow = {
  id: "det-001",
  work_id: "work-001",
  artist_id: null,
  platform: "YouTube",
  detected_title: "Noite de Luz",
  url: "https://youtube.com/x",
  score: "0.92",
  status: "completed",
  type: "unauthorized_use",
  detected_at: "2026-05-08T14:32:00",
  metadata: {},
  created_at: "2026-05-08T14:32:00",
  updated_at: "2026-05-08T14:32:00",
  work: {
    id: "work-001",
    title: "Noite de Luz",
    composer_name: "Vitória Carvalho",
    composer_names: ["Vitória Carvalho", "Lucas Mendes"],
    publisher_name: "MusicOS Publishing",
    isrc: "BRMSC2500001",
    iswc: "T-123.456.789-0",
    ecad_code: "ECAD-0001-VL",
    society_code: "ABR-001-2025",
    genre: "Pop",
    duration_text: "3:42",
    status: "registered",
  },
};

const ORPHAN_DETECTION: DetectionRow = {
  id: "det-011",
  work_id: null,
  artist_id: null,
  platform: "TikTok",
  detected_title: "Track Desconhecida",
  url: null,
  score: null,
  status: "pending",
  type: "unauthorized_use",
  detected_at: "2026-05-02T11:20:00",
  metadata: {},
  created_at: "2026-05-02T11:20:00",
  updated_at: "2026-05-02T11:20:00",
  work: undefined,
};

function renderModal(detection: DetectionRow | null, open = true) {
  return render(
    <DetectionDetailModal detection={detection} open={open} onOpenChange={() => {}} />,
  );
}

/** BASE_DETECTION with its catalog work (CatalogWorkRef) patched. */
function withCatalogWork(patch: Record<string, unknown>): DetectionRow {
  return { ...BASE_DETECTION, work: { ...BASE_DETECTION.work!, ...patch } };
}

describe("<DetectionDetailModal /> — with catalog data", () => {
  it("renders dialog title and platform from detection props", () => {
    renderModal(BASE_DETECTION);
    expect(screen.getByRole("heading", { name: /Noite de Luz/i })).toBeInTheDocument();
    expect(screen.getAllByText("YouTube").length).toBeGreaterThan(0);
  });

  it("shows '✓ Obra vinculada com cód. ECAD' when obra has ecad_code", () => {
    renderModal(BASE_DETECTION);
    expect(screen.getByText(/Obra vinculada com cód\. ECAD/i)).toBeInTheDocument();
  });

  it("shows compositor(es) from obra (composer_names)", () => {
    renderModal(BASE_DETECTION);
    expect(screen.getByText("Vitória Carvalho, Lucas Mendes")).toBeInTheDocument();
  });

  it("falls back to composer_name when the work has no composer_names", () => {
    renderModal(withCatalogWork({ composer_names: null }));
    expect(screen.getByText("Vitória Carvalho")).toBeInTheDocument();
  });

  it("shows the society code from obra", () => {
    renderModal(BASE_DETECTION);
    expect(screen.getByText("ABR-001-2025")).toBeInTheDocument();
  });

  it("shows ECAD identifier from obra", () => {
    renderModal(BASE_DETECTION);
    expect(screen.getByText("ECAD-0001-VL")).toBeInTheDocument();
  });

  it("shows ISWC from obra when present", () => {
    renderModal(BASE_DETECTION);
    expect(screen.getByText("T-123.456.789-0")).toBeInTheDocument();
  });

  it("does NOT render the orphan warning alert", () => {
    renderModal(BASE_DETECTION);
    expect(
      screen.queryByText(/Obra não encontrada no catálogo/i),
    ).not.toBeInTheDocument();
  });

  it("shows publisher/editora from obra", () => {
    renderModal(BASE_DETECTION);
    expect(screen.getAllByText("MusicOS Publishing").length).toBeGreaterThan(0);
  });

  it("shows the catalog status row", () => {
    renderModal(BASE_DETECTION);
    expect(screen.getByText(/registrado/i)).toBeInTheDocument();
  });
});

describe("<DetectionDetailModal /> — orphan detection (no obra)", () => {
  it("renders dialog title from detected_title", () => {
    renderModal(ORPHAN_DETECTION);
    expect(screen.getByRole("heading", { name: /Track Desconhecida/i })).toBeInTheDocument();
  });

  it("renders the red 'Obra não encontrada no catálogo' alert", () => {
    renderModal(ORPHAN_DETECTION);
    expect(
      screen.getByText(/Obra não encontrada no catálogo/i),
    ).toBeInTheDocument();
  });

  it("does NOT render catalog data rows (Compositor, Editora)", () => {
    renderModal(ORPHAN_DETECTION);
    expect(screen.queryByText(/Compositor\(es\)/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Publisher / Editora")).not.toBeInTheDocument();
  });

  it("shows '✗ Sem correspondência no catálogo/ECAD' when there is no obra", () => {
    renderModal(ORPHAN_DETECTION);
    expect(screen.getByText(/Sem correspondência no catálogo\/ECAD/i)).toBeInTheDocument();
  });
});

describe("<DetectionDetailModal /> — status badge variants", () => {
  it.each([
    ["completed" as const, "Concluído"],
    ["in_progress" as const, "Em Andamento"],
    ["pending" as const, "Pendente"],
    ["rejected" as const, "Rejeitado"],
    ["archived" as const, "Arquivado"],
  ])("renders badge label '%s' for status '%s'", (status, label) => {
    renderModal({ ...BASE_DETECTION, status });
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});

describe("<DetectionDetailModal /> — edge cases", () => {
  it("renders nothing when detection is null", () => {
    const { container } = renderModal(null);
    expect(container.firstChild).toBeNull();
  });

  it("does not render ISWC row when iswc is null", () => {
    renderModal(withCatalogWork({ iswc: null }));
    expect(screen.queryByText("ISWC")).not.toBeInTheDocument();
  });

  it("shows 'Não cadastrado' warning when ecad_code is null in catalog — in PT-BR, never the raw field name", () => {
    renderModal(withCatalogWork({ ecad_code: null }));
    expect(screen.getByText("Não cadastrado — sem código ECAD")).toBeInTheDocument();
    expect(screen.queryByText(/ecad_code|cod_ecad/)).not.toBeInTheDocument();
  });
});
