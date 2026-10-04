/**
 * Compat wiring: a tenant whose stored industry is a deprecated Portuguese value preselects (and submits) the
 * canonical segment option (normalizeOrganizationIndustry).
 */
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiPatch = vi.hoisted(() => vi.fn());
const tenantState = vi.hoisted(() => ({ industry: "" as string | null }));

vi.mock("@/shared/lib/api-client", () => ({ api: { patch: (...args: unknown[]) => apiPatch(...args) } }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/app/providers/TenantContext", () => ({
  useTenant: () => ({
    tenant: {
      name: "Selo Teste",
      industry: tenantState.industry,
      config: { logoUrl: "" },
      meta: { timezone: "America/Sao_Paulo" },
      onboarding: { steps: {} },
    },
    setTenant: vi.fn(),
  }),
}));

import Onboarding from "./Onboarding";

function renderWith(industry: string | null) {
  tenantState.industry = industry;
  render(<MemoryRouter><Onboarding /></MemoryRouter>);
}

const selectedLabel = () => screen.getByRole("combobox").textContent ?? "";

async function submittedSegment(): Promise<unknown> {
  fireEvent.click(screen.getByRole("button", { name: /Concluir/ }));
  await waitFor(() => expect(apiPatch).toHaveBeenCalledTimes(1));
  return (apiPatch.mock.calls[0][1] as { segment: unknown }).segment;
}

beforeEach(() => {
  vi.clearAllMocks();
  apiPatch.mockResolvedValue({});
});
afterEach(() => cleanup());

describe("Onboarding segment preselection", () => {
  it.each([
    ["gravadora", "Gravadora", "record_label"],
    ["editora", "Editora Musical", "music_publisher"],
    ["distribuidora", "Distribuidora", "distributor"],
    ["agencia", "Agência Artística", "artist_agency"],
    ["outro", "Outro", "other"],
  ])("legacy industry %s preselects %s and submits %s", async (legacy, label, canonical) => {
    renderWith(legacy);
    expect(selectedLabel()).toBe(label);
    expect(await submittedSegment()).toBe(canonical);
  });

  it("canonical industry is kept", async () => {
    renderWith("music_publisher");
    expect(selectedLabel()).toBe("Editora Musical");
    expect(await submittedSegment()).toBe("music_publisher");
  });

  it("negative: normalizes case and whitespace of the stored value", async () => {
    renderWith("  Gravadora ");
    expect(selectedLabel()).toBe("Gravadora");
    expect(await submittedSegment()).toBe("record_label");
  });

  it.each(["valor-desconhecido", "", null])("negative: unknown/empty industry %s falls back to the canonical default option, never a raw value", async (raw) => {
    renderWith(raw);
    expect(selectedLabel()).toBe("Outro");
    expect(await submittedSegment()).toBe("other");
  });
});
