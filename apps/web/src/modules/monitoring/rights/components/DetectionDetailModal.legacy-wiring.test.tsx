// @ts-nocheck
// DetectionDetailModal shows the catalog work status through statusLabel(status, "work"): a legacy slug
// renders its PT-BR label, never the raw stored value.
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { DetectionDetailModal } from "./DetectionDetailModal";

function detectionWith(workStatus: string) {
  return {
    id: "det-1",
    status: "pending",
    platform: "Spotify",
    type: "audio",
    detected_at: "2026-09-01T10:00:00.000Z",
    detected_title: "Faixa Detectada",
    work: { id: "w-1", title: "Obra Catalogada", status: workStatus, ecad_code: "E-1" },
  };
}

function catalogStatusText() {
  const label = screen.getByText("Status no Catálogo");
  return (label.nextElementSibling as HTMLElement).textContent;
}

// [stored status, expected visible label]
const STATUS_TABLE: ReadonlyArray<readonly [string, string]> = [
  ["ativo", "Ativo"],
  ["pendente", "Pendente"],
  ["registered", "Registrado"],
];

describe("DetectionDetailModal catalog status label", () => {
  it.each(STATUS_TABLE)("stored status %s renders %s", (stored, label) => {
    render(<DetectionDetailModal detection={detectionWith(stored)} open={true} onOpenChange={() => {}} />);
    expect(catalogStatusText()).toBe(label);
    expect(catalogStatusText()).not.toBe(stored);
  });

  it("negative: an unknown stored status renders the generic unknown label, never the raw value", () => {
    render(<DetectionDetailModal detection={detectionWith("raw_internal_slug")} open={true} onOpenChange={() => {}} />);
    expect(catalogStatusText()).toBe("Status não reconhecido");
    expect(screen.queryByText("raw_internal_slug")).toBeNull();
  });

  it("negative: a missing status renders the dash placeholder", () => {
    render(<DetectionDetailModal detection={detectionWith("")} open={true} onOpenChange={() => {}} />);
    expect(catalogStatusText()).toBe("—");
  });
});
