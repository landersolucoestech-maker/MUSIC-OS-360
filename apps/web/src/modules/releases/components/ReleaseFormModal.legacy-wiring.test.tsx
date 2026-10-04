import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const project = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("@/shared/hooks/useEntityLookup", () => ({
  useEntityLookup: ({ table }: { table: string }) => ({ items: table === "projects" ? [project.current] : [] }),
  useEntityById: (table: string, id?: string) => ({ entity: table === "projects" && id ? project.current : undefined }),
}));
vi.mock("@/shared/lib/storage", () => ({
  storage: {
    findById: vi.fn().mockResolvedValue(undefined),
    listPaged: vi.fn().mockResolvedValue({ items: [] }),
  },
}));
vi.mock("@/modules/releases/hooks/useReleases", () => ({
  useReleases: () => ({ addRelease: vi.fn(), updateRelease: vi.fn() }),
}));
vi.mock("@/shared/hooks/useUploadToR2", () => ({
  useUploadToR2: () => ({ upload: vi.fn(), isUploading: false }),
  R2NotConfiguredError: class extends Error {},
}));
vi.mock("@/modules/releases/hooks/useDistributionPlatforms", () => ({
  useDistributionPlatforms: () => ({ enabledPlatforms: [], hasAnyConnected: false }),
}));
vi.mock("@/shared/components/StoredFileLink", () => ({ StoredFileLink: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

import { ReleaseFormModal } from "./ReleaseFormModal";
import type { Release } from "@/modules/releases/types";

beforeEach(() => vi.clearAllMocks());

const editRelease = (fields: Record<string, unknown>) =>
  render(
    <ReleaseFormModal
      open
      onOpenChange={() => undefined}
      mode="edit"
      release={{ id: "r1", title: "Legacy Release", artist_id: "a1", type: "single", ...fields } as unknown as Release}
    />,
  );

// The internal status badge goes through resolveReleaseStatus + releaseStatusLabel.
describe("ReleaseFormModal internal status badge for persisted statuses", () => {
  it.each([
    ["rejeitado", "Rejeitado"],
    ["take_down", "Takedown"],
    ["approved", "Aprovado"],
    ["something_unknown", "Incompleto"],
  ])("a release persisted with status %s shows the label %s", (status, label) => {
    editRelease({ status });
    const badge = screen.getByText("Status interno").parentElement as HTMLElement;
    expect(badge.textContent).toContain(label);
    // The raw status (or its canonical key) is never shown to the user.
    expect(badge.textContent).not.toContain(status);
  });

  it("the platform status wins over the persisted status", () => {
    editRelease({ status: "draft", platform_status: "distributed" });
    expect((screen.getByText("Status interno").parentElement as HTMLElement).textContent).toContain("Distribuído");
  });
});

// A project that only carries the deprecated `nome` still shows a readable label once selected.
describe("ReleaseFormModal selected project label", () => {
  it.each([
    ["only the deprecated name key", { id: "p1", ["nome"]: "Legacy Project Name", artist_id: "a1", type: "single" }, "Legacy Project Name"],
    ["canonical title wins over the deprecated name", { id: "p1", title: "Canon Project", ["nome"]: "Old Name", artist_id: "a1", type: "single" }, "Canon Project"],
  ])("project with %s", async (_label, proj, expected) => {
    project.current = proj;
    render(<ReleaseFormModal open onOpenChange={() => undefined} mode="create" />);
    fireEvent.focus(screen.getByTestId("input-search-project"));
    fireEvent.click(await screen.findByTestId("option-project-p1"));
    await waitFor(() => expect((screen.getByTestId("input-search-project") as HTMLInputElement).value).toBe(expected));
  });
});

// Release rows not yet backfilled carry the Portuguese metadata keys; the form must still load them.
describe("ReleaseFormModal editing a release with legacy metadata keys", () => {
  it("loads the tracks and their lyrics from legacy faixas/letra keys", async () => {
    editRelease({
      metadata: { ["faixas"]: [{ id: 1, title: "Legacy Track One", ["letra"]: "legacy lyrics text", ["produtores"]: [{ ["nome"]: "Legacy Producer", role: "Producer" }], ["compositores"]: ["Legacy Composer"], ["musicos"]: [], ["artistasAdicionais"]: [] }] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Envio de faixas" }));
    expect(await screen.findByDisplayValue("Legacy Track One")).toBeTruthy();
    expect(screen.getByDisplayValue("legacy lyrics text")).toBeTruthy();
    expect(screen.getByDisplayValue("Legacy Producer")).toBeTruthy();
    expect(screen.getByDisplayValue("Legacy Composer")).toBeTruthy();
  });

  it("loads canonical tracks unchanged", async () => {
    editRelease({ metadata: { tracks: [{ id: 1, title: "Canon Track", lyrics: "canon lyrics", composers: ["Canon Composer"], producers: [], musicians: [], additionalArtists: [] }] } });
    fireEvent.click(screen.getByRole("button", { name: "Envio de faixas" }));
    expect(await screen.findByDisplayValue("Canon Track")).toBeTruthy();
    expect(screen.getByDisplayValue("canon lyrics")).toBeTruthy();
  });

  it("a release without any metadata starts with a single empty track", async () => {
    editRelease({});
    fireEvent.click(screen.getByRole("button", { name: "Envio de faixas" }));
    expect(screen.queryByDisplayValue("Legacy Track One")).toBeNull();
  });
});
