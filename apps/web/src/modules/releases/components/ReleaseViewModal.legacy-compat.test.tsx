import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/shared/hooks/useEntityLookup", () => ({ useEntityById: () => ({ entity: undefined }) }));
vi.mock("@/modules/releases/hooks/useShares", () => ({ useShares: () => ({ shares: [] }) }));
vi.mock("@/shared/hooks/useWorkflowTransition", () => ({
  useWorkflowTransition: () => ({ transition: vi.fn(), isPending: false }),
}));
vi.mock("@/shared/hooks/useEntityDetail", () => ({ useEntityDetail: () => ({ data: undefined }) }));
vi.mock("@/shared/lib/storage", () => ({ storage: { findById: vi.fn().mockResolvedValue(null) } }));
vi.mock("@/shared/components/WorkflowTransitionPanel", () => ({ WorkflowTransitionPanel: () => null }));
vi.mock("@/shared/components/StoredFileLink", () => ({ StoredFileLink: () => null }));

import { ReleaseViewModal } from "./ReleaseViewModal";
import type { Release } from "@/modules/releases/types";

const renderWithTracks = (tracks: unknown[]) =>
  render(
    <ReleaseViewModal
      open
      onOpenChange={() => undefined}
      release={{ id: "r1", title: "T", status: "draft", metadata: { tracks } } as unknown as Release}
    />,
  );

// Release track credits persisted as objects may carry the Portuguese key `nome`.
describe("ReleaseViewModal credit objects with legacy nome key", () => {
  it.each([
    ["nome", [{ nome: "Ana Producer", role: "Producer" }]],
    ["name", [{ name: "Ana Producer", role: "Producer" }]],
  ])("renders the producer credit given as {%s}", (_key, producers) => {
    renderWithTracks([{ title: "Faixa", producers }]);
    expect(screen.getByText("Ana Producer")).toBeTruthy();
  });

  it("a credit object with neither key renders no phantom name", () => {
    renderWithTracks([{ title: "Faixa", producers: [{ role: "Producer" }] }]);
    expect(screen.queryByText("Produtores")).toBeNull();
  });
});

// Track credit lists persisted before the rename carry the Portuguese keys `compositores` / `produtores`.
describe("ReleaseViewModal track credit lists with legacy compositores/produtores keys", () => {
  it.each([
    ["legacy", { compositores: ["Carla Composer"], produtores: ["Paulo Producer"] }],
    ["canonical", { composers: ["Carla Composer"], producers: ["Paulo Producer"] }],
  ])("renders the composer and producer names given as %s keys", (_label, credits) => {
    renderWithTracks([{ title: "Faixa", ...credits }]);
    expect(screen.getByText("Carla Composer")).toBeTruthy();
    expect(screen.getByText("Paulo Producer")).toBeTruthy();
  });
});
