import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/shared/hooks/useEntityLookup", () => ({ useEntityById: () => ({ entity: undefined }) }));
vi.mock("@/modules/releases/hooks/useShares", () => ({ useShares: () => ({ shares: [] }) }));
vi.mock("@/shared/hooks/useWorkflowTransition", () => ({
  useWorkflowTransition: () => ({ transition: vi.fn(), isPending: false }),
}));
vi.mock("@/shared/hooks/useEntityDetail", () => ({
  useEntityDetail: () => ({ data: { allowed_transitions: [{ to: "approved", label: "Aprovar" }] } }),
}));
vi.mock("@/shared/lib/storage", () => ({ storage: { findById: vi.fn().mockResolvedValue(null) } }));
vi.mock("@/shared/components/WorkflowTransitionPanel", () => ({
  WorkflowTransitionPanel: (props: { statusLabel?: string }) => <div data-testid="transition-panel">{props.statusLabel}</div>,
}));
vi.mock("@/shared/components/StoredFileLink", () => ({ StoredFileLink: () => null }));

import { ReleaseViewModal } from "./ReleaseViewModal";
import type { Release } from "@/modules/releases/types";

const renderRelease = (fields: Record<string, unknown>) =>
  render(
    <ReleaseViewModal
      open
      onOpenChange={() => undefined}
      release={{ id: "r1", title: "Legacy Release", ...fields } as unknown as Release}
    />,
  );

// The workflow panel receives the PT-BR label of the display status, never the raw persisted status.
describe("ReleaseViewModal workflow status label", () => {
  it.each([
    ["draft", "Incompleto"],
    ["released", "Distribuído"],
    ["rejeitado", "Rejeitado"],
    ["take_down", "Takedown"],
  ])("persisted status %s is labelled %s", (status, label) => {
    renderRelease({ status });
    const panel = screen.getByTestId("transition-panel");
    expect(panel.textContent).toBe(label);
  });

  it("the platform status wins over the persisted status for the workflow label", () => {
    renderRelease({ status: "draft", platform_status: "approved" });
    expect(screen.getByTestId("transition-panel").textContent).toBe("Aprovado");
  });
});

// Distribution block: the platform status only exists when the platform reported one.
describe("ReleaseViewModal platform status", () => {
  it("a release with no platform status and no distributor is under internal control with no platform badge", () => {
    renderRelease({ status: "draft" });
    expect(screen.getByText("Controle interno")).toBeTruthy();
    expect(screen.queryByText("Plataforma")).toBeNull();
    expect(screen.queryByText("Status da plataforma:")).toBeNull();
  });

  it("an unknown platform status is not shown as a platform badge", () => {
    renderRelease({ status: "draft", platform_status: "weird_value" });
    expect(screen.queryByText("Status da plataforma:")).toBeNull();
    expect(screen.getByText("Controle interno")).toBeTruthy();
  });

  it.each([
    ["error", "Em Espera"],
    ["cancelled", "Em Espera"],
    ["distributed", "Distribuído"],
    ["takedown", "Takedown"],
  ])("platform status %s renders the badge %s", (platform_status, label) => {
    renderRelease({ status: "draft", platform_status });
    expect(screen.getByText("Plataforma")).toBeTruthy();
    const row = screen.getByText("Status da plataforma:").parentElement as HTMLElement;
    expect(row.textContent).toBe(`Status da plataforma:${label}`);
  });
});

// Track artist: canonical `artist`, then the deprecated Portuguese spelling of rows not yet backfilled.
describe("ReleaseViewModal track artist line", () => {
  it.each([
    ["deprecated artist key", { title: "Faixa", ["artista"]: "Legacy Artist", isrc: "BRAAA0000001" }, "Legacy Artist • BRAAA0000001"],
    ["canonical artist key", { title: "Faixa", artist: "Canon Artist", isrc: "BRAAA0000002" }, "Canon Artist • BRAAA0000002"],
    ["no artist at all", { title: "Faixa", isrc: "BRAAA0000003" }, "BRAAA0000003"],
  ])("track with %s", (_label, track, line) => {
    renderRelease({ status: "draft", metadata: { tracks: [track] } });
    expect(screen.getByText(line)).toBeTruthy();
  });

  it("legacy metadata keys (faixas/titulo) still list the track", () => {
    renderRelease({ status: "draft", metadata: { ["faixas"]: [{ ["titulo"]: "Legacy Title", ["artista"]: "Legacy Artist" }] } });
    expect(screen.getByText("Legacy Title")).toBeTruthy();
    expect(screen.getByText("Legacy Artist")).toBeTruthy();
  });
});
