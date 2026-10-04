import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const state = vi.hoisted(() => ({ items: [] as Record<string, unknown>[] }));

vi.mock("@/modules/releases/hooks/useReleases", () => ({
  useReleases: () => ({ releases: [], isLoading: false, deleteRelease: { mutate: vi.fn(), mutateAsync: vi.fn() }, addRelease: vi.fn() }),
}));
vi.mock("@/modules/releases/hooks/useReleasesPaginated", () => ({
  useReleasesPaginated: () => ({ releases: state.items, total: state.items.length, isLoading: false, error: null, refetch: vi.fn() }),
  useReleasesDistributionStats: () => ({ kpis: { total: 0, distributed: 0, pending: 0, waitingAction: 0 }, isLoading: false, error: null }),
}));
vi.mock("@/shared/hooks/useEditQueryParam", () => ({ useEditQueryParam: () => undefined }));
vi.mock("@/shared/hooks/useImageContrast", () => ({ useImageContrast: () => ({ mode: "dark" }) }));
vi.mock("@/shared/lib/storage", () => ({ storage: { findById: vi.fn().mockResolvedValue(undefined) } }));
vi.mock("@/shared/components/MainLayout", () => ({
  MainLayout: ({ actions, children }: { actions?: React.ReactNode; children?: React.ReactNode }) => <div>{actions}{children}</div>,
}));
vi.mock("@/modules/releases/components/ReleaseFormModal", () => ({ ReleaseFormModal: () => null }));
vi.mock("@/modules/releases/components/ReleaseViewModal", () => ({ ReleaseViewModal: () => null }));
vi.mock("@/shared/components/DeleteConfirmModal", () => ({ DeleteConfirmModal: () => null }));
vi.mock("@/shared/components/AsyncEntityCombobox", () => ({ AsyncEntityCombobox: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

import Releases from "./Releases";

const release = (id: string, fields: Record<string, unknown>) => ({ id, title: `Release ${id}`, type: "single", release_date: null, ...fields });

const badgeOf = (id: string) => {
  const card = screen.getByTestId(`card-release-${id}`);
  return within(card).getByTestId(`checkbox-release-${id}`).nextElementSibling as HTMLElement;
};

// Each card shows a badge whose label and classes come from the display status of the persisted status.
describe("Releases page card status badge", () => {
  it.each([
    ["rejeitado", "Rejeitado", "bg-destructive"],
    ["take_down", "Takedown", "bg-info"],
    ["released", "Distribuído", "bg-success"],
    ["review", "Pendente", "bg-warning"],
    ["draft", "Incompleto", "bg-border-strong"],
  ])("a release persisted with status %s shows %s", (status, label, cls) => {
    state.items = [release("a", { status })];
    render(<MemoryRouter><Releases /></MemoryRouter>);
    const badge = badgeOf("a");
    expect(badge.textContent).toBe(label);
    expect(badge.className).toContain(cls);
  });

  it("the platform status wins over the persisted status on the card", () => {
    state.items = [release("b", { status: "draft", platform_status: "distributed" })];
    render(<MemoryRouter><Releases /></MemoryRouter>);
    expect(badgeOf("b").textContent).toBe("Distribuído");
  });

  it("each card gets its own badge", () => {
    state.items = [release("c", { status: "rejeitado" }), release("d", { status: "released" })];
    render(<MemoryRouter><Releases /></MemoryRouter>);
    expect(badgeOf("c").textContent).toBe("Rejeitado");
    expect(badgeOf("d").textContent).toBe("Distribuído");
  });
});
