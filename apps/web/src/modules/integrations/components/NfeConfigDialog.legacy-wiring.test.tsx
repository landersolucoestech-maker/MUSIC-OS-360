// @ts-nocheck
// NfeConfigDialog through the real useNfe hooks: a session saved before the rename (provider "proprio")
// opens as the canonical provider, save persists the canonical value, delete clears the stored session.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { renderWithProviders } from "@/test/_helpers/render-with-providers";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));

import { NfeConfigDialog } from "@/modules/integrations/components/NfeConfigDialog";

const KEY = "musicos360_nfe_credentials";
const stored = () => JSON.parse(sessionStorage.getItem(KEY) as string);

function seedLegacySession() {
  sessionStorage.setItem(
    KEY,
    JSON.stringify({
      cnpj: "12345678000190",
      tax_regime: "lucro_real",
      environment: "production",
      certificate_type: "A3",
      provider: "proprio",
      saved_at: "2026-01-01T00:00:00.000Z",
    }),
  );
}

describe("NfeConfigDialog with real useNfe hooks", () => {
  beforeEach(() => { sessionStorage.clear(); });

  it("a stored legacy provider 'proprio' opens as the canonical custom provider and 'Atualizar' persists it", async () => {
    seedLegacySession();
    renderWithProviders(<NfeConfigDialog open={true} onOpenChange={() => {}} />);
    await waitFor(() => expect(screen.getByText("NF-e configurada")).toBeInTheDocument());
    expect(screen.getByTestId("input-nfe-cnpj")).toHaveValue("12345678000190");
    expect(screen.getByTestId("select-nfe-provider")).toHaveTextContent("Integração própria");
    expect(screen.getByTestId("select-nfe-regime")).toHaveTextContent("Lucro Real");
    expect(screen.getAllByText("Produção").length).toBeGreaterThan(0);
    expect(screen.getByTestId("button-nfe-save")).toHaveTextContent("Atualizar");

    fireEvent.click(screen.getByTestId("button-nfe-save"));
    await waitFor(() => expect(stored().provider).toBe("custom"));
    expect(stored()).toMatchObject({ cnpj: "12345678000190", tax_regime: "lucro_real", environment: "production", certificate_type: "A3" });
    expect(stored().saved_at).not.toBe("2026-01-01T00:00:00.000Z");
  });

  it("delete removes the stored session and the dialog returns to the unconfigured state", async () => {
    seedLegacySession();
    renderWithProviders(<NfeConfigDialog open={true} onOpenChange={() => {}} />);
    fireEvent.click(await screen.findByTestId("button-nfe-delete"));
    await waitFor(() => expect(sessionStorage.getItem(KEY)).toBeNull());
    await waitFor(() => expect(screen.queryByText("NF-e configurada")).toBeNull());
    expect(screen.getByTestId("button-nfe-save")).toHaveTextContent("Configurar NF-e");
    expect(screen.queryByTestId("button-nfe-delete")).toBeNull();
  });

  it("negative: without a stored session the dialog is unconfigured and save is disabled until CNPJ and token are given", async () => {
    renderWithProviders(<NfeConfigDialog open={true} onOpenChange={() => {}} />);
    await screen.findByTestId("input-nfe-cnpj");
    expect(screen.queryByText("NF-e configurada")).toBeNull();
    expect(screen.getByTestId("button-nfe-save")).toBeDisabled();
    fireEvent.change(screen.getByTestId("input-nfe-cnpj"), { target: { value: "11.222.333/0001-44" } });
    fireEvent.change(screen.getByTestId("input-nfe-token"), { target: { value: "tok" } });
    expect(screen.getByTestId("button-nfe-save")).not.toBeDisabled();
    fireEvent.click(screen.getByTestId("button-nfe-save"));
    await waitFor(() => expect(stored().cnpj).toBe("11222333000144"));
    expect(stored().provider).toBe("focusnfe");
  });
});
