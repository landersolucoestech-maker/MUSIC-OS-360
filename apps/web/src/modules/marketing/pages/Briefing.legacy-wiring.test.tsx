import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";

const stored = vi.hoisted(() => ({ lists: [] as Record<string, unknown>[] }));

vi.mock("@/modules/settings/services/settings.service", () => ({
  settingsService: { getOperationalLists: () => stored.lists, saveOperationalLists: vi.fn() },
}));
vi.mock("../hooks/useMarketingBriefings", () => ({
  useMarketingBriefings: () => ({ data: [], isLoading: false }),
  useCreateBriefing: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateBriefing: () => ({ mutate: vi.fn(), isPending: false }),
  useRemoveBriefing: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/shared/components/MainLayout", () => ({
  MainLayout: ({ actions, children }: { actions?: ReactNode; children?: ReactNode }) => <div>{actions}{children}</div>,
}));
type Option = { value: string; label: string };
vi.mock("../components", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    MarketingFilters: ({ filters }: { filters: { placeholder: string; options: Option[] }[] }) => (
      <div>
        {filters.map((f) => (
          <div key={f.placeholder} data-testid={`filter-${f.placeholder}`}>{f.options.map((o) => `${o.value}=${o.label}`).join("|")}</div>
        ))}
      </div>
    ),
    MarketingFormModal: ({ open, fields }: { open: boolean; fields: { name: string; options?: Option[] }[] }) =>
      open ? (
        <div data-testid="form-modal">
          {fields.map((f) => (
            <div key={f.name} data-testid={`form-field-${f.name}`}>{(f.options ?? []).map((o) => `${o.value}=${o.label}`).join("|")}</div>
          ))}
        </div>
      ) : null,
  };
});

import Briefing from "./Briefing";

beforeEach(() => {
  stored.lists = [];
});

const legacyItem = (slug: string, name: string, order: number) => ({
  id: `legacy-${slug}`, kind: "briefing_service_type", name, slug, description: "", active: true, order,
});

// The "type" filter and the create form offer the briefing service types of the operational lists.
describe("Briefing page briefing types from the operational settings", () => {
  it("offers the platform default types when nothing is stored", () => {
    render(<Briefing />);
    const filter = screen.getByTestId("filter-Tipo").textContent;
    expect(filter).toContain("campaign=Campanha");
    expect(filter).toContain("content=Conteúdo");
  });

  it("reads stored legacy-slug defaults under their canonical slug in the filter and the form", () => {
    stored.lists = [legacyItem("campanha", "Campanha", 10), legacyItem("conteudo", "Conteúdo", 20)];
    render(<Briefing />);
    const filter = screen.getByTestId("filter-Tipo").textContent ?? "";
    expect(filter).toContain("campaign=Campanha");
    expect(filter).toContain("content=Conteúdo");
    expect(filter).not.toContain("campanha=");
    expect(filter).not.toContain("conteudo=");
    fireEvent.click(screen.getAllByRole("button", { name: /Novo Briefing/ })[0]);
    const form = screen.getByTestId("form-field-type").textContent ?? "";
    expect(form).toContain("campaign=Campanha");
    expect(form).not.toContain("campanha=");
  });

  it("keeps a tenant-authored type untouched, even when it reuses a legacy slug with another name", () => {
    stored.lists = [legacyItem("campanha", "Minha campanha", 10), legacyItem("workshop", "Workshop", 50)];
    render(<Briefing />);
    const filter = screen.getByTestId("filter-Tipo").textContent ?? "";
    expect(filter).toContain("campanha=Minha campanha");
    expect(filter).toContain("workshop=Workshop");
  });
});
