// @ts-nocheck
// Wiring test: LeadFilters builds its status options from useOperationalSettings (real hook, stored list
// mocked at the settings service) so lists persisted before the OL1 vocabulary are read as canonical.
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

vi.mock("@/modules/settings/services/settings.service", () => ({
  settingsService: { getOperationalLists: vi.fn(() => []), saveOperationalLists: vi.fn() },
}));
vi.mock("@/shared/ui/select", () => ({
  Select: ({ value, children }: any) => <div data-testid="filter-select" data-select-value={value ?? ""}>{children}</div>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ value, children }: any) => <div role="option" data-value={value}>{children}</div>,
}));

import { settingsService } from "@/modules/settings/services/settings.service";
import { LeadFilters } from "./index";

const K = (...p: string[]) => p.join("");
const item = (kind: string, slug: string, name: string, order: number) => ({ id: `${kind}-${slug}`, kind, name, slug, description: "", active: true, order, group: "Pipeline" });

const filters = { search: "", serviceType: "all", status: "all", responsiblePerson: "all", leadSource: "all", temperature: "all" };

// The status filter is the select that offers "Todos os status".
function statusOptions(): Array<[string, string]> {
  const select = screen.getAllByTestId("filter-select").find((s) => s.textContent?.includes("Todos os status"))!;
  return Array.from(select.querySelectorAll('[role="option"]')).map((o) => [o.getAttribute("data-value")!, o.textContent!]);
}

function renderFilters() {
  return render(<LeadFilters filters={filters} onChange={() => {}} responsiblePeople={[]} />);
}

beforeEach(() => vi.mocked(settingsService.getOperationalLists).mockReset().mockReturnValue([]));

describe("LeadFilters legacy wiring (lead_status options from operational settings)", () => {
  it("renders the default statuses when nothing is stored", () => {
    renderFilters();
    const opts = statusOptions();
    expect(opts[0]).toEqual(["all", "Todos os status"]);
    expect(opts).toContainEqual(["new", "Novo"]);
    expect(opts).toContainEqual(["proposal", "Proposta"]);
  });

  it("a stored pre-OL1 default status is offered under its canonical slug (not the legacy one, no duplicate)", () => {
    vi.mocked(settingsService.getOperationalLists).mockReturnValue([
      item("lead_status", K("novo", "_lead"), "Novo lead", 10),
      item("lead_status", K("proposta", "_enviada"), "Proposta enviada", 50),
    ] as never);
    renderFilters();
    const opts = statusOptions();
    const values = opts.map((o) => o[0]);
    expect(opts).toContainEqual(["new", "Novo lead"]);
    expect(opts).toContainEqual(["proposal", "Proposta enviada"]);
    expect(values).not.toContain(K("novo", "_lead"));
    expect(values).not.toContain(K("proposta", "_enviada"));
    expect(values.filter((v) => v === "new")).toHaveLength(1);
    expect(values.filter((v) => v === "proposal")).toHaveLength(1);
  });

  it("negative: a tenant-edited status keeps its own slug (only exact platform defaults are migrated)", () => {
    vi.mocked(settingsService.getOperationalLists).mockReturnValue([
      item("lead_status", K("qualifi", "cado"), "Meu qualificado", 40),
    ] as never);
    renderFilters();
    const opts = statusOptions();
    expect(opts).toContainEqual([K("qualifi", "cado"), "Meu qualificado"]);
  });
});
